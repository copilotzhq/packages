import type { ChatMessage } from '../types/chatTypes';

const senderIdentities = (message: ChatMessage): string[] =>
  [message.sender?.id, message.sender?.externalId, message.sender?.participantId]
    .filter((value): value is string => typeof value === 'string' && value.length > 0);

/**
 * Decides which messages belong to the signed-in user.
 *
 * With one human sender in the conversation, every human message is theirs, as
 * before. With several, only messages whose sender matches `userId` are. If none
 * match, the host's user id and the server's sender ids disagree, so every
 * human message stays the user's rather than moving their own words aside.
 */
export const createOwnMessagePredicate = (
  messages: readonly ChatMessage[],
  userId: string | null | undefined,
): ((message: ChatMessage) => boolean) => {
  const isHuman = (message: ChatMessage) => message.role === 'user';
  const humanSenders = new Set(
    messages
      .filter((message) => isHuman(message) && message.sender)
      .map((message) => message.sender!.id),
  );
  if (!userId || humanSenders.size <= 1) return isHuman;

  const matchesUser = (message: ChatMessage) =>
    senderIdentities(message).includes(userId);
  if (!messages.some((message) => isHuman(message) && matchesUser(message))) {
    return isHuman;
  }

  return (message) =>
    isHuman(message) && (!message.sender || matchesUser(message));
};
