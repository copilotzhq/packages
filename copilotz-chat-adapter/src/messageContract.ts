import { getAttachmentKindFromMimeType } from '@copilotz/chat-ui/model';
import type {
  AssistantActivityItem,
  MediaAttachment,
  ToolCall
} from '@copilotz/chat-ui';
import type { InternalChatMessage } from './activity.ts';
import type {
  CanonicalContentRef,
  CanonicalMessage,
  CanonicalMessagePage,
  CanonicalResolvedContent
} from './canonicalHistory.ts';
import { isRecord } from './contract.ts';
import { getRoutingMessageFromMetadata } from './streamEvents.ts';
import {
  resolveCanonicalParticipantSender,
  type SenderResolutionOptions
} from './senders.ts';
import type { ToolCallStatus, ToolResultUpdate } from './toolActivity.ts';

export type HydratedMessageBatch = {
  viewMessages: InternalChatMessage[];
  toolResultUpdates: ToolResultUpdate[];
};

type MessageContractOptions = {
  senderOptions?: SenderResolutionOptions;
  now?: () => number;
  onToolOutput?: (output: Record<string, unknown>) => void;
};

type CanonicalToolInvocation = {
  id: string;
  tool: { id: string; name?: string };
  args: unknown;
};

type DurableToolResult = {
  messageId: string;
  toolCallId: string;
  toolExecutionId: string;
  sourceMessageId?: string;
  tool: Record<string, unknown>;
  status: ToolCallStatus;
  content: readonly CanonicalContentRef[];
  error?: string;
  finishedAt: string;
};

export const isInternalMessageMetadata = (
  metadata?: Record<string, unknown> | null
): boolean => metadata?.visibility === 'internal';

const defaultNow = () => Date.now();

const workflowMetadata = (
  metadata: Record<string, unknown>
): Record<string, unknown> =>
  isRecord(metadata.copilotzWorkflow) ? metadata.copilotzWorkflow : {};

const askMetadata = (
  metadata: Record<string, unknown>
): Record<string, unknown> =>
  isRecord(metadata.copilotzAsk) ? metadata.copilotzAsk : {};

const canonicalTimestamp = (
  value: string | undefined,
  fallback: () => number
): number => {
  const timestamp = value ? new Date(value).getTime() : NaN;
  return Number.isFinite(timestamp) ? timestamp : fallback();
};

const dataUrl = (content: CanonicalResolvedContent): string =>
  `data:${content.asset.mediaType};base64,${content.base64}`;

const decodeUtf8 = (base64: string): string => {
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, (value) => value.charCodeAt(0));
  return new TextDecoder().decode(bytes);
};

const decodeContent = (content: CanonicalResolvedContent): unknown => {
  const text = decodeUtf8(content.base64);
  if (content.ref.kind !== 'json') return text;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
};

const contentMap = (
  content: CanonicalResolvedContent[]
): Map<string, CanonicalResolvedContent> =>
  new Map(content.map((value) => [value.ref.assetId, value]));

const resolved = (
  ref: CanonicalContentRef | undefined,
  content: Map<string, CanonicalResolvedContent>
): CanonicalResolvedContent | undefined =>
  ref ? content.get(ref.assetId) : undefined;

const contentValue = (
  ref: CanonicalContentRef | undefined,
  content: Map<string, CanonicalResolvedContent>
): unknown => {
  const value = resolved(ref, content);
  return value ? decodeContent(value) : undefined;
};

const bodyText = (
  refs: readonly CanonicalContentRef[],
  content: Map<string, CanonicalResolvedContent>
): string =>
  refs
    .filter((ref) => ref.role === 'body' || ref.role === 'transcript')
    .flatMap((ref) => {
      const value = contentValue(ref, content);
      return typeof value === 'string' ? [value] : [];
    })
    .join('\n');

const attachments = (
  refs: readonly CanonicalContentRef[],
  content: Map<string, CanonicalResolvedContent>
): MediaAttachment[] =>
  refs.flatMap((ref) => {
    if (
      ref.role !== 'attachment' &&
      !['image', 'audio', 'video', 'file'].includes(ref.kind)
    )
      return [];
    const value = resolved(ref, content);
    if (!value) return [];
    const mimeType = ref.mediaType || value.asset.mediaType;
    const kind = getAttachmentKindFromMimeType(mimeType);
    return [
      {
        kind,
        dataUrl: dataUrl(value),
        mimeType,
        ...(ref.name ? { fileName: ref.name } : {}),
        size: value.asset.byteLength
      } as MediaAttachment
    ];
  });

const refWithRole = (
  refs: readonly CanonicalContentRef[],
  role: string
): CanonicalContentRef | undefined => refs.find((ref) => ref.role === role);

const toolName = (tool: Record<string, unknown>, fallback: string): string =>
  typeof tool.name === 'string' && tool.name.trim()
    ? tool.name.trim()
    : typeof tool.id === 'string' && tool.id.trim()
    ? tool.id.trim()
    : fallback;

const toolId = (tool: Record<string, unknown>, fallback: string): string =>
  typeof tool.id === 'string' && tool.id.trim() ? tool.id.trim() : fallback;

const toolArguments = (value: unknown): Record<string, unknown> => {
  if (isRecord(value)) return value;
  if (typeof value !== 'string') return {};
  try {
    const parsed = JSON.parse(value);
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

const toolInvocations = (
  message: CanonicalMessage
): CanonicalToolInvocation[] => {
  const value = message.metadata.llmToolCalls;
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (
      !isRecord(entry) ||
      typeof entry.id !== 'string' ||
      typeof entry.action !== 'string' ||
      !isRecord(entry.input)
    )
      return [];
    return [
      {
        id: entry.id,
        tool: { id: entry.action },
        args: entry.input
      }
    ];
  });
};

const toolResultOutput = (
  result: DurableToolResult,
  content: Map<string, CanonicalResolvedContent>
): unknown =>
  contentValue(
    refWithRole(result.content, 'tool.projected_output') ??
      refWithRole(result.content, 'tool.output'),
    content
  );

const outputError = (value: unknown): string | undefined => {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (!isRecord(value)) return undefined;
  if (typeof value.message === 'string' && value.message.trim())
    return value.message.trim();
  return outputError(value.error);
};

const toolResultError = (
  result: DurableToolResult,
  content: Map<string, CanonicalResolvedContent>
): string | undefined => {
  if (result.status !== 'failed') return undefined;
  return (
    result.error ??
    outputError(toolResultOutput(result, content)) ??
    'Tool execution failed.'
  );
};

const optionalText = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;

const toolResultStatus = (value: unknown): ToolCallStatus => {
  if (value === 'completed') return 'completed';
  if (value === 'failed' || value === 'cancelled') return 'failed';
  if (value === 'pending') return 'pending';
  return 'running';
};

const durableToolResult = (
  message: CanonicalMessage
): DurableToolResult | undefined => {
  if (message.sender.participantType !== 'tool') return undefined;
  const invocation = isRecord(message.metadata.toolInvocation)
    ? message.metadata.toolInvocation
    : {};
  const toolCallId = optionalText(invocation.id);
  if (!toolCallId) return undefined;
  const workflow = workflowMetadata(message.metadata);
  const action = isRecord(message.metadata.copilotzToolAction)
    ? message.metadata.copilotzToolAction
    : {};
  const planResult = isRecord(message.metadata.copilotzToolPlanResult)
    ? message.metadata.copilotzToolPlanResult
    : {};
  const sourceAction = isRecord(planResult.sourceAction)
    ? planResult.sourceAction
    : {};
  const origin = isRecord(planResult.origin) ? planResult.origin : {};
  const status = toolResultStatus(message.metadata.toolStatus);
  return {
    messageId: message.id,
    toolCallId,
    toolExecutionId:
      optionalText(action.actionRunId) ??
      optionalText(sourceAction.actionRunId) ??
      message.id,
    ...(optionalText(workflow.sourceMessageId) ??
    optionalText(action.planMessageId) ??
    optionalText(origin.planMessageId)
      ? {
          sourceMessageId:
            optionalText(workflow.sourceMessageId) ??
            optionalText(action.planMessageId) ??
            optionalText(origin.planMessageId)
        }
      : {}),
    tool: isRecord(invocation.tool)
      ? invocation.tool
      : {
          id: optionalText(message.metadata.toolId) ?? message.sender.externalId
        },
    status,
    content: message.content,
    ...(status === 'failed' && message.metadata.toolStatus === 'cancelled'
      ? { error: 'Tool execution cancelled.' }
      : {}),
    finishedAt: message.createdAt
  };
};

const resultForCall = (
  callId: string,
  sourceMessageId: string,
  results: DurableToolResult[]
): DurableToolResult | undefined => {
  const matches = results.filter((result) => result.toolCallId === callId);
  return (
    matches.find((result) => result.sourceMessageId === sourceMessageId) ??
    (matches.length === 1 ? matches[0] : undefined)
  );
};

const mappedToolCall = (
  invocation: CanonicalToolInvocation,
  result: DurableToolResult | undefined,
  content: Map<string, CanonicalResolvedContent>,
  timestamp: number
): ToolCall => {
  const output = result ? toolResultOutput(result, content) : undefined;
  return {
    id: invocation.id,
    ...(result ? { toolExecutionId: result.toolExecutionId } : {}),
    toolId: toolId(result?.tool ?? invocation.tool, invocation.tool.id),
    name: toolName(result?.tool ?? invocation.tool, invocation.tool.id),
    arguments: toolArguments(invocation.args),
    status: result?.status ?? 'running',
    ...(output !== undefined ? { result: output } : {}),
    startTime: timestamp,
    ...(result
      ? { endTime: canonicalTimestamp(result.finishedAt, defaultNow) }
      : {})
  };
};

const isContentRef = (value: unknown): value is CanonicalContentRef =>
  isRecord(value) &&
  typeof value.assetId === 'string' &&
  typeof value.kind === 'string' &&
  typeof value.role === 'string' &&
  typeof value.mediaType === 'string';

const reasoningText = (
  message: CanonicalMessage,
  content: Map<string, CanonicalResolvedContent>
): string | undefined => {
  const refs = Array.isArray(message.metadata.llmReasoning)
    ? message.metadata.llmReasoning.filter(isContentRef)
    : [];
  const values = refs.flatMap((ref) => {
    const value = contentValue(ref, content);
    return typeof value === 'string' && value.trim() ? [value] : [];
  });
  return values.length ? values.join('\n') : undefined;
};

const activityItems = (
  message: CanonicalMessage,
  results: DurableToolResult[],
  content: Map<string, CanonicalResolvedContent>,
  timestamp: number
): AssistantActivityItem[] => {
  const workflow = workflowMetadata(message.metadata);
  const attemptId = optionalText(workflow.llmAttemptId);
  const failureReceipt = isRecord(message.metadata.copilotzAgentFailure)
    ? message.metadata.copilotzAgentFailure
    : null;
  const failure =
    workflow.kind === 'agent_failure' &&
    attemptId &&
    (workflow.outcome === 'failed' || workflow.outcome === 'cancelled') &&
    failureReceipt?.schema === 'copilotz.agent-failure' &&
    failureReceipt.source === 'llm.call' &&
    failureReceipt.llmAttemptId === attemptId &&
    failureReceipt.status === workflow.outcome
      ? [
          {
            id: `${attemptId}:failed`,
            kind: 'answering' as const,
            status: 'failed' as const,
            startedAt: timestamp,
            completedAt: timestamp,
            details: {
              error:
                workflow.outcome === 'cancelled'
                  ? 'The response was cancelled.'
                  : 'The response could not be completed.'
            }
          }
        ]
      : [];
  const reasoning = reasoningText(message, content);
  const calls = toolInvocations(message).map((invocation) => {
    const result = resultForCall(invocation.id, message.id, results);
    const toolCall = mappedToolCall(invocation, result, content, timestamp);
    const error = result ? toolResultError(result, content) : undefined;
    return {
      id: toolCall.id,
      kind: 'tool' as const,
      status:
        toolCall.status === 'failed'
          ? ('failed' as const)
          : toolCall.status === 'completed'
          ? ('complete' as const)
          : ('active' as const),
      toolId: toolCall.toolId,
      toolName: toolCall.name,
      startedAt: toolCall.startTime,
      completedAt: toolCall.endTime,
      details: {
        toolCall,
        ...(toolCall.result !== undefined ? { result: toolCall.result } : {}),
        ...(error ? { error } : {})
      }
    };
  });
  return [
    ...failure,
    ...(reasoning
      ? [
          {
            id: `${
              optionalText(workflowMetadata(message.metadata).llmAttemptId) ??
              message.id
            }:reasoning:0`,
            kind: 'thinking' as const,
            status: 'complete' as const,
            completedAt: timestamp,
            details: { reasoning }
          }
        ]
      : []),
    ...calls
  ];
};

const shouldRender = (
  message: CanonicalMessage,
  text: string,
  media: MediaAttachment[],
  activity: AssistantActivityItem[]
): boolean => {
  if (isInternalMessageMetadata(message.metadata)) return false;
  if (message.sender.participantType === 'tool') return media.length > 0;
  return Boolean(
    text.trim() ||
      getRoutingMessageFromMetadata(message.metadata) ||
      media.length ||
      activity.length
  );
};

const projectMessage = (
  message: CanonicalMessage,
  results: DurableToolResult[],
  content: Map<string, CanonicalResolvedContent>,
  options: MessageContractOptions
): InternalChatMessage | null => {
  const timestamp = canonicalTimestamp(
    message.createdAt,
    options.now ?? defaultNow
  );
  const text =
    bodyText(message.content, content) ||
    getRoutingMessageFromMetadata(message.metadata) ||
    '';
  const media = attachments(message.content, content);
  const activity = activityItems(message, results, content, timestamp);
  if (!shouldRender(message, text, media, activity)) return null;
  return {
    id: message.id,
    role: message.sender.participantType === 'human' ? 'user' : 'assistant',
    content: message.sender.participantType === 'tool' ? '' : text,
    timestamp,
    ...(media.length ? { attachments: media } : {}),
    isStreaming: false,
    isComplete: true,
    metadata: message.metadata,
    ...(activity.length ? { activity: { items: activity } } : {}),
    sender: resolveCanonicalParticipantSender(
      message.sender,
      options.senderOptions
    )
  };
};

const toolResultUpdate = (
  result: DurableToolResult,
  content: Map<string, CanonicalResolvedContent>,
  now: () => number
): ToolResultUpdate => {
  const output = toolResultOutput(result, content);
  const error = toolResultError(result, content);
  return {
    id: result.toolCallId,
    toolExecutionId: result.toolExecutionId,
    ...(result.sourceMessageId
      ? { sourceMessageId: result.sourceMessageId }
      : {}),
    name: toolName(result.tool, result.toolCallId),
    status: result.status,
    ...(output !== undefined ? { result: output } : {}),
    ...(error ? { error } : {}),
    endTime: canonicalTimestamp(result.finishedAt, now)
  };
};

/** Pure projection from the canonical Copilotz history document into chat UI state. */
export const projectCanonicalMessageHistory = (
  page: CanonicalMessagePage,
  options: MessageContractOptions = {}
): HydratedMessageBatch => {
  const content = contentMap(page.included.content);
  const now = options.now ?? defaultNow;
  const ordered = [...page.data].sort(
    (left, right) =>
      left.createdAt.localeCompare(right.createdAt) ||
      left.id.localeCompare(right.id)
  );
  const results = ordered.flatMap((message) => {
    const result = durableToolResult(message);
    return result ? [result] : [];
  });
  const toolResultUpdates = results.map((result) => {
    const output = toolResultOutput(result, content);
    if (isRecord(output)) options.onToolOutput?.(output);
    return toolResultUpdate(result, content, now);
  });
  const projectedMessages = ordered.flatMap((message) => {
    const projected = projectMessage(message, results, content, options);
    return projected ? [projected] : [];
  });
  const representedAskCalls = new Set(
    projectedMessages.flatMap(
      (message) =>
        message.activity?.items.flatMap((item) =>
          item.kind === 'tool' && item.toolId === 'ask' ? [item.id] : []
        ) ?? []
    )
  );
  const viewMessages = projectedMessages.filter((message) => {
    const ask = askMetadata(message.metadata ?? {});
    return !(
      ask.schema === 'copilotz.ask.v1' &&
      ask.phase === 'question' &&
      typeof ask.toolCallId === 'string' &&
      representedAskCalls.has(ask.toolCallId)
    );
  });
  return { viewMessages, toolResultUpdates };
};
