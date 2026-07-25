import type { ChatSender, ToolCall } from '@copilotz/chat-ui';
// @ts-expect-error Direct Node TypeScript tests require the source extension.
import {
  appendAssistantToolCall,
  applyAssistantToolResult,
  finalizeAssistantMessage,
  type InternalChatMessage,
  updateAssistantMessageToken,
} from './activity.ts';
// @ts-expect-error Direct Node TypeScript tests require the source extension.
import { LLM_ATTEMPT_ID_METADATA_KEY } from './messageReconciliation.ts';
import type { ToolResultUpdate } from './toolActivity.ts';

type AttemptCursor = {
  messageId: string;
  sender?: ChatSender;
};

export type LiveRunState = {
  initialMessageId: string;
  initialMessageClaimed: boolean;
  activeAttemptId: string | null;
  lastAttemptId: string | null;
  attemptsById: Map<string, AttemptCursor>;
  toolMessageByCallId: Map<string, string>;
  pendingToolResultsByCallId: Map<string, ToolResultUpdate>;
};

export type LiveRunAction =
  | {
    type: 'attempt-start';
    attemptId: string;
    sender?: ChatSender;
    at: number;
  }
  | {
    type: 'token';
    attemptId: string;
    phaseId: string;
    partial: string;
    isReasoning: boolean;
    sender?: ChatSender;
    at: number;
  }
  | {
    type: 'attempt-result';
    attemptId: string;
    answer?: string;
    at: number;
  }
  | {
    type: 'tool-call';
    attemptId?: string | null;
    toolCall: ToolCall;
    sender?: ChatSender;
    at: number;
  }
  | {
    type: 'tool-result';
    update: ToolResultUpdate;
  };

export type LiveRunOperation =
  | {
    type: 'ensure-attempt';
    messageId: string;
    attemptId: string;
    sender?: ChatSender;
    at: number;
  }
  | {
    type: 'update-token';
    messageId: string;
    phaseId: string;
    partial: string;
    isReasoning: boolean;
    sender?: ChatSender;
    at: number;
  }
  | {
    type: 'finalize-attempt';
    messageId: string;
    answer?: string;
    at: number;
  }
  | {
    type: 'append-tool';
    messageId: string;
    toolCall: ToolCall;
    sender?: ChatSender;
    at: number;
  }
  | {
    type: 'resolve-tool';
    messageId: string;
    update: ToolResultUpdate;
  };

type TransitionOptions = {
  createId: () => string;
};

const copyState = (state: LiveRunState): LiveRunState => ({
  ...state,
  attemptsById: new Map(state.attemptsById),
  toolMessageByCallId: new Map(state.toolMessageByCallId),
  pendingToolResultsByCallId: new Map(state.pendingToolResultsByCallId),
});

export const createLiveRunState = (initialMessageId: string): LiveRunState => ({
  initialMessageId,
  initialMessageClaimed: false,
  activeAttemptId: null,
  lastAttemptId: null,
  attemptsById: new Map(),
  toolMessageByCallId: new Map(),
  pendingToolResultsByCallId: new Map(),
});

const ensureAttempt = (
  state: LiveRunState,
  attemptId: string,
  sender: ChatSender | undefined,
  at: number,
  options: TransitionOptions,
): { state: LiveRunState; cursor: AttemptCursor; operations: LiveRunOperation[] } => {
  const existing = state.attemptsById.get(attemptId);
  if (existing) {
    const next = copyState(state);
    const cursor = sender && existing.sender !== sender
      ? { ...existing, sender }
      : existing;
    next.attemptsById.set(attemptId, cursor);
    next.activeAttemptId = attemptId;
    next.lastAttemptId = attemptId;
    return { state: next, cursor, operations: [] };
  }

  const next = copyState(state);
  const messageId = next.initialMessageClaimed
    ? options.createId()
    : next.initialMessageId;
  const cursor = { messageId, sender };
  next.initialMessageClaimed = true;
  next.activeAttemptId = attemptId;
  next.lastAttemptId = attemptId;
  next.attemptsById.set(attemptId, cursor);
  return {
    state: next,
    cursor,
    operations: [{
      type: 'ensure-attempt',
      messageId,
      attemptId,
      sender,
      at,
    }],
  };
};

export const transitionLiveRun = (
  state: LiveRunState,
  action: LiveRunAction,
  options: TransitionOptions,
): { state: LiveRunState; operations: LiveRunOperation[] } => {
  if (action.type === 'attempt-start') {
    const ensured = ensureAttempt(
      state,
      action.attemptId,
      action.sender,
      action.at,
      options,
    );
    return { state: ensured.state, operations: ensured.operations };
  }

  if (action.type === 'token') {
    const ensured = ensureAttempt(
      state,
      action.attemptId,
      action.sender,
      action.at,
      options,
    );
    return {
      state: ensured.state,
      operations: [
        ...ensured.operations,
        {
          type: 'update-token',
          messageId: ensured.cursor.messageId,
          phaseId: action.phaseId,
          partial: action.partial,
          isReasoning: action.isReasoning,
          sender: action.sender ?? ensured.cursor.sender,
          at: action.at,
        },
      ],
    };
  }

  if (action.type === 'attempt-result') {
    const resolvedAttemptId = state.attemptsById.has(action.attemptId)
      ? action.attemptId
      : state.activeAttemptId ?? state.lastAttemptId;
    const cursor = resolvedAttemptId
      ? state.attemptsById.get(resolvedAttemptId)
      : undefined;
    if (!cursor) return { state, operations: [] };
    const next = copyState(state);
    if (next.activeAttemptId === resolvedAttemptId) {
      next.activeAttemptId = null;
    }
    next.lastAttemptId = resolvedAttemptId;
    return {
      state: next,
      operations: [{
        type: 'finalize-attempt',
        messageId: cursor.messageId,
        answer: action.answer,
        at: action.at,
      }],
    };
  }

  if (action.type === 'tool-call') {
    if (state.toolMessageByCallId.has(action.toolCall.id)) {
      return { state, operations: [] };
    }
    const attemptId = action.attemptId ?? state.activeAttemptId ?? state.lastAttemptId ??
      `tool-attempt:${action.toolCall.id}`;
    const ensured = ensureAttempt(
      state,
      attemptId,
      action.sender,
      action.at,
      options,
    );
    const next = copyState(ensured.state);
    next.toolMessageByCallId.set(action.toolCall.id, ensured.cursor.messageId);
    const pendingResult = next.pendingToolResultsByCallId.get(action.toolCall.id);
    if (pendingResult) {
      next.pendingToolResultsByCallId.delete(action.toolCall.id);
    }
    return {
      state: next,
      operations: [
        ...ensured.operations,
        {
          type: 'append-tool',
          messageId: ensured.cursor.messageId,
          toolCall: action.toolCall,
          sender: action.sender ?? ensured.cursor.sender,
          at: action.at,
        },
        ...(pendingResult ? [{
          type: 'resolve-tool' as const,
          messageId: ensured.cursor.messageId,
          update: pendingResult,
        }] : []),
      ],
    };
  }

  const messageId = action.update.id
    ? state.toolMessageByCallId.get(action.update.id)
    : undefined;
  if (!messageId || !action.update.id) {
    if (!action.update.id) return { state, operations: [] };
    const next = copyState(state);
    next.pendingToolResultsByCallId.set(action.update.id, action.update);
    return { state: next, operations: [] };
  }
  return {
    state,
    operations: [{ type: 'resolve-tool', messageId, update: action.update }],
  };
};

const applyOperation = (
  messages: InternalChatMessage[],
  operation: LiveRunOperation,
): InternalChatMessage[] => {
  const index = messages.findIndex((message) => message.id === operation.messageId);

  if (operation.type === 'ensure-attempt') {
    if (index >= 0) {
      const current = messages[index];
      const nextMessage: InternalChatMessage = {
        ...current,
        metadata: {
          ...(current.metadata ?? {}),
          [LLM_ATTEMPT_ID_METADATA_KEY]: operation.attemptId,
        },
        ...(operation.sender ? { sender: operation.sender } : {}),
      };
      if (
        current.metadata?.[LLM_ATTEMPT_ID_METADATA_KEY] === operation.attemptId &&
        (!operation.sender || current.sender === operation.sender)
      ) return messages;
      const next = [...messages];
      next[index] = nextMessage;
      return next;
    }
    return [
      ...messages,
      {
        id: operation.messageId,
        role: 'assistant',
        content: '',
        timestamp: operation.at,
        isStreaming: true,
        isComplete: false,
        metadata: { [LLM_ATTEMPT_ID_METADATA_KEY]: operation.attemptId },
        activity: {
          items: [{
            id: `${operation.messageId}:pending`,
            kind: 'answering',
            status: 'active',
            startedAt: operation.at,
          }],
        },
        ...(operation.sender ? { sender: operation.sender } : {}),
      },
    ];
  }

  if (index < 0) return messages;
  const current = messages[index];
  let updated: InternalChatMessage;

  if (operation.type === 'update-token') {
    updated = {
      ...updateAssistantMessageToken(current, {
        partial: operation.partial,
        isReasoning: operation.isReasoning,
        activityId: operation.phaseId,
        at: operation.at,
      }),
      ...(operation.sender ? { sender: operation.sender } : {}),
    };
  } else if (operation.type === 'finalize-attempt') {
    updated = finalizeAssistantMessage(current, operation.answer, operation.at);
  } else if (operation.type === 'append-tool') {
    updated = {
      ...appendAssistantToolCall(current, {
        ...operation.toolCall,
        startTime: operation.toolCall.startTime ?? operation.at,
      }),
      ...(operation.sender ? { sender: operation.sender } : {}),
    };
  } else {
    const toolItem = current.activity?.items.find((item) => (
      item.kind === 'tool' && item.id === operation.update.id
    ));
    if (!toolItem) return messages;
    updated = applyAssistantToolResult(current, {
      ...(operation.update.id ? { id: operation.update.id } : {}),
      ...(operation.update.toolExecutionId
        ? { toolExecutionId: operation.update.toolExecutionId }
        : {}),
      name: operation.update.name ?? toolItem.toolName ?? toolItem.id,
      status: operation.update.status,
      ...(operation.update.result !== undefined
        ? { result: operation.update.result }
        : {}),
      ...(operation.update.error !== undefined
        ? { error: operation.update.error }
        : {}),
      endTime: operation.update.endTime,
    });
    const hasActiveTool = updated.activity?.items.some((item) => (
      item.kind === 'tool' && item.status === 'active'
    )) ?? false;
    updated = {
      ...updated,
      isStreaming: hasActiveTool,
      isComplete: !hasActiveTool,
    };
  }

  if (updated === current) return messages;
  const next = [...messages];
  next[index] = updated;
  return next;
};

export const applyLiveRunOperations = (
  messages: InternalChatMessage[],
  operations: LiveRunOperation[],
): InternalChatMessage[] => operations.reduce(applyOperation, messages);

export const getLatestLiveRunMessageId = (state: LiveRunState): string => {
  const attemptId = state.activeAttemptId ?? state.lastAttemptId;
  return attemptId
    ? state.attemptsById.get(attemptId)?.messageId ?? state.initialMessageId
    : state.initialMessageId;
};
