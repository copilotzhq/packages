import type { ChatSender, ToolCall } from '@copilotz/chat-ui';
// @ts-expect-error Direct Node TypeScript tests require the source extension.
import {
  appendAssistantToolCall,
  appendAssistantToolDraft,
  applyAssistantToolOutput,
  applyAssistantToolResult,
  bindAssistantToolExecution,
  failAssistantMessage,
  finalizeAssistantMessage,
  reconcileAssistantToolDraft,
  removeAssistantToolDraft,
  type AssistantToolOutputUpdate,
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
  attemptsById: Map<string, AttemptCursor>;
  toolMessageByCallId: Map<string, string>;
  toolExecutionByCallId: Map<string, string>;
  toolCallByExecutionId: Map<string, string>;
  settledToolCallIds: Set<string>;
  pendingToolResultsByCallId: Map<string, ToolResultUpdate>;
  pendingToolOutputsByCallId: Map<string, AssistantToolOutputUpdate[]>;
  draftMessageById: Map<string, string>;
  draftIdByCallId: Map<string, string>;
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
    type: 'attempt-failed';
    attemptId: string;
    message: string;
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
    type: 'tool-execution-start';
    attemptId?: string | null;
    id: string;
    toolExecutionId: string;
    name?: string;
    sender?: ChatSender;
    at: number;
  }
  | {
    type: 'tool-output';
    update: AssistantToolOutputUpdate;
  }
  | {
    type: 'tool-draft-start';
    attemptId: string;
    draftId: string;
    toolName: string;
    sender?: ChatSender;
    at: number;
  }
  | {
    type: 'tool-draft-complete';
    draftId: string;
    toolCallId: string;
  }
  | {
    type: 'tool-draft-discard';
    draftId: string;
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
    type: 'fail-attempt';
    messageId: string;
    message: string;
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
    type: 'append-tool-draft';
    messageId: string;
    draftId: string;
    toolName: string;
    sender?: ChatSender;
    at: number;
  }
  | {
    type: 'reconcile-tool-draft';
    messageId: string;
    draftId: string;
    toolCall: ToolCall;
    sender?: ChatSender;
    at: number;
  }
  | {
    type: 'remove-tool-draft';
    messageId: string;
    draftId: string;
  }
  | {
    type: 'resolve-tool';
    messageId: string;
    update: ToolResultUpdate;
  }
  | {
    type: 'bind-tool-execution';
    messageId: string;
    id: string;
    toolExecutionId: string;
    name?: string;
  }
  | {
    type: 'apply-tool-output';
    messageId: string;
    update: AssistantToolOutputUpdate;
  };

type TransitionOptions = {
  createId: () => string;
};

const copyState = (state: LiveRunState): LiveRunState => ({
  ...state,
  attemptsById: new Map(state.attemptsById),
  toolMessageByCallId: new Map(state.toolMessageByCallId),
  toolExecutionByCallId: new Map(state.toolExecutionByCallId),
  toolCallByExecutionId: new Map(state.toolCallByExecutionId),
  settledToolCallIds: new Set(state.settledToolCallIds),
  pendingToolResultsByCallId: new Map(state.pendingToolResultsByCallId),
  pendingToolOutputsByCallId: new Map(
    [...state.pendingToolOutputsByCallId].map(([id, updates]) => [
      id,
      [...updates],
    ]),
  ),
  draftMessageById: new Map(state.draftMessageById),
  draftIdByCallId: new Map(state.draftIdByCallId),
});

export const createLiveRunState = (initialMessageId: string): LiveRunState => ({
  initialMessageId,
  initialMessageClaimed: false,
  attemptsById: new Map(),
  toolMessageByCallId: new Map(),
  toolExecutionByCallId: new Map(),
  toolCallByExecutionId: new Map(),
  settledToolCallIds: new Set(),
  pendingToolResultsByCallId: new Map(),
  pendingToolOutputsByCallId: new Map(),
  draftMessageById: new Map(),
  draftIdByCallId: new Map(),
});

export const selectLiveRunSender = (
  state: LiveRunState,
  attemptId: string,
  incoming: ChatSender | undefined,
  fallback: ChatSender | undefined,
): ChatSender | undefined =>
  incoming ?? state.attemptsById.get(attemptId)?.sender ?? fallback;

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
    return { state: next, cursor, operations: [] };
  }

  const next = copyState(state);
  const messageId = next.initialMessageClaimed
    ? options.createId()
    : next.initialMessageId;
  const cursor = { messageId, sender };
  next.initialMessageClaimed = true;
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
    const cursor = state.attemptsById.get(action.attemptId);
    if (!cursor) return { state, operations: [] };
    return {
      state,
      operations: [{
        type: 'finalize-attempt',
        messageId: cursor.messageId,
        answer: action.answer,
        at: action.at,
      }],
    };
  }

  if (action.type === 'attempt-failed') {
    const cursor = state.attemptsById.get(action.attemptId);
    if (!cursor) return { state, operations: [] };
    return {
      state,
      operations: [
        {
          type: 'fail-attempt',
          messageId: cursor.messageId,
          message: action.message,
          at: action.at,
        },
      ],
    };
  }

  if (action.type === 'tool-draft-start') {
    if (state.draftMessageById.has(action.draftId)) {
      return { state, operations: [] };
    }
    const ensured = ensureAttempt(
      state,
      action.attemptId,
      action.sender,
      action.at,
      options,
    );
    const next = copyState(ensured.state);
    next.draftMessageById.set(action.draftId, ensured.cursor.messageId);
    return {
      state: next,
      operations: [
        ...ensured.operations,
        {
          type: 'append-tool-draft',
          messageId: ensured.cursor.messageId,
          draftId: action.draftId,
          toolName: action.toolName,
          sender: action.sender ?? ensured.cursor.sender,
          at: action.at,
        },
      ],
    };
  }

  if (action.type === 'tool-draft-complete') {
    if (!state.draftMessageById.has(action.draftId)) {
      return { state, operations: [] };
    }
    const next = copyState(state);
    next.draftIdByCallId.set(action.toolCallId, action.draftId);
    return { state: next, operations: [] };
  }

  if (action.type === 'tool-draft-discard') {
    const messageId = state.draftMessageById.get(action.draftId);
    if (!messageId) return { state, operations: [] };
    const next = copyState(state);
    next.draftMessageById.delete(action.draftId);
    for (const [toolCallId, draftId] of next.draftIdByCallId) {
      if (draftId === action.draftId) next.draftIdByCallId.delete(toolCallId);
    }
    return {
      state: next,
      operations: [{
        type: 'remove-tool-draft',
        messageId,
        draftId: action.draftId,
      }],
    };
  }

  if (action.type === 'tool-call') {
    if (state.settledToolCallIds.has(action.toolCall.id)) {
      return { state, operations: [] };
    }
    const existingMessageId = state.toolMessageByCallId.get(action.toolCall.id);
    if (existingMessageId) {
      const toolExecutionId = state.toolExecutionByCallId.get(
        action.toolCall.id,
      );
      return {
        state,
        operations: [{
          type: 'append-tool',
          messageId: existingMessageId,
          toolCall: {
            ...action.toolCall,
            ...(toolExecutionId ? { toolExecutionId } : {}),
          },
          sender: action.sender,
          at: action.at,
        }],
      };
    }
    const draftId = state.draftIdByCallId.get(action.toolCall.id);
    const draftMessageId = draftId
      ? state.draftMessageById.get(draftId)
      : undefined;
    const attemptId = action.attemptId ?? `tool-attempt:${action.toolCall.id}`;
    const ensured = draftMessageId
      ? {
        state,
        cursor: {
          messageId: draftMessageId,
          sender: action.sender,
        },
        operations: [] as LiveRunOperation[],
      }
      : ensureAttempt(
        state,
        attemptId,
        action.sender,
        action.at,
        options,
      );
    const next = copyState(ensured.state);
    const knownExecutionId = next.toolExecutionByCallId.get(action.toolCall.id);
    const toolCall = knownExecutionId
      ? { ...action.toolCall, toolExecutionId: knownExecutionId }
      : action.toolCall;
    next.toolMessageByCallId.set(action.toolCall.id, ensured.cursor.messageId);
    if (draftId) {
      next.draftMessageById.delete(draftId);
      next.draftIdByCallId.delete(action.toolCall.id);
    }
    const pendingResult = next.pendingToolResultsByCallId.get(action.toolCall.id);
    if (pendingResult) {
      next.pendingToolResultsByCallId.delete(action.toolCall.id);
      next.settledToolCallIds.add(action.toolCall.id);
    }
    const pendingOutputs = next.pendingToolOutputsByCallId.get(
      action.toolCall.id,
    ) ?? [];
    next.pendingToolOutputsByCallId.delete(action.toolCall.id);
    return {
      state: next,
      operations: [
        ...ensured.operations,
        draftId
          ? {
            type: 'reconcile-tool-draft' as const,
            messageId: ensured.cursor.messageId,
            draftId,
            toolCall,
            sender: action.sender ?? ensured.cursor.sender,
            at: action.at,
          }
          : {
            type: 'append-tool' as const,
            messageId: ensured.cursor.messageId,
            toolCall,
            sender: action.sender ?? ensured.cursor.sender,
            at: action.at,
          },
        ...pendingOutputs.map((update) => ({
          type: 'apply-tool-output' as const,
          messageId: ensured.cursor.messageId,
          update,
        })),
        ...(pendingResult ? [{
          type: 'resolve-tool' as const,
          messageId: ensured.cursor.messageId,
          update: pendingResult,
        }] : []),
      ],
    };
  }

  if (action.type === 'tool-execution-start') {
    const next = copyState(state);
    next.toolExecutionByCallId.set(action.id, action.toolExecutionId);
    next.toolCallByExecutionId.set(action.toolExecutionId, action.id);
    const messageId = next.toolMessageByCallId.get(action.id);
    if (messageId) {
      return {
        state: next,
        operations: [{
          type: 'bind-tool-execution',
          messageId,
          id: action.id,
          toolExecutionId: action.toolExecutionId,
          ...(action.name ? { name: action.name } : {}),
        }],
      };
    }
    return { state: next, operations: [] };
  }

  if (action.type === 'tool-output') {
    const callId = action.update.id ||
      state.toolCallByExecutionId.get(action.update.toolExecutionId);
    if (!callId || state.settledToolCallIds.has(callId)) {
      return { state, operations: [] };
    }
    const messageId = state.toolMessageByCallId.get(callId);
    if (!messageId) {
      const next = copyState(state);
      const pending = next.pendingToolOutputsByCallId.get(callId) ?? [];
      next.pendingToolOutputsByCallId.set(callId, [...pending, {
        ...action.update,
        id: callId,
      }]);
      return { state: next, operations: [] };
    }
    return {
      state,
      operations: [{
        type: 'apply-tool-output',
        messageId,
        update: { ...action.update, id: callId },
      }],
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
  const next = copyState(state);
  next.settledToolCallIds.add(action.update.id);
  return {
    state: next,
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
  } else if (operation.type === 'fail-attempt') {
    updated = failAssistantMessage(current, operation.message, operation.at);
  } else if (operation.type === 'append-tool') {
    updated = {
      ...appendAssistantToolCall(current, {
        ...operation.toolCall,
        startTime: operation.toolCall.startTime ?? operation.at,
      }),
      ...(operation.sender ? { sender: operation.sender } : {}),
    };
  } else if (operation.type === 'append-tool-draft') {
    updated = {
      ...appendAssistantToolDraft(current, {
        draftId: operation.draftId,
        toolName: operation.toolName,
        startedAt: operation.at,
      }),
      ...(operation.sender ? { sender: operation.sender } : {}),
    };
  } else if (operation.type === 'reconcile-tool-draft') {
    updated = {
      ...reconcileAssistantToolDraft(
        current,
        operation.draftId,
        {
          ...operation.toolCall,
          startTime: operation.toolCall.startTime ?? operation.at,
        },
      ),
      ...(operation.sender ? { sender: operation.sender } : {}),
    };
  } else if (operation.type === 'remove-tool-draft') {
    updated = removeAssistantToolDraft(current, operation.draftId);
  } else if (operation.type === 'bind-tool-execution') {
    updated = bindAssistantToolExecution(current, {
      id: operation.id,
      toolExecutionId: operation.toolExecutionId,
      ...(operation.name ? { name: operation.name } : {}),
    });
  } else if (operation.type === 'apply-tool-output') {
    updated = applyAssistantToolOutput(current, operation.update);
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
  return state.initialMessageId;
};
