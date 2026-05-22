import type { AssistantActivityItem, ChatMessage as ChatViewMessage } from '@copilotz/chat-ui';
import { applyAssistantToolResult, type InternalChatMessage } from './activity.ts';
import {
  ContractViolation,
  expectRecord,
  expectString,
  expectStringValue,
  isRecord,
} from './contract.ts';
import type { RestMessage } from './copilotzService.ts';

export type ToolCallStatus = 'pending' | 'running' | 'completed' | 'failed';

export type ParsedToolCall = {
  id?: string;
  name: string;
  arguments: Record<string, unknown>;
  status: ToolCallStatus;
  result?: unknown;
};

export type ToolResultUpdate = {
  id?: string;
  name?: string;
  status: ToolCallStatus;
  result?: unknown;
  endTime: number;
};

const fail = (message: string): never => {
  throw new ContractViolation(message);
};

export const expectToolStatus = (status: unknown, path: string): ToolCallStatus => {
  if (status === 'pending') return 'pending';
  if (status === 'running' || status === 'processing') return 'running';
  if (status === 'failed') return 'failed';
  if (status === 'completed') return 'completed';
  return fail(`${path} must be pending, running, processing, completed, or failed`);
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
  (item.status === 'active' || item.details?.result === undefined)
));

export const applyToolResultUpdateToMessages = (
  messages: InternalChatMessage[],
  update: ToolResultUpdate,
  assistantPatch?: Partial<InternalChatMessage>,
): { messages: InternalChatMessage[]; matched: boolean } => {
  const nextMessages = [...messages];

  for (let i = nextMessages.length - 1; i >= 0; i--) {
    const message = nextMessages[i];
    const toolItems = message.activity?.items.filter((item) => item.kind === 'tool') ?? [];
    if (message.role !== 'assistant' || toolItems.length === 0) {
      continue;
    }

    const toolItem = findMatchingToolItem(toolItems, update);
    if (!toolItem) continue;

    nextMessages[i] = {
      ...applyAssistantToolResult(message, {
        ...(update.id ? { id: update.id } : {}),
        name: update.name ?? toolItem.toolName ?? toolItem.id,
        status: update.status,
        ...(update.result !== undefined ? { result: update.result } : {}),
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
    name: expectToolName(tool, 'TOOL_CALL payload.toolCall.tool.id'),
    arguments: expectToolArguments(toolCall.args, 'TOOL_CALL payload.toolCall.args'),
    status: toolCall.status === undefined ? 'running' : expectToolStatus(toolCall.status, 'TOOL_CALL payload.toolCall.status'),
    ...(toolCall.output !== undefined ? { result: toolCall.output } : {}),
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
  if (result === undefined) fail('TOOL_RESULT payload requires output or projectedOutput');

  return {
    id: expectString(payloadRecord.toolCallId, 'TOOL_RESULT payload.toolCallId'),
    name: expectToolName(tool, 'TOOL_RESULT payload.tool.id'),
    status: expectToolStatus(payloadRecord.status, 'TOOL_RESULT payload.status'),
    result,
    endTime: now(),
  };
};

export const extractToolCallsFromServerMessage = (msg: RestMessage): ParsedToolCall[] => {
  const metadata = msg.metadata === null || msg.metadata === undefined
    ? undefined
    : expectRecord(msg.metadata, 'message.metadata');
  const topLevelToolCalls = readToolCallArray(msg.toolCalls, 'message.toolCalls');
  const metadataToolCalls = readToolCallArray(metadata?.toolCalls, 'message.metadata.toolCalls');

  const usedMetadataIndexes = new Set<number>();
  const parsed: ParsedToolCall[] = [];

  const findMatchingMetadataIndex = (toolCall: Record<string, unknown>): number => {
    const id = expectString(toolCall.id, 'message.toolCalls[].id');
    return metadataToolCalls.findIndex((candidate, idx) =>
      !usedMetadataIndexes.has(idx) && candidate.id === id
    );
  };

  const parseToolCall = (
    primary: Record<string, unknown>,
    secondary?: Record<string, unknown>,
  ): ParsedToolCall => {
    const id = expectString(primary.id ?? secondary?.id, 'toolCall.id');
    const tool = expectRecord(primary.tool ?? secondary?.tool, 'toolCall.tool');
    const name = expectToolName(tool, 'toolCall.tool.id');
    const argsRaw = primary.args ?? secondary?.args;
    const result = primary.output !== undefined
      ? primary.output
      : secondary?.output !== undefined
        ? secondary.output
        : primary.projectedOutput !== undefined
          ? primary.projectedOutput
          : secondary?.projectedOutput;
    const rawStatus = primary.status ?? secondary?.status;

    return {
      id,
      name,
      arguments: expectToolArguments(argsRaw, 'toolCall.args'),
      ...(result !== undefined ? { result } : {}),
      status: rawStatus === undefined ? 'running' : expectToolStatus(rawStatus, 'toolCall.status'),
    };
  };

  topLevelToolCalls.forEach((toolCall) => {
    const metadataIndex = findMatchingMetadataIndex(toolCall);
    const metadataCall = metadataIndex >= 0 ? metadataToolCalls[metadataIndex] : undefined;
    if (metadataIndex >= 0) usedMetadataIndexes.add(metadataIndex);
    parsed.push(parseToolCall(toolCall, metadataCall));
  });

  metadataToolCalls.forEach((toolCall, index) => {
    if (usedMetadataIndexes.has(index)) return;
    parsed.push(parseToolCall(toolCall));
  });

  return parsed;
};

const readToolCallArray = (
  value: unknown,
  path: string,
): Record<string, unknown>[] => {
  if (value === null || value === undefined) return [];
  if (!Array.isArray(value)) fail(`${path} must be an array`);
  return value.map((toolCall, index) => expectRecord(toolCall, `${path}[${index}]`));
};

export const extractToolResultUpdateFromMessage = (
  msg: RestMessage,
  now: () => number = () => Date.now(),
): ToolResultUpdate | null => {
  if (msg.senderType !== 'tool') return null;

  const toolCalls = extractToolCallsFromServerMessage(msg);
  if (toolCalls.length === 0) fail('tool message requires metadata.toolCalls');

  const firstToolCall = toolCalls[0];
  if (firstToolCall.result === undefined) fail('tool result message requires tool call output');
  expectStringValue(msg.createdAt, 'tool result message.createdAt');

  return {
    id: firstToolCall.id,
    name: firstToolCall.name,
    result: firstToolCall.result,
    status: firstToolCall.status,
    endTime: new Date(msg.createdAt).getTime(),
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
