import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { emptyProjection, projectFrame } from '../src/projection.ts';
import { streamTerminal } from '../tests/fixtures/streamTerminal.ts';
import type { ObservationFrame } from '@copilotz/copilotz/client';

// Explicit opt-in: this must exercise the supplied checkout, never the npm pin.
if (!process.env.COPILOTZ_SOURCE) throw new Error('Set COPILOTZ_SOURCE to a Copilotz checkout.');
const { decodeObservation, ProtocolError } = await import(pathToFileURL(
  resolve(process.env.COPILOTZ_SOURCE, 'client/protocol.ts'),
).href);

function wire(frames: ObservationFrame[]) {
  const parts = frames.flatMap((frame, index) => {
    const bytes = frame.kind === 'stream-chunk' ? frame.bytes : new TextEncoder().encode(
      JSON.stringify(frame.kind === 'output' ? frame.output : frame.terminal),
    );
    const lane = frame.kind === 'output' ? '' :
      `x-copilotz-stream-id: ${frame.streamId}\r\nx-copilotz-offset: ${frame.offset}\r\n`;
    return [
      `--test\r\nx-copilotz-frame: ${frame.kind}\r\nx-copilotz-cursor: ${frame.checkpoint}\r\nx-copilotz-position: ${index + 1}\r\ncontent-length: ${bytes.length}\r\n${lane}\r\n`,
      bytes, '\r\n',
    ];
  });
  return new Response(new Blob([...parts, '--test--\r\n']), {
    headers: { 'content-type': 'multipart/mixed; boundary=test' },
  });
}
const descriptor: ObservationFrame = {
  kind: 'output', checkpoint: 'start', output: {
    type: 'stream.output', streamId: 'answer', operationId: 'op',
    role: 'content', mediaType: 'text/plain', metadata: { sourceActionRunId: 'run' },
  },
};
const chunk: ObservationFrame = {
  kind: 'stream-chunk', checkpoint: 'chunk', streamId: 'answer', offset: 0,
  bytes: new TextEncoder().encode('partial'),
};

for (const outcome of ['completed', 'failed', 'cancelled'] as const) {
  for (const availability of ['retained', 'purged'] as const) {
    test(`DEL decoder and adapter preserve ${outcome}/${availability}`, async () => {
      const terminal = streamTerminal('answer', availability === 'purged' ? 100 : 7,
        outcome, availability, outcome === 'failed' ? 'provider_error' :
          outcome === 'cancelled' ? 'superseded' : undefined);
      let state = emptyProjection();
      const decoded = [];
      for await (const frame of decodeObservation(wire([descriptor, chunk, terminal]))) {
        decoded.push(frame);
        state = projectFrame(state, frame, 10).state;
      }
      assert.deepEqual(decoded.at(-1), terminal);
      assert.equal(state.lanes.get('answer')?.failed, outcome !== 'completed');
      assert.equal(state.messages[0].content, 'partial');
      assert.equal(state.messages[0].isStreaming, false);
    });
  }
}

for (const [name, patch] of Object.entries({
  capture: { capture: 'complete' },
  'missing availability': { availability: 'missing' },
  'missing cause': { availabilityReason: undefined },
  'wrong offset': { offset: 99 },
  'wrong error code': { code: 'stream_failed' },
  'wrong stream': { streamId: 'other' },
})) {
  test(`DEL rejects ${name} in a completed/purged terminal`, async () => {
    const frame = streamTerminal('answer', 100, 'completed', 'purged');
    const invalid = { ...frame, terminal: { ...frame.terminal, ...patch } };
    await assert.rejects(async () => {
      for await (const _frame of decodeObservation(wire([descriptor, chunk, invalid]))) { /* drain */ }
    }, ProtocolError);
  });
}
