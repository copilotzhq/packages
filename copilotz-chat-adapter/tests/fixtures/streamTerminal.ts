import type { ObservationFrame } from '@copilotz/copilotz/client';

type TerminalFrame = Extract<ObservationFrame, { terminal: unknown }>;

// Match the public wire boundary, including stream.error identity and code.
export const streamTerminal = (
  streamId: string,
  offset: number,
  outcome: 'completed' | 'failed' | 'cancelled' = 'completed',
  availability: 'retained' | 'purged' = 'retained',
  reason?: string,
  availabilityReason = 'missing',
): TerminalFrame => {
  const error = outcome !== 'completed' || availability === 'purged';
  return {
    kind: error ? 'stream-error' : 'stream-end',
    streamId,
    checkpoint: `${streamId}:end`,
    offset,
    terminal: {
      outcome,
      availability,
      ...(reason ? { reason } : {}),
      ...(availability === 'purged' ? { availabilityReason } : {}),
      ...(error ? {
        type: 'stream.error',
        streamId,
        code: availability === 'purged' ? 'stream_unavailable' : `stream_${outcome}`,
      } : {}),
      offset,
      terminalAt: '2026-10-18T00:00:00Z',
    },
  };
};
