import type {
  AssistantActivityItem,
  ChatMessage as ChatViewMessage,
  ToolCallDraftSnapshot,
} from '@copilotz/chat-ui';
// @ts-expect-error Direct Node TypeScript tests require the source extension.
import { applyAssistantToolResult, type InternalChatMessage } from './activity.ts';
import {
  ContractViolation,
  expectRecord,
  expectString,
  expectStringValue,
  isRecord,
  // @ts-expect-error Direct Node TypeScript tests require the source extension.
} from './contract.ts';

export type ToolCallStatus = 'pending' | 'running' | 'completed' | 'failed';

export type ParsedToolCall = {
  id?: string;
  toolExecutionId?: string;
  name: string;
  arguments: Record<string, unknown>;
  status: ToolCallStatus;
  result?: unknown;
  error?: string;
};

export type ParsedToolCallDelta = {
  llmAttemptId: string;
  draftId: string;
  callIndex: number;
  sequence: number;
  toolName: string;
  phase: 'start' | 'delta' | 'complete' | 'discarded';
  delta: string;
  toolCallId?: string;
};

export type ToolResultUpdate = {
  id?: string;
  toolExecutionId?: string;
  sourceMessageId?: string;
  name?: string;
  status: ToolCallStatus;
  result?: unknown;
  error?: string;
  endTime: number;
};

export type ParsedToolOutputDelta = {
  id: string;
  toolExecutionId: string;
  name?: string;
  channel: string;
  mode: 'append' | 'replace';
  delta: unknown;
  sequence: number;
  mediaType?: string;
};

export type ParsedToolExecutionLifecycle = {
  id: string;
  toolExecutionId: string;
  name?: string;
  status: ToolCallStatus;
  error?: string;
  terminal: boolean;
  endTime?: number;
};

const fail = (message: string): never => {
  throw new ContractViolation(message);
};

const expectNonNegativeInteger = (value: unknown, path: string): number => {
  if (!Number.isInteger(value) || (value as number) < 0) {
    return fail(`${path} must be a non-negative integer`);
  }
  return value as number;
};

const expectToolCallDeltaPhase = (
  value: unknown,
  path: string,
): ParsedToolCallDelta['phase'] => {
  if (value === 'start' || value === 'delta' || value === 'complete' || value === 'discarded') {
    return value;
  }
  return fail(`${path} must be start, delta, complete, or discarded`);
};

export const expectToolStatus = (status: unknown, path: string): ToolCallStatus => {
  if (status === 'pending') return 'pending';
  if (status === 'running' || status === 'processing') return 'running';
  if (status === 'failed') return 'failed';
  if (status === 'cancelled') return 'failed';
  if (status === 'completed') return 'completed';
  return fail(`${path} must be pending, running, processing, completed, failed, or cancelled`);
};

const formatToolError = (error: unknown): string | undefined => {
  if (error === undefined) return undefined;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
};

const expectToolArguments = (
  value: unknown,
  path: string,
): Record<string, unknown> => {
  if (isRecord(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return expectRecord(parsed, path);
    } catch {
      return fail(`${path} must be an object or JSON object string`);
    }
  }
  return fail(`${path} must be an object or JSON object string`);
};

const expectToolName = (tool: Record<string, unknown>, path: string): string => {
  const name = typeof tool.name === 'string' && tool.name.trim().length > 0
    ? tool.name
    : tool.id;
  return expectString(name, path);
};

export const matchesToolResultUpdate = (
  target: { id?: string; name?: string },
  update: Pick<ToolResultUpdate, 'id' | 'name'>,
): boolean => {
  if (update.id && target.id) {
    return update.id === target.id;
  }

  return Boolean(update.name && target.name && update.name === target.name);
};

const findMatchingToolItem = (
  toolItems: AssistantActivityItem[],
  update: ToolResultUpdate,
): AssistantActivityItem | undefined => toolItems.find((item) => (
  matchesToolResultUpdate(
    { id: item.id, name: item.toolName },
    update,
  ) &&
  (item.status === 'active' || (item.details?.result === undefined && item.details?.error === undefined))
));

export const applyToolResultUpdateToMessages = (
  messages: InternalChatMessage[],
  update: ToolResultUpdate,
  assistantPatch?: Partial<InternalChatMessage>,
): { messages: InternalChatMessage[]; matched: boolean } => {
  const nextMessages = [...messages];

  for (let i = nextMessages.length - 1; i >= 0; i--) {
    const message = nextMessages[i];
    if (update.sourceMessageId && message.id !== update.sourceMessageId) {
      continue;
    }
    const toolItems = message.activity?.items.filter((item) => item.kind === 'tool') ?? [];
    if (message.role !== 'assistant' || toolItems.length === 0) {
      continue;
    }

    const toolItem = findMatchingToolItem(toolItems, update);
    if (!toolItem) continue;

    nextMessages[i] = {
      ...applyAssistantToolResult(message, {
        ...(update.id ? { id: update.id } : {}),
        ...(update.toolExecutionId ? { toolExecutionId: update.toolExecutionId } : {}),
        name: update.name ?? toolItem.toolName ?? toolItem.id,
        status: update.status,
        ...(update.result !== undefined ? { result: update.result } : {}),
        ...(update.error !== undefined ? { error: update.error } : {}),
        endTime: update.endTime,
      }),
      ...(assistantPatch ?? {}),
    };

    return { messages: nextMessages, matched: true };
  }

  return { messages, matched: false };
};

export const extractLiveToolCall = (
  payload: Record<string, unknown> | undefined,
): ParsedToolCall => {
  const payloadRecord = expectRecord(payload, 'TOOL_CALL payload');
  const toolCall = expectRecord(payloadRecord.toolCall, 'TOOL_CALL payload.toolCall');
  const tool = expectRecord(toolCall.tool, 'TOOL_CALL payload.toolCall.tool');

  return {
    id: expectString(toolCall.id, 'TOOL_CALL payload.toolCall.id'),
    ...(typeof payloadRecord.toolExecutionId === 'string' ? { toolExecutionId: payloadRecord.toolExecutionId } : {}),
    name: expectToolName(tool, 'TOOL_CALL payload.toolCall.tool.id'),
    arguments: expectToolArguments(toolCall.args, 'TOOL_CALL payload.toolCall.args'),
    status: toolCall.status === undefined ? 'running' : expectToolStatus(toolCall.status, 'TOOL_CALL payload.toolCall.status'),
    ...(toolCall.output !== undefined ? { result: toolCall.output } : {}),
  };
};

export const extractLiveToolCallDelta = (
  payload: Record<string, unknown> | undefined,
): ParsedToolCallDelta => {
  const value = expectRecord(payload, 'TOOL_CALL_DELTA payload');
  const phase = expectToolCallDeltaPhase(value.phase, 'TOOL_CALL_DELTA payload.phase');
  const toolCallId = value.toolCallId === undefined
    ? undefined
    : expectString(value.toolCallId, 'TOOL_CALL_DELTA payload.toolCallId');
  if (phase === 'complete' && !toolCallId) {
    return fail('TOOL_CALL_DELTA payload.toolCallId is required on complete');
  }

  return {
    llmAttemptId: expectString(value.llmAttemptId, 'TOOL_CALL_DELTA payload.llmAttemptId'),
    draftId: expectString(value.draftId, 'TOOL_CALL_DELTA payload.draftId'),
    callIndex: expectNonNegativeInteger(value.callIndex, 'TOOL_CALL_DELTA payload.callIndex'),
    sequence: expectNonNegativeInteger(value.sequence, 'TOOL_CALL_DELTA payload.sequence'),
    toolName: expectString(value.toolName, 'TOOL_CALL_DELTA payload.toolName'),
    phase,
    delta: expectStringValue(value.delta, 'TOOL_CALL_DELTA payload.delta'),
    ...(toolCallId ? { toolCallId } : {}),
  };
};

export const parseCompletedToolCallDraft = (
  snapshot: ToolCallDraftSnapshot,
): ParsedToolCall => {
  if (snapshot.phase !== 'complete') {
    return fail('tool call draft must be complete');
  }
  const id = expectString(snapshot.toolCallId, 'tool call draft.toolCallId');
  let parsed: unknown;
  try {
    parsed = JSON.parse(snapshot.rawInput);
  } catch {
    return fail('tool call draft rawInput must be valid JSON');
  }
  const value = expectRecord(parsed, 'tool call draft rawInput');
  const name = expectString(value.name, 'tool call draft rawInput.name');
  if (name !== snapshot.toolName) {
    return fail('tool call draft name changed during streaming');
  }
  return {
    id,
    name,
    arguments: expectToolArguments(
      value.arguments ?? value.args,
      'tool call draft rawInput.arguments',
    ),
    status: 'running',
  };
};

export const extractToolOutputDelta = (
  event: Record<string, unknown>,
): ParsedToolOutputDelta => {
  const value = expectRecord(event.payload, 'tool_output.delta payload');
  const mode = value.mode;
  if (mode !== 'append' && mode !== 'replace') {
    return fail('tool_output.delta payload.mode must be append or replace');
  }
  const mediaType = value.mediaType === undefined
    ? undefined
    : expectString(value.mediaType, 'tool_output.delta payload.mediaType');
  const name = expectString(value.toolId, 'tool_output.delta payload.toolId');
  return {
    id: expectString(value.toolCallId, 'tool_output.delta payload.toolCallId'),
    toolExecutionId: expectString(
      value.toolExecutionId,
      'tool_output.delta payload.toolExecutionId',
    ),
    name,
    channel: expectString(value.channel, 'tool_output.delta payload.channel'),
    mode,
    delta: value.delta,
    sequence: expectNonNegativeInteger(
      event.sequence,
      'tool_output.delta sequence',
    ),
    ...(mediaType ? { mediaType } : {}),
  };
};

export const extractToolExecutionLifecycle = (
  event: Record<string, unknown>,
  now: () => number = () => Date.now(),
): ParsedToolExecutionLifecycle => {
  const type = expectString(event.type, 'tool execution event.type');
  const value = expectRecord(event.payload, `${type} payload`);
  const status = expectToolStatus(value.status, `${type} payload.status`);
  const terminal = type === 'tool_execution.completed' ||
    type === 'tool_execution.failed' ||
    type === 'tool_execution.cancelled';
  if (type !== 'tool_execution.created' && !terminal) {
    return fail(`unsupported tool execution lifecycle '${type}'`);
  }
  const safeError = value.safeError === undefined
    ? undefined
    : expectRecord(value.safeError, `${type} payload.safeError`);
  const error = safeError === undefined
    ? undefined
    : formatToolError(safeError.message ?? safeError);
  const name = expectString(value.toolId, `${type} payload.toolId`);
  return {
    id: expectString(value.toolCallId, `${type} payload.toolCallId`),
    toolExecutionId: expectString(
      value.toolExecutionId,
      `${type} payload.toolExecutionId`,
    ),
    name,
    status,
    ...(error ? { error } : {}),
    terminal,
    ...(terminal ? { endTime: now() } : {}),
  };
};

export const extractLiveToolResultUpdate = (
  payload: Record<string, unknown> | undefined,
  now: () => number = () => Date.now(),
): ToolResultUpdate => {
  const payloadRecord = expectRecord(payload, 'TOOL_RESULT payload');
  const tool = expectRecord(payloadRecord.tool, 'TOOL_RESULT payload.tool');
  const result = payloadRecord.projectedOutput !== undefined
    ? payloadRecord.projectedOutput
    : payloadRecord.output;
  const error = formatToolError(payloadRecord.error);

  return {
    id: expectString(payloadRecord.toolCallId, 'TOOL_RESULT payload.toolCallId'),
    name: expectToolName(tool, 'TOOL_RESULT payload.tool.id'),
    status: expectToolStatus(payloadRecord.status, 'TOOL_RESULT payload.status'),
    ...(result !== undefined ? { result } : {}),
    ...(error !== undefined ? { error } : {}),
    endTime: now(),
  };
};

export const mergePersistedToolResults = (
  messages: InternalChatMessage[],
  updates: ToolResultUpdate[],
): InternalChatMessage[] => {
  if (updates.length === 0) return messages;

  let nextMessages = messages;
  for (const update of updates) {
    nextMessages = applyToolResultUpdateToMessages(nextMessages, update).messages;
  }

  return nextMessages;
};

export const prependUniqueMessages = (
  olderMessages: InternalChatMessage[],
  currentMessages: InternalChatMessage[],
): InternalChatMessage[] => {
  if (olderMessages.length === 0) return currentMessages;
  if (currentMessages.length === 0) return olderMessages;

  const seen = new Set<string>();
  const combined: InternalChatMessage[] = [];

  for (const message of [...olderMessages, ...currentMessages]) {
    if (seen.has(message.id)) continue;
    seen.add(message.id);
    combined.push(message);
  }

  return combined;
};

export const messageAgentKey = (message: ChatViewMessage): string | null => {
  if (message.role !== 'assistant') return null;
  if (message.sender?.type === 'agent' || message.sender?.type === 'tool' || message.sender?.type === 'job') {
    return message.sender.agentId ?? message.sender.id;
  }
  return null;
};

export const canAttachToStreamingAssistant = (
  message: ChatViewMessage | undefined,
  incomingAgentKey: string | null,
): boolean => {
  if (!message || message.role !== 'assistant' || !message.isStreaming) {
    return false;
  }

  const currentAgentKey = messageAgentKey(message);
  return !incomingAgentKey || !currentAgentKey || currentAgentKey === incomingAgentKey;
};
