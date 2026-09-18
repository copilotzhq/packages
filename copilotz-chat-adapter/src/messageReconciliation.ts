import type { InternalChatMessage } from './activity.ts';

export const CLIENT_MESSAGE_ID_METADATA_KEY = 'clientMessageId';
export const LLM_ATTEMPT_ID_METADATA_KEY = 'llmAttemptId';

const stringifyForCompare = (value: unknown): string => {
  if (value === undefined) return '';
  try {
    return JSON.stringify(value) ?? '';
  } catch {
    return String(value);
  }
};

const getMessageSignature = (message: InternalChatMessage): string =>
  JSON.stringify({
    id: message.id,
    role: message.role,
    content: message.content ?? '',
    isStreaming: message.isStreaming === true,
    isComplete: message.isComplete === true,
    attachments: stringifyForCompare(message.attachments),
    activity: stringifyForCompare(message.activity),
    metadata: stringifyForCompare(message.metadata),
    sender: message.sender
      ? {
          id: message.sender.id,
          type: message.sender.type,
          name: message.sender.name,
          agentId: message.sender.agentId
        }
      : null
  });

const getMetadataString = (
  message: InternalChatMessage,
  key: string
): string | null => {
  const value = message.metadata?.[key];
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : null;
};

const getClientMessageId = (
  message: InternalChatMessage
): string | null =>
  getMetadataString(message, CLIENT_MESSAGE_ID_METADATA_KEY);

export const getCanonicalLlmAttemptId = (
  message: InternalChatMessage
): string | null => {
  const workflow = message.metadata?.copilotzWorkflow;
  if (!workflow || typeof workflow !== 'object' || Array.isArray(workflow))
    return null;
  const value = (workflow as Record<string, unknown>).llmAttemptId;
  return typeof value === 'string' && value.trim() ? value.trim() : null;
};

const getMessageAttemptId = (
  message: InternalChatMessage
): string | null =>
  getCanonicalLlmAttemptId(message) ??
  getMetadataString(message, LLM_ATTEMPT_ID_METADATA_KEY);

const getCorrelationKeys = (message: InternalChatMessage): string[] => {
  const clientMessageId = getClientMessageId(message);
  const llmAttemptId = getMessageAttemptId(message);

  return [
    ...(clientMessageId
      ? [`client-message:${message.role}:${clientMessageId}`]
      : []),
    ...(llmAttemptId ? [`llm-attempt:${message.role}:${llmAttemptId}`] : [])
  ];
};

const hasLocalAssistantForClientMessage = (
  messages: InternalChatMessage[],
  clientMessageId: string
): boolean =>
  messages.some(
    (message) =>
      message.role === 'assistant' &&
      getClientMessageId(message) === clientMessageId
  );

const indexUniqueFreshCorrelations = (
  freshMessages: InternalChatMessage[]
): Map<string, InternalChatMessage | null> => {
  const messagesByCorrelation = new Map<string, InternalChatMessage | null>();

  for (const message of freshMessages) {
    for (const key of getCorrelationKeys(message)) {
      messagesByCorrelation.set(
        key,
        messagesByCorrelation.has(key) ? null : message
      );
    }
  }

  return messagesByCorrelation;
};

export const reconcileThreadMessages = (
  currentMessages: InternalChatMessage[],
  freshMessages: InternalChatMessage[]
): { messages: InternalChatMessage[]; changed: boolean } => {
  if (freshMessages.length === 0) {
    return { messages: currentMessages, changed: false };
  }
  if (currentMessages.length === 0) {
    return { messages: freshMessages, changed: true };
  }

  const freshById = new Map(
    freshMessages.map((message) => [message.id, message])
  );
  const freshByCorrelation = indexUniqueFreshCorrelations(freshMessages);
  const seen = new Set<string>();
  let changed = false;

  const nextMessages = currentMessages.flatMap((message) => {
    const exactMatch = freshById.get(message.id);
    const correlatedMatch = exactMatch
      ? null
      : getCorrelationKeys(message)
          .map((key) => freshByCorrelation.get(key))
          .find(
            (candidate): candidate is InternalChatMessage =>
              candidate !== null && candidate !== undefined
          );
    const fresh = exactMatch ?? correlatedMatch;
    if (!fresh) return [message];

    // A canonical exact-id message may already have consumed this fresh
    // correlation before a reconnect-created placeholder is visited. Drop the
    // placeholder instead of retaining two copies of the same durable attempt.
    if (seen.has(fresh.id)) {
      changed = true;
      return [];
    }

    seen.add(fresh.id);

    // Keep the optimistic user beside its local assistant until that assistant
    // becomes canonical. Otherwise a refresh can sort the server-timestamped
    // user after the local reply, making the UI group it with the preceding
    // assistant message.
    const clientMessageId = getClientMessageId(message);
    if (
      message.role === 'user' &&
      clientMessageId !== null &&
      fresh.id !== message.id &&
      hasLocalAssistantForClientMessage(currentMessages, clientMessageId)
    ) {
      return [message];
    }

    // An active local attempt owns the presentation while its stream is live.
    // Consume the durable counterpart so it is not appended, but retain the
    // local identity, order, partial output, activity, attachments, and
    // streaming state until normal completion can replace it.
    const attemptId = getMessageAttemptId(message);
    if (
      message.role === 'assistant' &&
      message.isStreaming === true &&
      attemptId !== null &&
      getMessageAttemptId(fresh) === attemptId
    ) {
      return [message];
    }

    if (getMessageSignature(message) === getMessageSignature(fresh)) {
      return [message];
    }

    changed = true;
    return [fresh];
  });

  const appended = freshMessages.filter((message) => !seen.has(message.id));
  if (appended.length > 0) {
    changed = true;
    nextMessages.push(...appended);
  }
  // Replacing a live placeholder can change its timestamp even without additions.
  if (changed) {
    nextMessages.sort((a, b) => {
      const timestampDelta = (a.timestamp ?? 0) - (b.timestamp ?? 0);
      return timestampDelta !== 0 ? timestampDelta : a.id.localeCompare(b.id);
    });
  }

  return changed
    ? { messages: nextMessages, changed }
    : { messages: currentMessages, changed: false };
};
