import type { ChatMessage } from '../types/chatTypes';

export type MessageGroup = {
  id: string;
  messages: ChatMessage[];
  primaryMessage: ChatMessage;
  suggestionMessageId: string;
};

type RecoveryMetadata = {
  chainId: string;
  joinSeparator?: string;
};

const getRecoveryMetadata = (
  message: ChatMessage | null | undefined,
): RecoveryMetadata | null => {
  const recovery = message?.metadata?.recovery;
  if (!recovery || typeof recovery !== 'object' || Array.isArray(recovery)) {
    return null;
  }
  return typeof recovery.chainId === 'string'
    ? {
      chainId: recovery.chainId,
      ...(typeof recovery.joinSeparator === 'string'
        ? { joinSeparator: recovery.joinSeparator }
        : {}),
    }
    : null;
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
  const previousRecovery = getRecoveryMetadata(previous);
  const nextRecovery = getRecoveryMetadata(next);
  if (
    previousRecovery && nextRecovery &&
    previousRecovery.chainId === nextRecovery.chainId
  ) {
    return true;
  }
  return getMessageSpeakerKey(previous) === getMessageSpeakerKey(next);
};

export const joinMessageGroupContent = (messages: ChatMessage[]): string => {
  let content = '';
  let previous: ChatMessage | undefined;
  for (const message of messages) {
    const messageContent = message.content.trim();
    if (!messageContent) continue;
    if (!previous) {
      content = messageContent;
      previous = message;
      continue;
    }
    const previousRecovery = getRecoveryMetadata(previous);
    const nextRecovery = getRecoveryMetadata(message);
    const separator = previousRecovery && nextRecovery &&
        previousRecovery.chainId === nextRecovery.chainId
      ? nextRecovery.joinSeparator ?? previousRecovery.joinSeparator ?? ''
      : '\n\n';
    content += `${separator}${messageContent}`;
    previous = message;
  }
  return content;
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
