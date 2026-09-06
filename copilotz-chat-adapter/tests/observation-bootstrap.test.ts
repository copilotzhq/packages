import test from 'node:test';
import assert from 'node:assert/strict';
import { createObservationBootstrap } from '../src/observationBootstrap.ts';
import { emptyProjection, projectFrame } from '../src/projection.ts';
import type { ObservationFrame } from '@copilotz/copilotz/client';

test('bootstrap hides historical terminal placeholders while restoring an unfinished stream', () => {
  const bootstrap = createObservationBootstrap();
  let state = emptyProjection();
  const apply = (frame: ObservationFrame) => {
    state = projectFrame(state, frame, 1).state;
    const result = bootstrap.apply(frame, state, []);
    state = result.state;
    return result;
  };
  const begin: ObservationFrame = {
    kind: 'output',
    checkpoint: 'c',
    output: {
      type: 'observation.bootstrap',
      streams: [
        { streamId: 'old', offset: 3, terminal: true },
        { streamId: 'new', offset: 3, terminal: false }
      ]
    }
  };
  assert.equal(apply(begin).pending, true);
  for (const id of ['old', 'new']) {
    apply({
      kind: 'output',
      checkpoint: 'c',
      output: {
        type: 'stream.output',
        streamId: id,
        operationId: 'op',
        mediaType: 'text/plain',
        role: 'content',
        metadata: { sourceActionRunId: id }
      }
    });
  }
  apply({
    kind: 'stream-chunk',
    checkpoint: 'c',
    streamId: 'old',
    offset: 0,
    bytes: new TextEncoder().encode('old')
  });
  // A reconnect must not treat unpublished replay state as already visible.
  apply(begin);
  assert.equal(
    apply({
      kind: 'stream-end',
      checkpoint: 'c',
      streamId: 'old',
      offset: 3,
      terminal: {}
    }).pending,
    true
  );
  const ready = apply({
    kind: 'stream-chunk',
    checkpoint: 'c',
    streamId: 'new',
    offset: 0,
    bytes: new TextEncoder().encode('new')
  });
  assert.equal(ready.completed, true);
  assert.deepEqual(
    state.messages.map((message) => message.content),
    ['new']
  );
});
