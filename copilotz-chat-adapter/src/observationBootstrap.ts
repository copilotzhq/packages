import type { ObservationFrame } from '@copilotz/copilotz/client';
import type { ChatProjection } from './projection.ts';

type HistoricalLane = {
  offset: number;
  terminal: boolean;
};

/**
 * Keeps recovery prefixes out of the rendered view until each individual lane
 * is coherent. The authoritative projection is never withheld: it continues
 * retaining cursor, terminal, retry, and partial-output state while recovery
 * is in progress.
 */
export function createObservationBootstrap() {
  let pending: Map<string, HistoricalLane> | undefined;
  let declaring = false;
  let initialMessages = new Set<string>();
  let terminalStreams = new Set<string>();
  const historicalAttemptIds = (state: ChatProjection, streams: Set<string>) =>
    new Set(
      [...streams]
        .map((id) => state.lanes.get(id)?.attemptId)
        .filter((id): id is string => Boolean(id))
    );
  const completedHistoricalAttemptIds = (state: ChatProjection) => {
    const attempts = historicalAttemptIds(state, terminalStreams);
    for (const lane of state.lanes.values()) {
      if (!lane.ended) attempts.delete(lane.attemptId);
    }
    return attempts;
  };
  const visible = (state: ChatProjection): ChatProjection => {
    if (!pending) return state;
    const pendingAttempts = historicalAttemptIds(
      state,
      new Set(pending.keys())
    );
    const terminalAttempts = completedHistoricalAttemptIds(state);
    const knownAttempts = new Set(
      [...state.lanes.values()].map((lane) => lane.attemptId)
    );
    return {
      ...state,
      messages: state.messages.filter(
        (message) =>
          initialMessages.has(message.id) ||
          !message.id.startsWith('live:') ||
          (knownAttempts.has(message.metadata?.llmAttemptId as string) &&
            !pendingAttempts.has(message.metadata?.llmAttemptId as string) &&
            !terminalAttempts.has(message.metadata?.llmAttemptId as string))
      )
    };
  };
  return {
    isPending: () => pending !== undefined,
    visible,
    clear() {
      pending = undefined;
      declaring = false;
      initialMessages.clear();
      terminalStreams.clear();
    },
    apply(
      frame: ObservationFrame,
      state: ChatProjection,
      visibleMessageIds?: readonly string[]
    ) {
      if (
        frame.kind === 'output' &&
        frame.output.type === 'observation.bootstrap'
      ) {
        const streams = frame.output.streams;
        if (!Array.isArray(streams)) {
          throw new Error('Invalid observation bootstrap.');
        }
        if (!declaring) {
          pending = new Map();
          initialMessages = new Set(
            visibleMessageIds ?? state.messages.map((message) => message.id)
          );
          terminalStreams = new Set();
        }
        declaring = frame.output.more === true;
        for (const stream of streams) {
          if (
            typeof stream.streamId !== 'string' ||
            !Number.isSafeInteger(stream.offset) ||
            stream.offset < 0 ||
            typeof stream.terminal !== 'boolean'
          ) {
            throw new Error('Invalid observation bootstrap stream.');
          }
          pending!.set(stream.streamId, stream);
          if (stream.terminal) terminalStreams.add(stream.streamId);
        }
      }
      if (!pending) {
        return { pending: false, completed: false, state, visible: state };
      }
      const id =
        frame.kind === 'output' ? frame.output.streamId : frame.streamId;
      if (typeof id === 'string') {
        const expected = pending.get(id);
        const lane = state.lanes.get(id);
        if (
          expected &&
          lane &&
          (expected.terminal
            ? lane.ended
            : lane.offset >= expected.offset || lane.ended)
        ) {
          pending.delete(id);
        }
      }
      if (declaring || pending.size) {
        return {
          pending: true,
          completed: false,
          state,
          visible: visible(state)
        };
      }
      const historicalRuns = completedHistoricalAttemptIds(state);
      const completedState = {
        ...state,
        messages: state.messages.filter(
          (message) =>
            initialMessages.has(message.id) ||
            !message.id.startsWith('live:') ||
            !historicalRuns.has(message.metadata?.llmAttemptId as string)
        )
      };
      pending = undefined;
      declaring = false;
      initialMessages.clear();
      terminalStreams.clear();
      return {
        pending: false,
        completed: true,
        state: completedState,
        visible: completedState
      };
    }
  };
}
