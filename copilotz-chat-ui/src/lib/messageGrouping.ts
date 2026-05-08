import type { AssistantActivityBlock, AssistantActivityItem, ChatMessage } from '../types/chatTypes';

export type MessageGroup = {
  id: string;
  message: ChatMessage;
  suggestionMessageId: string;
};

const getMessageSpeakerKey = (
  message: ChatMessage | null | undefined,
): string | null => {
  if (!message) return null;
  if (message.sender) {
    return `${message.sender.type}:${message.sender.id}`;
  }
  if (message.role === 'user') {
    return 'user';
  }
  return message.role;
};

const getAssistantSpeakerTokens = (
  message: ChatMessage | null | undefined,
): string[] => {
  if (!message || message.role !== 'assistant') return [];

  if (message.sender) {
    return Array.from(new Set([
      `${message.sender.type}:${message.sender.id}`,
      message.sender.agentId ? `agent:${message.sender.agentId}` : '',
      message.sender.externalId ? `external:${message.sender.externalId}` : '',
    ].filter(Boolean).map((value) => value.toLowerCase())));
  }

  return ['assistant'];
};

const hasAssistantContent = (message: ChatMessage): boolean =>
  message.role === 'assistant' && (
    message.content.trim().length > 0 ||
    Boolean(message.attachments?.length)
  );

const hasActivity = (message: ChatMessage): boolean =>
  Boolean(message.activity?.items.length);

const canGroupMessages = (previous: ChatMessage, next: ChatMessage): boolean => {
  if (previous.role !== next.role) {
    return false;
  }

  if (previous.role !== 'assistant') {
    return getMessageSpeakerKey(previous) === getMessageSpeakerKey(next);
  }

  const previousTokens = getAssistantSpeakerTokens(previous);
  const nextTokens = getAssistantSpeakerTokens(next);
  if (!previousTokens.some((token) => nextTokens.includes(token))) return false;

  return !(hasAssistantContent(previous) && hasActivity(next));
};

const mergeGroupActivity = (
  messages: ChatMessage[],
): ChatMessage['activity'] => {
  const merged = new Map<string, AssistantActivityItem>();

  for (const activity of messages
    .map((message) => message.activity)
    .filter((activity): activity is AssistantActivityBlock => Boolean(activity))) {
    for (const item of activity.items) merged.set(item.id, item);
  }

  return merged.size > 0 ? { items: Array.from(merged.values()) } : undefined;
};

const mergeMessageGroup = (messages: ChatMessage[]): ChatMessage => {
  if (messages.length === 1) {
    return messages[0];
  }

  const firstMessage = messages[0];
  const lastMessage = messages[messages.length - 1];
  const content = messages
    .map((message) => message.content.trim())
    .filter((value) => value.length > 0)
    .join('\n\n');
  const attachments = messages.flatMap((message) => message.attachments ?? []);

  return {
    ...lastMessage,
    id: lastMessage.id,
    content,
    timestamp: firstMessage.timestamp,
    attachments: attachments.length > 0 ? attachments : undefined,
    isStreaming: lastMessage.isStreaming,
    isComplete: lastMessage.isComplete,
    isEdited: messages.some((message) => message.isEdited),
    originalContent: undefined,
    editedAt: lastMessage.editedAt,
    activity: mergeGroupActivity(messages),
    sender: lastMessage.sender ?? firstMessage.sender,
    metadata: lastMessage.metadata,
  };
};

export const groupMessagesForRender = (messages: ChatMessage[]): MessageGroup[] => {
  if (messages.length === 0) return [];

  const groups: MessageGroup[] = [];
  let currentGroup: ChatMessage[] = [messages[0]];

  const flushGroup = () => {
    const mergedMessage = mergeMessageGroup(currentGroup);
    groups.push({
      id: mergedMessage.id,
      message: mergedMessage,
      suggestionMessageId: currentGroup[currentGroup.length - 1].id,
    });
  };

  for (let index = 1; index < messages.length; index++) {
    const previous = currentGroup[currentGroup.length - 1];
    const next = messages[index];

    if (canGroupMessages(previous, next)) {
      currentGroup.push(next);
      continue;
    }

    flushGroup();
    currentGroup = [next];
  }

  flushGroup();
  return groups;
};
