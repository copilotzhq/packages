import type {
  AssistantActivityItem,
  AssistantActivityStatus,
  ChatMessage,
  ToolCall,
} from '@copilotz/chat-ui';

export interface InternalChatMessage extends ChatMessage {}

const getItems = (message: InternalChatMessage): AssistantActivityItem[] =>
  Array.isArray(message.activity?.items) ? message.activity.items : [];

const setItems = <T extends InternalChatMessage>(
  message: T,
  items: AssistantActivityItem[],
): T => ({
  ...message,
  activity: items.length > 0 ? { items } : undefined,
});

const toolStatusToActivityStatus = (status: ToolCall['status']): AssistantActivityStatus => {
  if (status === 'failed') return 'failed';
  if (status === 'completed') return 'complete';
  return 'active';
};

const upsertItem = <T extends InternalChatMessage>(
  message: T,
  item: AssistantActivityItem,
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
      ...(item.details ?? {}),
    },
  };
  return setItems(message, next);
};

const completeItems = <T extends InternalChatMessage>(
  message: T,
  shouldComplete: (item: AssistantActivityItem) => boolean,
  completedAt = Date.now(),
): T => setItems(message, getItems(message).map((item) => (
  item.status === 'active' && shouldComplete(item)
    ? { ...item, status: 'complete', completedAt }
    : item
)));

const removeItems = <T extends InternalChatMessage>(
  message: T,
  shouldRemove: (item: AssistantActivityItem) => boolean,
): T => setItems(message, getItems(message).filter((item) => !shouldRemove(item)));

export const hasVisibleAssistantOutput = (message: InternalChatMessage): boolean => {
  if (message.role !== 'assistant') return false;
  if (typeof message.content === 'string' && message.content.trim().length > 0) return true;
  if (Array.isArray(message.attachments) && message.attachments.length > 0) return true;
  return getItems(message).length > 0;
};

export const toPublicChatMessage = (message: InternalChatMessage): ChatMessage => {
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
  },
): InternalChatMessage => {
  if (message.role !== 'assistant') return message;

  if (params.isReasoning) {
    const activityId = params.activityId ?? `${message.id}:thinking`;
    return upsertItem(completeItems(removeItems({
      ...message,
      isStreaming: true,
      isComplete: false,
    }, (item) => item.kind === 'answering'), (item) => (
      item.id !== activityId &&
      (item.kind === 'thinking' || item.kind === 'answering')
    ), params.at), {
      id: activityId,
      kind: 'thinking',
      status: 'active',
      startedAt: getItems(message).find((item) => item.id === activityId)?.startedAt ?? params.at ?? Date.now(),
      details: { reasoning: params.partial },
    });
  }

  const activityId = params.activityId ?? `${message.id}:answering`;
  return upsertItem(completeItems(removeItems({
    ...message,
    content: params.partial,
    isStreaming: true,
    isComplete: false,
  }, (item) => item.kind === 'answering' && item.id !== activityId), (item) => (
    item.kind === 'thinking' || item.kind === 'answering'
  ), params.at), {
    id: activityId,
    kind: 'answering',
    status: 'active',
    startedAt: getItems(message).find((item) => item.id === activityId)?.startedAt ?? params.at ?? Date.now(),
  });
};

export const appendAssistantToolCall = (
  message: InternalChatMessage,
  toolCall: ToolCall,
): InternalChatMessage => {
  if (message.role !== 'assistant') return message;
  const status = toolStatusToActivityStatus(toolCall.status);

  return upsertItem(completeItems(removeItems({
    ...message,
    isStreaming: true,
    isComplete: false,
  }, (item) => item.kind === 'answering'), (item) => (
    item.kind === 'thinking' || item.kind === 'answering'
  )), {
    id: toolCall.id,
    kind: 'tool',
    status,
    toolName: toolCall.name,
    startedAt: toolCall.startTime ?? Date.now(),
    ...(status !== 'active' ? { completedAt: toolCall.endTime ?? Date.now() } : {}),
    details: {
      toolCall,
      ...(toolCall.result !== undefined ? { result: toolCall.result } : {}),
    },
  });
};

export const appendAssistantToolDraft = (
  message: InternalChatMessage,
  draft: {
    draftId: string;
    toolName: string;
    startedAt?: number;
  },
): InternalChatMessage => {
  if (message.role !== 'assistant') return message;
  const itemId = `tool-draft:${draft.draftId}`;

  return upsertItem(completeItems(removeItems({
    ...message,
    isStreaming: true,
    isComplete: false,
  }, (item) => item.kind === 'answering'), (item) => (
    item.kind === 'thinking' || item.kind === 'answering'
  )), {
    id: itemId,
    kind: 'tool',
    status: 'active',
    toolName: draft.toolName,
    startedAt: draft.startedAt ?? Date.now(),
    details: { toolCallDraftId: draft.draftId },
  });
};

export const reconcileAssistantToolDraft = (
  message: InternalChatMessage,
  draftId: string,
  toolCall: ToolCall,
): InternalChatMessage => {
  if (message.role !== 'assistant') return message;
  const items = getItems(message);
  const index = items.findIndex((item) =>
    item.kind === 'tool' && item.details?.toolCallDraftId === draftId
  );
  if (index === -1) return appendAssistantToolCall(message, toolCall);

  const status = toolStatusToActivityStatus(toolCall.status);
  const next = [...items];
  next[index] = {
    ...next[index],
    id: toolCall.id,
    status,
    toolName: toolCall.name,
    ...(status !== 'active' ? { completedAt: toolCall.endTime ?? Date.now() } : {}),
    details: {
      ...(next[index].details ?? {}),
      toolCall,
      ...(toolCall.result !== undefined ? { result: toolCall.result } : {}),
    },
  };
  return setItems(message, next);
};

export const removeAssistantToolDraft = (
  message: InternalChatMessage,
  draftId: string,
): InternalChatMessage => (
  message.role === 'assistant'
    ? removeItems(message, (item) =>
      item.kind === 'tool' && item.details?.toolCallDraftId === draftId
    )
    : message
);

export const applyAssistantToolResult = (
  message: InternalChatMessage,
  update: Partial<ToolCall> & Pick<ToolCall, 'name' | 'status'> & { id?: string; error?: string },
): InternalChatMessage => {
  if (message.role !== 'assistant') return message;
  const items = getItems(message);
  const index = items.findIndex((item) => (
    item.kind === 'tool' &&
    ((update.id && item.id === update.id) || (!update.id && item.toolName === update.name))
  ));
  if (index === -1) return message;

  const item = items[index];
  const { error, ...toolCallUpdate } = update;
  const toolCall = item.details?.toolCall;
  const nextToolCall = toolCall ? { ...toolCall, ...toolCallUpdate } : {
    id: toolCallUpdate.id ?? item.id,
    name: toolCallUpdate.name,
    arguments: {},
    status: toolCallUpdate.status,
    ...(toolCallUpdate.result !== undefined ? { result: toolCallUpdate.result } : {}),
    ...(toolCallUpdate.endTime !== undefined ? { endTime: toolCallUpdate.endTime } : {}),
  };
  const status = toolStatusToActivityStatus(update.status);
  const details: NonNullable<AssistantActivityItem['details']> = {
    ...(item.details ?? {}),
    toolCall: nextToolCall,
    ...(update.result !== undefined ? { result: update.result } : {}),
    ...(error !== undefined ? { error } : {}),
  };
  if (error === undefined && update.status !== 'failed') {
    delete details.error;
  }
  const next = [...items];
  next[index] = {
    ...item,
    status,
    toolName: update.name,
    ...(status !== 'active' ? { completedAt: update.endTime ?? Date.now() } : {}),
    details,
  };
  return setItems(message, next);
};

export const finalizeAssistantMessage = (
  message: InternalChatMessage,
  finalAnswer?: string,
  completedAt = Date.now(),
): InternalChatMessage => {
  if (message.role !== 'assistant') return message;
  const completed = completeItems({
    ...message,
    ...(typeof finalAnswer === 'string' && finalAnswer.length > 0 ? { content: finalAnswer } : {}),
    isStreaming: false,
    isComplete: true,
  }, (item) => item.kind === 'thinking' || item.kind === 'answering', completedAt);
  return setItems(completed, getItems(completed).filter((item) => item.kind !== 'answering'));
};

export const closeAssistantMessage = (
  message: InternalChatMessage,
  completedAt = Date.now(),
): InternalChatMessage => {
  if (message.role !== 'assistant') return message;
  return completeItems({
    ...message,
    isStreaming: false,
    isComplete: true,
  }, () => true, completedAt);
};
