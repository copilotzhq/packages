const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const hasValues = (value: unknown): boolean =>
  Array.isArray(value) && value.length > 0;

export const getStreamEventPayload = (event: unknown): unknown => {
  if (!isRecord(event)) return event;
  return 'payload' in event ? event.payload : event;
};

export const getLlmAttemptId = (event: unknown): string | null => {
  if (!isRecord(event)) return null;

  const metadata = isRecord(event.metadata) ? event.metadata : {};
  if (
    typeof metadata.streamLlmAttemptId === 'string' &&
    metadata.streamLlmAttemptId.trim().length > 0
  ) {
    return metadata.streamLlmAttemptId.trim();
  }
  if (
    typeof metadata.llmAttemptId === 'string' &&
    metadata.llmAttemptId.trim().length > 0
  ) {
    return metadata.llmAttemptId.trim();
  }

  if (
    event.subjectType === 'llm_attempt' &&
    typeof event.subjectId === 'string' &&
    event.subjectId.trim().length > 0
  ) {
    return event.subjectId.trim();
  }

  return null;
};

export const getRoutingMessageFromMetadata = (
  metadata: unknown,
): string | null => {
  if (!isRecord(metadata)) return null;
  const routing = isRecord(metadata.routing) ? metadata.routing : null;
  if (!routing) return null;
  if (
    routing.source !== 'model_control' ||
    !['consult', 'ask', 'handoff'].includes(String(routing.action)) ||
    typeof routing.targetId !== 'string' ||
    routing.targetId.trim().length === 0 ||
    typeof routing.message !== 'string' ||
    routing.message.trim().length === 0
  ) {
    return null;
  }
  return routing.message.trim();
};

export const getRoutingMessage = (event: unknown): string | null => {
  if (!isRecord(event)) return null;
  return getRoutingMessageFromMetadata(event.metadata);
};

export const getVisibleLlmResultAnswer = (
  event: unknown,
): string | undefined => {
  const payload = getStreamEventPayload(event);
  const answer = isRecord(payload) && typeof payload.answer === 'string'
    ? payload.answer
    : '';
  return answer.trim().length > 0
    ? answer
    : getRoutingMessage(event) ?? undefined;
};

export const isTerminalEmptyLlmResultEvent = (event: unknown): boolean => {
  if (!isRecord(event) || event.type !== 'LLM_RESULT') return false;

  const payload = getStreamEventPayload(event);
  if (!isRecord(payload)) return false;
  if (payload.answer !== '') return false;
  if (payload.finishReason === 'tool_calls') return false;
  if (hasValues(payload.toolCalls)) return false;

  const metadata = isRecord(event.metadata) ? event.metadata : {};
  if (getRoutingMessageFromMetadata(metadata)) return false;
  if (hasValues(metadata.targetQueue)) return false;

  return true;
};
