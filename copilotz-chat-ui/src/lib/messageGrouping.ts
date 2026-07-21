import type { ChatMessage } from '../types/chatTypes';

export type MessageGroup = {
  id: string;
  messages: ChatMessage[];
  primaryMessage: ChatMessage;
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

const canGroupMessages = (previous: ChatMessage, next: ChatMessage): boolean => {
  if (previous.role !== next.role) {
    return false;
  }
  if (previous.role !== 'assistant') {
    return false;
  }
  return getMessageSpeakerKey(previous) === getMessageSpeakerKey(next);
};

export const groupMessagesForRender = (messages: ChatMessage[]): MessageGroup[] => {
  if (messages.length === 0) return [];

  const groups: MessageGroup[] = [];
  let currentGroup: ChatMessage[] = [messages[0]];

  const flushGroup = () => {
    const firstMessage = currentGroup[0];
    const lastMessage = currentGroup[currentGroup.length - 1];
    groups.push({
      id: firstMessage.id,
      messages: currentGroup,
      primaryMessage: lastMessage,
      suggestionMessageId: lastMessage.id,
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
