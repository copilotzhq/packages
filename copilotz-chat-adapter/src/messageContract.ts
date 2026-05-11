import { getAttachmentKindFromMimeType, getMimeTypeFromDataUrl } from '@copilotz/chat-ui';
import type { AssistantActivityItem, MediaAttachment, ToolCall } from '@copilotz/chat-ui';
import type { InternalChatMessage } from './activity.ts';
import { resolveAssetsInMessages } from './assetsService.ts';
import {
  ContractViolation,
  expectRecord,
  expectString,
  expectStringValue,
} from './contract.ts';
import type { RequestHeadersProvider, RestMessage } from './copilotzService.ts';
import { resolveHydratedMessageSender, type SenderResolutionOptions } from './senders.ts';
import {
  extractToolCallsFromServerMessage,
  extractToolResultUpdateFromMessage,
  type ToolResultUpdate,
} from './toolActivity.ts';

export type HydratedMessageBatch = {
  viewMessages: InternalChatMessage[];
  toolResultUpdates: ToolResultUpdate[];
};

type MessageContractOptions = {
  senderOptions?: SenderResolutionOptions;
  createId?: () => string;
  now?: () => number;
  onToolOutput?: (output: Record<string, unknown>) => void;
  getRequestHeaders?: RequestHeadersProvider;
};

export const isInternalMessageMetadata = (
  metadata?: Record<string, unknown> | null,
): boolean => metadata?.visibility === 'internal';

const defaultCreateId = () =>
  (globalThis.crypto?.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`) as string;

const defaultNow = () => Date.now();
const roleBySender = {
  user: 'user',
  agent: 'assistant',
  tool: 'assistant',
  system: 'system',
} as const;

const expectNumber = (value: unknown, path: string): number => {
  if (typeof value !== 'number' || Number.isNaN(value)) throw new ContractViolation(`${path} must be a number`);
  return value;
};

const extractAttachments = (
  metadata: Record<string, unknown> | undefined,
): MediaAttachment[] => {
  if (metadata?.attachments === undefined) return [];
  if (!Array.isArray(metadata.attachments)) {
    throw new ContractViolation('message.metadata.attachments must be an array');
  }

  return metadata.attachments.map((value, index) => {
    const path = `message.metadata.attachments[${index}]`;
    const att = expectRecord(value, path);
    const dataUrl = expectString(att.dataUrl, `${path}.dataUrl`);
    const mimeType = typeof att.mimeType === 'string' && att.mimeType.trim().length > 0
      ? att.mimeType
      : getMimeTypeFromDataUrl(dataUrl) || 'application/octet-stream';
    const inferredKind = getAttachmentKindFromMimeType(mimeType);
    const normalizedKind = inferredKind;
    const base = {
      kind: normalizedKind,
      dataUrl,
      mimeType,
      ...(typeof att.fileName === 'string' ? { fileName: att.fileName } : {}),
      ...(att.size !== undefined ? { size: expectNumber(att.size, `${path}.size`) } : {}),
    };
    if (normalizedKind === 'image') return base as MediaAttachment;
    if (normalizedKind === 'audio') return {
      ...base,
      ...(att.durationMs !== undefined ? { durationMs: expectNumber(att.durationMs, `${path}.durationMs`) } : {}),
    } as MediaAttachment;
    if (normalizedKind === 'video') return {
      ...base,
      ...(att.durationMs !== undefined ? { durationMs: expectNumber(att.durationMs, `${path}.durationMs`) } : {}),
      ...(att.poster !== undefined ? { poster: expectString(att.poster, `${path}.poster`) } : {}),
    } as MediaAttachment;
    return base as MediaAttachment;
  });
};

const assertRestMessageContract = (msg: RestMessage): void => {
  expectString(msg.id, 'message.id');
  expectString(msg.threadId, 'message.threadId');
  if (!(msg.senderType in roleBySender)) throw new ContractViolation('message.senderType must be user, agent, tool, or system');
  expectStringValue(msg.content, 'message.content');
  if (msg.metadata !== undefined && msg.metadata !== null) expectRecord(msg.metadata, 'message.metadata');
  if (msg.createdAt !== undefined) expectString(msg.createdAt, 'message.createdAt');
};

export const shouldRenderHydratedMessage = (msg: RestMessage): boolean => {
  assertRestMessageContract(msg);
  const meta = msg.metadata ?? {};
  if (isInternalMessageMetadata(meta)) {
    return false;
  }
  const text = expectStringValue(msg.content, 'message.content').trim();
  const hasText = text.length > 0;
  const hasToolCalls = extractToolCallsFromServerMessage(msg).length > 0;
  const hasAttachments = extractAttachments(meta).length > 0;
  if (msg.senderType === 'tool') {
    return hasAttachments;
  }
  return hasText || hasToolCalls || hasAttachments;
};

export const convertServerMessage = (
  msg: RestMessage,
  options: MessageContractOptions = {},
): InternalChatMessage => {
  assertRestMessageContract(msg);
  const timestamp = msg.createdAt ? new Date(msg.createdAt).getTime() : (options.now ?? defaultNow)();
  const metadata = msg.metadata ?? undefined;
  const attachments = extractAttachments(metadata);
  const messageContent = expectStringValue(msg.content, 'message.content');
  const role = roleBySender[msg.senderType as keyof typeof roleBySender];

  const parsedToolCalls = extractToolCallsFromServerMessage(msg);
  const shouldRenderToolCalls = msg.senderType !== 'tool';
  const mappedToolCalls = parsedToolCalls.map((toolCall) => ({
    id: toolCall.id ?? (options.createId ?? defaultCreateId)(),
    name: toolCall.name,
    arguments: toolCall.arguments,
    status: toolCall.status,
    ...(toolCall.result !== undefined ? { result: toolCall.result } : {}),
  } satisfies ToolCall));

  const hasToolCalls = shouldRenderToolCalls && mappedToolCalls.length > 0;
  const isToolSender = msg.senderType === 'tool';
  const content =
    isToolSender
      ? ''
      : messageContent;

  const reasoning = typeof msg.reasoning === 'string' && msg.reasoning.length > 0
    ? msg.reasoning
    : undefined;
  const activityItems: AssistantActivityItem[] = [
    ...(reasoning ? [{
      id: `${msg.id}:thinking`,
      kind: 'thinking' as const,
      status: 'complete' as const,
      completedAt: timestamp,
      details: { reasoning },
    }] : []),
    ...(hasToolCalls ? mappedToolCalls.map((toolCall) => ({
      id: toolCall.id,
      kind: 'tool' as const,
      status: toolCall.status === 'failed'
        ? 'failed' as const
        : toolCall.status === 'completed'
          ? 'complete' as const
          : 'active' as const,
      toolName: toolCall.name,
      startedAt: toolCall.startTime,
      completedAt: toolCall.endTime,
      details: {
        toolCall,
        ...(toolCall.result !== undefined ? { result: toolCall.result } : {}),
      },
    })) : []),
  ];

  const sender = resolveHydratedMessageSender(msg, options.senderOptions);

  return {
    id: msg.id,
    role,
    content,
    timestamp,
    attachments: attachments.length > 0 ? attachments : undefined,
    isStreaming: false,
    isComplete: true,
    metadata,
    activity: activityItems.length > 0 ? { items: activityItems } : undefined,
    sender,
  };
};

export const prepareHydratedMessages = async (
  rawMessages: RestMessage[],
  options: MessageContractOptions = {},
): Promise<HydratedMessageBatch> => {
  rawMessages.forEach(assertRestMessageContract);
  const resolvedMessages = await resolveAssetsInMessages(
    rawMessages,
    options.getRequestHeaders,
  );

  resolvedMessages.forEach((msg) => {
    if (msg.senderType === 'tool') {
      const metadata = msg.metadata ?? undefined;
      if (!metadata) {
        throw new ContractViolation('tool message requires metadata');
      }
      options.onToolOutput?.(metadata.output === undefined ? metadata : { output: metadata.output });
    }
  });

  const now = options.now ?? defaultNow;
  const toolResultUpdates = resolvedMessages
    .map((msg) => extractToolResultUpdateFromMessage(msg as RestMessage, now))
    .filter((update): update is ToolResultUpdate => update !== null);

  const viewMessages = resolvedMessages
    .filter(shouldRenderHydratedMessage)
    .map((msg) => convertServerMessage(msg, options));

  return {
    viewMessages,
    toolResultUpdates,
  };
};
