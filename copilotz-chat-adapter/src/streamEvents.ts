const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const hasValues = (value: unknown): boolean =>
  Array.isArray(value) && value.length > 0;

const text = (value: unknown): string | null =>
  typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : null;

export const getWorkflowMetadata = (
  event: unknown,
): Record<string, unknown> | null => {
  if (!isRecord(event)) return null;
  const metadata = isRecord(event.metadata) ? event.metadata : null;
  return metadata && isRecord(metadata.copilotzWorkflow)
    ? metadata.copilotzWorkflow
    : null;
};

export const getStreamEventPayload = (event: unknown): unknown => {
  if (!isRecord(event)) return event;
  return 'payload' in event ? event.payload : event;
};

export const getLlmAttemptId = (event: unknown): string | null => {
  if (!isRecord(event)) return null;

  const metadata = isRecord(event.metadata) ? event.metadata : {};
  const workflow = getWorkflowMetadata(event);
  const payload = isRecord(event.payload) ? event.payload : {};
  const nested = [
    metadata.streamLlmAttemptId,
    metadata.llmAttemptId,
    workflow?.llmAttemptId,
    workflow?.parentLlmAttemptId,
    payload.llmAttemptId,
  ].map(text).find(Boolean);
  if (nested) return nested;

  if (
    isRecord(event.subject) &&
    event.subject.type === 'llm_attempt' &&
    text(event.subject.id)
  ) {
    return text(event.subject.id);
  }

  if (
    event.subjectType === 'llm_attempt' &&
    text(event.subjectId)
  ) {
    return text(event.subjectId);
  }

  return null;
};

export const isAgentOutputMessageEvent = (event: unknown): boolean => {
  if (!isRecord(event) || event.type !== 'message.created') return false;
  return getWorkflowMetadata(event)?.kind === 'agent_output';
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
