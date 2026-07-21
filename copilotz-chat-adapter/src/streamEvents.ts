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

export const isTerminalEmptyLlmResultEvent = (event: unknown): boolean => {
  if (!isRecord(event) || event.type !== 'LLM_RESULT') return false;

  const payload = getStreamEventPayload(event);
  if (!isRecord(payload)) return false;
  if (payload.answer !== '') return false;
  if (payload.finishReason === 'tool_calls') return false;
  if (hasValues(payload.toolCalls)) return false;

  const metadata = isRecord(event.metadata) ? event.metadata : {};
  const routing = isRecord(metadata.routing) ? metadata.routing : {};
  if (
    (routing.action === 'ask' || routing.action === 'handoff') &&
    typeof routing.targetId === 'string' &&
    routing.targetId.trim().length > 0
  ) return false;
  if (hasValues(metadata.targetQueue)) return false;

  return true;
};
