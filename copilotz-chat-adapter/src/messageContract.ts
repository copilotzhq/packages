import { getAttachmentKindFromMimeType } from '@copilotz/chat-ui';
import type { AssistantActivityItem, MediaAttachment, ToolCall } from '@copilotz/chat-ui';
import type { InternalChatMessage } from './activity.ts';
import type {
  CanonicalContentRef,
  CanonicalLlmAttempt,
  CanonicalMessage,
  CanonicalMessagePage,
  CanonicalResolvedContent,
  CanonicalToolExecution,
} from './canonicalHistory.ts';
import { isRecord } from './contract.ts';
import { getRoutingMessageFromMetadata } from './streamEvents.ts';
import { resolveCanonicalParticipantSender, type SenderResolutionOptions } from './senders.ts';
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
  args: string;
  status?: string;
  output?: unknown;
};

export const isInternalMessageMetadata = (
  metadata?: Record<string, unknown> | null,
): boolean => metadata?.visibility === 'internal';

const defaultNow = () => Date.now();

const workflowMetadata = (metadata: Record<string, unknown>): Record<string, unknown> => (
  isRecord(metadata.copilotzWorkflow) ? metadata.copilotzWorkflow : {}
);

const canonicalTimestamp = (value: string | undefined, fallback: () => number): number => {
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
  content: CanonicalResolvedContent[],
): Map<string, CanonicalResolvedContent> => new Map(
  content.map((value) => [value.ref.assetId, value]),
);

const resolved = (
  ref: CanonicalContentRef | undefined,
  content: Map<string, CanonicalResolvedContent>,
): CanonicalResolvedContent | undefined => ref ? content.get(ref.assetId) : undefined;

const contentValue = (
  ref: CanonicalContentRef | undefined,
  content: Map<string, CanonicalResolvedContent>,
): unknown => {
  const value = resolved(ref, content);
  return value ? decodeContent(value) : undefined;
};

const bodyText = (
  refs: CanonicalContentRef[],
  content: Map<string, CanonicalResolvedContent>,
): string => refs
  .filter((ref) => ref.role === 'body' || ref.role === 'transcript')
  .flatMap((ref) => {
    const value = contentValue(ref, content);
    return typeof value === 'string' ? [value] : [];
  })
  .join('\n');

const attachments = (
  refs: CanonicalContentRef[],
  content: Map<string, CanonicalResolvedContent>,
): MediaAttachment[] => refs.flatMap((ref) => {
  if (ref.role !== 'attachment' && !['image', 'audio', 'video', 'file'].includes(ref.kind)) return [];
  const value = resolved(ref, content);
  if (!value) return [];
  const mimeType = ref.mediaType || value.asset.mediaType;
  const kind = getAttachmentKindFromMimeType(mimeType);
  return [{
    kind,
    dataUrl: dataUrl(value),
    mimeType,
    ...(ref.name ? { fileName: ref.name } : {}),
    size: value.asset.byteLength,
  } as MediaAttachment];
});

const findAttempt = (
  message: CanonicalMessage,
  attempts: Map<string, CanonicalLlmAttempt>,
): CanonicalLlmAttempt | undefined => {
  const id = workflowMetadata(message.metadata).llmAttemptId;
  return typeof id === 'string' ? attempts.get(id) : undefined;
};

const refWithRole = (
  refs: CanonicalContentRef[],
  role: string,
): CanonicalContentRef | undefined => refs.find((ref) => ref.role === role);

const toolStatus = (execution: CanonicalToolExecution | undefined): ToolCallStatus => {
  if (!execution) return 'running';
  if (execution.status === 'cancelled') return 'failed';
  return execution.status;
};

const toolName = (
  tool: Record<string, unknown>,
  fallback: string,
): string => (
  typeof tool.name === 'string' && tool.name.trim()
    ? tool.name.trim()
    : typeof tool.id === 'string' && tool.id.trim()
      ? tool.id.trim()
      : fallback
);

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
  attempt: CanonicalLlmAttempt | undefined,
  content: Map<string, CanonicalResolvedContent>,
): CanonicalToolInvocation[] => {
  const value = contentValue(refWithRole(attempt?.content ?? [], 'llm.tool_calls'), content);
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is CanonicalToolInvocation => (
    isRecord(entry) && typeof entry.id === 'string' && isRecord(entry.tool) &&
    typeof entry.tool.id === 'string' && typeof entry.args === 'string'
  ));
};

const executionOutput = (
  execution: CanonicalToolExecution,
  content: Map<string, CanonicalResolvedContent>,
): unknown => contentValue(
  refWithRole(execution.content, 'tool.projected_output') ??
    refWithRole(execution.content, 'tool.output'),
  content,
);

const executionError = (execution: CanonicalToolExecution): string | undefined => {
  if (execution.status !== 'failed' && execution.status !== 'cancelled') return undefined;
  return execution.safeError?.message ?? (execution.status === 'cancelled' ? 'Tool execution cancelled.' : 'Tool execution failed.');
};

const executionForCall = (
  callId: string,
  sourceMessageId: string,
  executions: CanonicalToolExecution[],
): CanonicalToolExecution | undefined => {
  const matches = executions.filter((execution) => execution.toolCallId === callId);
  return matches.find((execution) => execution.messageId === sourceMessageId) ??
    (matches.length === 1 ? matches[0] : undefined);
};

const mappedToolCall = (
  invocation: CanonicalToolInvocation,
  execution: CanonicalToolExecution | undefined,
  content: Map<string, CanonicalResolvedContent>,
): ToolCall => {
  const result = execution ? executionOutput(execution, content) : invocation.output;
  return {
    id: invocation.id,
    ...(execution ? { toolExecutionId: execution.id } : {}),
    name: toolName(execution?.tool ?? invocation.tool, invocation.tool.id),
    arguments: toolArguments(invocation.args),
    status: toolStatus(execution),
    ...(result !== undefined ? { result } : {}),
    ...(execution ? { startTime: canonicalTimestamp(execution.startedAt, defaultNow) } : {}),
    ...(execution?.finishedAt ? { endTime: canonicalTimestamp(execution.finishedAt, defaultNow) } : {}),
  };
};

const activityItems = (
  message: CanonicalMessage,
  attempt: CanonicalLlmAttempt | undefined,
  executions: CanonicalToolExecution[],
  content: Map<string, CanonicalResolvedContent>,
  timestamp: number,
): AssistantActivityItem[] => {
  const reasoningValue = contentValue(refWithRole(attempt?.content ?? [], 'reasoning'), content);
  const reasoning = typeof reasoningValue === 'string' && reasoningValue.trim() ? reasoningValue : undefined;
  const calls = toolInvocations(attempt, content).map((invocation) => {
    const execution = executionForCall(invocation.id, message.id, executions);
    const toolCall = mappedToolCall(invocation, execution, content);
    const error = execution ? executionError(execution) : undefined;
    return {
      id: toolCall.id,
      kind: 'tool' as const,
      status: toolCall.status === 'failed' ? 'failed' as const : toolCall.status === 'completed' ? 'complete' as const : 'active' as const,
      toolName: toolCall.name,
      startedAt: toolCall.startTime,
      completedAt: toolCall.endTime,
      details: {
        toolCall,
        ...(toolCall.result !== undefined ? { result: toolCall.result } : {}),
        ...(error ? { error } : {}),
      },
    };
  });
  return [
    ...(reasoning ? [{
      id: `${attempt?.id ?? message.id}:reasoning:0`,
      kind: 'thinking' as const,
      status: 'complete' as const,
      completedAt: timestamp,
      details: { reasoning },
    }] : []),
    ...calls,
  ];
};

const shouldRender = (
  message: CanonicalMessage,
  text: string,
  media: MediaAttachment[],
  activity: AssistantActivityItem[],
): boolean => {
  if (isInternalMessageMetadata(message.metadata)) return false;
  if (message.sender.participantType === 'tool') return media.length > 0;
  return Boolean(text.trim() || getRoutingMessageFromMetadata(message.metadata) || media.length || activity.length);
};

const projectMessage = (
  message: CanonicalMessage,
  attempts: Map<string, CanonicalLlmAttempt>,
  executions: CanonicalToolExecution[],
  content: Map<string, CanonicalResolvedContent>,
  options: MessageContractOptions,
): InternalChatMessage | null => {
  const timestamp = canonicalTimestamp(message.createdAt, options.now ?? defaultNow);
  const text = bodyText(message.content, content) || getRoutingMessageFromMetadata(message.metadata) || '';
  const media = attachments(message.content, content);
  const attempt = findAttempt(message, attempts);
  const activity = activityItems(message, attempt, executions, content, timestamp);
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
    sender: resolveCanonicalParticipantSender(message.sender, options.senderOptions),
  };
};

const toolResultUpdate = (
  message: CanonicalMessage,
  execution: CanonicalToolExecution,
  content: Map<string, CanonicalResolvedContent>,
  now: () => number,
): ToolResultUpdate => {
  const workflow = workflowMetadata(message.metadata);
  const result = executionOutput(execution, content);
  const error = executionError(execution);
  return {
    id: execution.toolCallId,
    toolExecutionId: execution.id,
    ...(typeof workflow.sourceMessageId === 'string' ? { sourceMessageId: workflow.sourceMessageId } : {}),
    name: toolName(execution.tool, execution.toolCallId),
    status: toolStatus(execution),
    ...(result !== undefined ? { result } : {}),
    ...(error ? { error } : {}),
    endTime: canonicalTimestamp(execution.finishedAt ?? message.createdAt, now),
  };
};

/** Pure projection from the canonical Copilotz history document into chat UI state. */
export const projectCanonicalMessageHistory = (
  page: CanonicalMessagePage,
  options: MessageContractOptions = {},
): HydratedMessageBatch => {
  const content = contentMap(page.included.content);
  const attempts = new Map(page.included.llmAttempts.map((attempt) => [attempt.id, attempt]));
  const executions = page.included.toolExecutions;
  const executionsById = new Map(executions.map((execution) => [execution.id, execution]));
  const now = options.now ?? defaultNow;
  const ordered = [...page.data].sort((left, right) => (
    left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id)
  ));
  const toolResultUpdates = ordered.flatMap((message) => {
    if (message.sender.participantType !== 'tool') return [];
    const id = workflowMetadata(message.metadata).toolExecutionId;
    const execution = typeof id === 'string' ? executionsById.get(id) : undefined;
    if (!execution) return [];
    const output = executionOutput(execution, content);
    if (isRecord(output)) options.onToolOutput?.(output);
    return [toolResultUpdate(message, execution, content, now)];
  });
  const viewMessages = ordered.flatMap((message) => {
    const projected = projectMessage(message, attempts, executions, content, options);
    return projected ? [projected] : [];
  });
  return { viewMessages, toolResultUpdates };
};
