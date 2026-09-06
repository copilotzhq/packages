import type { ObservationFrame } from '@copilotz/copilotz/client';
import type { ChatProjection } from './projection.ts';

/** Coalesces retained prefixes without animating historical streams into the UI. */
export function createObservationBootstrap() {
  let pending: Map<string, { offset: number; terminal: boolean }> | undefined;
  let declaring = false;
  let initialMessages = new Set<string>();
  let terminalStreams = new Set<string>();
  return {
    isPending: () => pending !== undefined,
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
        if (!Array.isArray(streams))
          throw new Error('Invalid observation bootstrap.');
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
      if (!pending) return { pending: false, completed: false, state };
      const id =
        frame.kind === 'output' ? frame.output.streamId : frame.streamId;
      if (typeof id === 'string') {
        const expected = pending.get(id);
        const lane = state.lanes.get(id);
        if (
          expected &&
          lane &&
          (lane.ended ||
            (lane.offset >= expected.offset && !expected.terminal))
        )
          pending.delete(id);
      }
      if (declaring || pending.size)
        return { pending: true, completed: false, state };
      pending = undefined;
      const historicalRuns = new Set(
        [...terminalStreams].map((id) => state.lanes.get(id)?.attemptId)
      );
      for (const lane of state.lanes.values())
        if (!lane.ended) historicalRuns.delete(lane.attemptId);
      return {
        pending: false,
        completed: true,
        state: {
          ...state,
          messages: state.messages.filter(
            (message) =>
              initialMessages.has(message.id) ||
              !message.id.startsWith('live:') ||
              !historicalRuns.has(message.metadata?.llmAttemptId as string)
          )
        }
      };
    }
  };
}
