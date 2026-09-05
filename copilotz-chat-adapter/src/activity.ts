import type {
  AssistantActivityItem,
  AssistantActivityStatus,
  ChatMessage,
  ToolCall,
  ToolOutputState
} from '@copilotz/chat-ui';

export interface InternalChatMessage extends ChatMessage {}

const getItems = (message: InternalChatMessage): AssistantActivityItem[] =>
  Array.isArray(message.activity?.items) ? message.activity.items : [];

const setItems = <T extends InternalChatMessage>(
  message: T,
  items: AssistantActivityItem[]
): T => ({
  ...message,
  activity: items.length > 0 ? { items } : undefined
});

const toolStatusToActivityStatus = (
  status: ToolCall['status']
): AssistantActivityStatus => {
  if (status === 'failed') return 'failed';
  if (status === 'completed') return 'complete';
  return 'active';
};

const upsertItem = <T extends InternalChatMessage>(
  message: T,
  item: AssistantActivityItem
): T => {
  const items = getItems(message);
  const index = items.findIndex((current) => current.id === item.id);
  if (index === -1) return setItems(message, [...items, item]);

  const next = [...items];
  next[index] = {
    ...next[index],
    ...item,
    details: {
      ...(next[index].details ?? {}),
      ...(item.details ?? {})
    }
  };
  return setItems(message, next);
};

const completeItems = <T extends InternalChatMessage>(
  message: T,
  shouldComplete: (item: AssistantActivityItem) => boolean,
  completedAt = Date.now()
): T =>
  setItems(
    message,
    getItems(message).map((item) =>
      item.status === 'active' && shouldComplete(item)
        ? { ...item, status: 'complete', completedAt }
        : item
    )
  );

const removeItems = <T extends InternalChatMessage>(
  message: T,
  shouldRemove: (item: AssistantActivityItem) => boolean
): T =>
  setItems(
    message,
    getItems(message).filter((item) => !shouldRemove(item))
  );

export const hasVisibleAssistantOutput = (
  message: InternalChatMessage
): boolean => {
  if (message.role !== 'assistant') return false;
  if (typeof message.content === 'string' && message.content.trim().length > 0)
    return true;
  if (Array.isArray(message.attachments) && message.attachments.length > 0)
    return true;
  return getItems(message).length > 0;
};

export const toPublicChatMessage = (
  message: InternalChatMessage
): ChatMessage => {
  if (message.role === 'assistant') return message;
  const { activity, ...rest } = message;
  return rest;
};

export const updateAssistantMessageToken = (
  message: InternalChatMessage,
  params: {
    partial: string;
    isReasoning?: boolean;
    activityId?: string;
    at?: number;
  }
): InternalChatMessage => {
  if (message.role !== 'assistant') return message;

  if (params.isReasoning) {
    const activityId = params.activityId ?? `${message.id}:thinking`;
    return upsertItem(
      completeItems(
        removeItems(
          {
            ...message,
            isStreaming: true,
            isComplete: false
          },
          (item) => item.kind === 'answering'
        ),
        (item) =>
          item.id !== activityId &&
          (item.kind === 'thinking' || item.kind === 'answering'),
        params.at
      ),
      {
        id: activityId,
        kind: 'thinking',
        status: 'active',
        startedAt:
          getItems(message).find((item) => item.id === activityId)?.startedAt ??
          params.at ??
          Date.now(),
        details: { reasoning: params.partial }
      }
    );
  }

  const activityId = params.activityId ?? `${message.id}:answering`;
  return upsertItem(
    completeItems(
      removeItems(
        {
          ...message,
          content: params.partial,
          isStreaming: true,
          isComplete: false
        },
        (item) => item.kind === 'answering' && item.id !== activityId
      ),
      (item) => item.kind === 'thinking' || item.kind === 'answering',
      params.at
    ),
    {
      id: activityId,
      kind: 'answering',
      status: 'active',
      startedAt:
        getItems(message).find((item) => item.id === activityId)?.startedAt ??
        params.at ??
        Date.now()
    }
  );
};

export const appendAssistantToolCall = (
  message: InternalChatMessage,
  toolCall: ToolCall
): InternalChatMessage => {
  if (message.role !== 'assistant') return message;
  const status = toolStatusToActivityStatus(toolCall.status);

  return upsertItem(
    completeItems(
      removeItems(
        {
          ...message,
          isStreaming: true,
          isComplete: false
        },
        (item) => item.kind === 'answering'
      ),
      (item) => item.kind === 'thinking' || item.kind === 'answering'
    ),
    {
      id: toolCall.id,
      kind: 'tool',
      status,
      toolId: toolCall.toolId ?? toolCall.name,
      toolName: toolCall.name,
      startedAt: toolCall.startTime ?? Date.now(),
      ...(status !== 'active'
        ? { completedAt: toolCall.endTime ?? Date.now() }
        : {}),
      details: {
        toolCall,
        ...(toolCall.result !== undefined ? { result: toolCall.result } : {})
      }
    }
  );
};

export const appendAssistantToolDraft = (
  message: InternalChatMessage,
  draft: {
    draftId: string;
    toolName: string;
    startedAt?: number;
  }
): InternalChatMessage => {
  if (message.role !== 'assistant') return message;
  const itemId = `tool-draft:${draft.draftId}`;

  return upsertItem(
    completeItems(
      removeItems(
        {
          ...message,
          isStreaming: true,
          isComplete: false
        },
        (item) => item.kind === 'answering'
      ),
      (item) => item.kind === 'thinking' || item.kind === 'answering'
    ),
    {
      id: itemId,
      kind: 'tool',
      status: 'active',
      toolId: draft.toolName,
      toolName: draft.toolName,
      startedAt: draft.startedAt ?? Date.now(),
      details: { toolCallDraftId: draft.draftId }
    }
  );
};

export const reconcileAssistantToolDraft = (
  message: InternalChatMessage,
  draftId: string,
  toolCall: ToolCall
): InternalChatMessage => {
  if (message.role !== 'assistant') return message;
  const items = getItems(message);
  const index = items.findIndex(
    (item) => item.kind === 'tool' && item.details?.toolCallDraftId === draftId
  );
  if (index === -1) return appendAssistantToolCall(message, toolCall);

  const status = toolStatusToActivityStatus(toolCall.status);
  const next = [...items];
  next[index] = {
    ...next[index],
    id: toolCall.id,
    status,
    toolId: toolCall.toolId ?? toolCall.name,
    toolName: toolCall.name,
    ...(status !== 'active'
      ? { completedAt: toolCall.endTime ?? Date.now() }
      : {}),
    details: {
      ...(next[index].details ?? {}),
      toolCall,
      ...(toolCall.result !== undefined ? { result: toolCall.result } : {})
    }
  };
  return setItems(message, next);
};

export const removeAssistantToolDraft = (
  message: InternalChatMessage,
  draftId: string
): InternalChatMessage =>
  message.role === 'assistant'
    ? removeItems(
        message,
        (item) =>
          item.kind === 'tool' && item.details?.toolCallDraftId === draftId
      )
    : message;

export const applyAssistantToolResult = (
  message: InternalChatMessage,
  update: Partial<ToolCall> &
    Pick<ToolCall, 'name' | 'status'> & { id?: string; error?: string }
): InternalChatMessage => {
  if (message.role !== 'assistant') return message;
  const items = getItems(message);
  const index = items.findIndex(
    (item) =>
      item.kind === 'tool' &&
      ((update.id && item.id === update.id) ||
        (!update.id && item.toolName === update.name))
  );
  if (index === -1) return message;

  const item = items[index];
  const { error, ...toolCallUpdate } = update;
  const toolCall = item.details?.toolCall;
  const nextToolCall = toolCall
    ? { ...toolCall, ...toolCallUpdate }
    : {
        id: toolCallUpdate.id ?? item.id,
        name: toolCallUpdate.name,
        arguments: {},
        status: toolCallUpdate.status,
        ...(toolCallUpdate.result !== undefined
          ? { result: toolCallUpdate.result }
          : {}),
        ...(toolCallUpdate.endTime !== undefined
          ? { endTime: toolCallUpdate.endTime }
          : {})
      };
  const status = toolStatusToActivityStatus(update.status);
  const details: NonNullable<AssistantActivityItem['details']> = {
    ...(item.details ?? {}),
    toolCall: nextToolCall,
    ...(update.result !== undefined ? { result: update.result } : {}),
    ...(error !== undefined ? { error } : {})
  };
  if (error === undefined && update.status !== 'failed') {
    delete details.error;
  }
  const next = [...items];
  next[index] = {
    ...item,
    status,
    toolId: nextToolCall.toolId ?? item.toolId ?? nextToolCall.name,
    toolName: update.name,
    ...(status !== 'active'
      ? { completedAt: update.endTime ?? Date.now() }
      : {}),
    details
  };
  return setItems(message, next);
};

export type AssistantToolOutputUpdate = {
  id: string;
  toolExecutionId: string;
  channel: string;
  mode: 'append' | 'replace';
  delta: unknown;
  sequence: number;
  mediaType?: string;
};

const appendOutputValue = (current: unknown, delta: unknown): unknown => {
  if (current === undefined) return delta;
  if (typeof current === 'string' && typeof delta === 'string') {
    return current + delta;
  }
  if (Array.isArray(current) && Array.isArray(delta)) {
    return [...current, ...delta];
  }
  return Array.isArray(current) ? [...current, delta] : [current, delta];
};

export const applyAssistantToolOutput = (
  message: InternalChatMessage,
  update: AssistantToolOutputUpdate
): InternalChatMessage => {
  if (message.role !== 'assistant') return message;
  const items = getItems(message);
  const index = items.findIndex(
    (item) =>
      item.kind === 'tool' &&
      (item.id === update.id ||
        item.details?.toolCall?.toolExecutionId === update.toolExecutionId)
  );
  if (index === -1) return message;

  const item = items[index];
  const priorExecution = item.details?.toolCall?.toolExecutionId;
  // History already contains the durable replacement of this tool stream.
  if (item.status === 'complete' || item.status === 'failed') return message;
  const currentOutput: ToolOutputState =
    priorExecution && priorExecution !== update.toolExecutionId
      ? { channels: {} }
      : item.details?.toolOutput ?? { channels: {} };
  const currentChannel = currentOutput.channels[update.channel];
  if (currentChannel && update.sequence <= currentChannel.sequence) {
    return message;
  }
  const value =
    update.mode === 'append'
      ? appendOutputValue(currentChannel?.value, update.delta)
      : update.delta;
  const toolOutput: ToolOutputState = {
    channels: {
      ...currentOutput.channels,
      [update.channel]: {
        value,
        sequence: update.sequence,
        ...(update.mediaType ? { mediaType: update.mediaType } : {})
      }
    }
  };
  const currentToolCall = item.details?.toolCall;
  const toolCall = currentToolCall
    ? {
        ...currentToolCall,
        toolExecutionId: update.toolExecutionId,
        ...(update.channel === 'result' ? { result: value } : {})
      }
    : currentToolCall;
  const next = [...items];
  next[index] = {
    ...item,
    status: 'active',
    details: {
      ...(item.details ?? {}),
      ...(toolCall ? { toolCall } : {}),
      toolOutput,
      ...(update.channel === 'result' ? { result: value } : {})
    }
  };
  return setItems(
    {
      ...message,
      isStreaming: true,
      isComplete: false
    },
    next
  );
};

export const finalizeAssistantMessage = (
  message: InternalChatMessage,
  finalAnswer?: string,
  completedAt = Date.now()
): InternalChatMessage => {
  if (message.role !== 'assistant') return message;
  const hasActiveTool = getItems(message).some(
    (item) => item.kind === 'tool' && item.status === 'active'
  );
  const completed = completeItems(
    {
      ...message,
      ...(typeof finalAnswer === 'string' && finalAnswer.length > 0
        ? { content: finalAnswer }
        : {}),
      isStreaming: hasActiveTool,
      isComplete: !hasActiveTool
    },
    (item) => item.kind === 'thinking' || item.kind === 'answering',
    completedAt
  );
  return setItems(
    completed,
    getItems(completed).filter((item) => item.kind !== 'answering')
  );
};

export const failAssistantMessage = (
  message: InternalChatMessage,
  error: string,
  completedAt = Date.now()
): InternalChatMessage => {
  if (message.role !== 'assistant') return message;
  const failed = getItems(message).map((item) =>
    item.status === 'active'
      ? {
          ...item,
          status: 'failed' as const,
          completedAt,
          details: { ...(item.details ?? {}), error }
        }
      : item
  );
  const items = failed.some((item) => item.status === 'failed')
    ? failed
    : [
        ...failed,
        {
          id: `${message.id}:failed`,
          kind: 'answering' as const,
          status: 'failed' as const,
          startedAt: completedAt,
          completedAt,
          details: { error }
        }
      ];
  return setItems(
    {
      ...message,
      isStreaming: false,
      isComplete: true
    },
    items
  );
};

export const closeAssistantMessage = (
  message: InternalChatMessage,
  completedAt = Date.now()
): InternalChatMessage => {
  if (message.role !== 'assistant') return message;
  return completeItems(
    {
      ...message,
      isStreaming: false,
      isComplete: true
    },
    () => true,
    completedAt
  );
};
