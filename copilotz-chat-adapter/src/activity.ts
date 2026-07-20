import type {
  AssistantActivityItem,
  AssistantActivityStatus,
  ChatMessage,
  ToolCall,
} from '@copilotz/chat-ui';

export interface InternalChatMessage extends ChatMessage {}

const thinkingId = 'thinking';
const answeringId = 'answering';

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
): T => setItems(message, getItems(message).map((item) => (
  item.status === 'active' && shouldComplete(item)
    ? { ...item, status: 'complete', completedAt: Date.now() }
    : item
)));

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
  },
): InternalChatMessage => {
  if (message.role !== 'assistant') return message;

  if (params.isReasoning) {
    return upsertItem({
      ...message,
      isStreaming: true,
      isComplete: false,
    }, {
      id: thinkingId,
      kind: 'thinking',
      status: 'active',
      startedAt: getItems(message).find((item) => item.id === thinkingId)?.startedAt ?? Date.now(),
      details: { reasoning: params.partial },
    });
  }

  return upsertItem(completeItems({
    ...message,
    content: params.partial,
    isStreaming: true,
    isComplete: false,
  }, (item) => item.kind === 'thinking' || item.kind === 'tool'), {
    id: answeringId,
    kind: 'answering',
    status: 'active',
    startedAt: getItems(message).find((item) => item.id === answeringId)?.startedAt ?? Date.now(),
  });
};

export const appendAssistantToolCall = (
  message: InternalChatMessage,
  toolCall: ToolCall,
): InternalChatMessage => {
  if (message.role !== 'assistant') return message;
  const status = toolStatusToActivityStatus(toolCall.status);

  return upsertItem({
    ...message,
    isStreaming: true,
    isComplete: false,
  }, {
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
): InternalChatMessage => {
  if (message.role !== 'assistant') return message;
  const completed = completeItems({
    ...message,
    ...(typeof finalAnswer === 'string' && finalAnswer.length > 0 ? { content: finalAnswer } : {}),
    isStreaming: false,
    isComplete: true,
  }, (item) => item.kind === 'thinking' || item.kind === 'answering');
  return setItems(completed, getItems(completed).filter((item) => item.kind !== 'answering'));
};

export const closeAssistantMessage = (
  message: InternalChatMessage,
): InternalChatMessage => {
  if (message.role !== 'assistant') return message;
  return completeItems({
    ...message,
    isStreaming: false,
    isComplete: true,
  }, () => true);
};
