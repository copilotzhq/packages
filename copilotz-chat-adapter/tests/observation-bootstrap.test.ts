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

test('a slow historical lane does not hide an unrelated live agent, and publishes atomically at its boundary', () => {
  const bootstrap = createObservationBootstrap();
  let state = emptyProjection();
  const apply = (frame: ObservationFrame) => {
    state = projectFrame(state, frame, 1).state;
    const result = bootstrap.apply(frame, state, []);
    state = result.state;
    return result;
  };
  const descriptor = (streamId: string, run: string): ObservationFrame => ({
    kind: 'output',
    checkpoint: streamId,
    output: {
      type: 'stream.output',
      streamId,
      operationId: `op:${streamId}`,
      mediaType: 'text/plain',
      role: 'content',
      metadata: { sourceActionRunId: run }
    }
  });
  apply({
    kind: 'output',
    checkpoint: 'bootstrap',
    output: {
      type: 'observation.bootstrap',
      streams: [
        { streamId: 'slow-history', offset: 6, terminal: false },
        { streamId: 'completed-history', offset: 3, terminal: true }
      ]
    }
  });
  const preparing = apply({
    kind: 'output',
    checkpoint: 'invoked',
    output: {
      type: 'llm.call.invoked',
      operationId: 'op:slow-history',
      data: {
        actionRunId: 'slow-run',
        metadata: {
          schema: 'copilotz.core.llm-call.v1',
          agentId: 'slow-agent'
        }
      }
    }
  });
  assert.deepEqual(preparing.visible.messages, []);
  apply(descriptor('slow-history', 'slow-run'));
  apply(descriptor('completed-history', 'old-run'));
  apply(descriptor('new-live-agent', 'new-run'));
  const live = apply({
    kind: 'stream-chunk',
    checkpoint: 'live',
    streamId: 'new-live-agent',
    offset: 0,
    bytes: new TextEncoder().encode('visible now')
  });
  assert.equal(live.pending, true);
  assert.deepEqual(
    live.visible.messages.map((message) => message.content),
    ['visible now']
  );
  const partial = apply({
    kind: 'stream-chunk',
    checkpoint: 'slow:part',
    streamId: 'slow-history',
    offset: 0,
    bytes: new TextEncoder().encode('pre')
  });
  assert.deepEqual(
    partial.visible.messages.map((message) => message.content),
    ['visible now']
  );
  apply({
    kind: 'stream-chunk',
    checkpoint: 'old',
    streamId: 'completed-history',
    offset: 0,
    bytes: new TextEncoder().encode('old')
  });
  apply({
    kind: 'stream-end',
    checkpoint: 'old:end',
    streamId: 'completed-history',
    offset: 3,
    terminal: {}
  });
  const ready = apply({
    kind: 'stream-chunk',
    checkpoint: 'slow:ready',
    streamId: 'slow-history',
    offset: 3,
    bytes: new TextEncoder().encode('fix')
  });
  assert.equal(ready.completed, true);
  assert.deepEqual(
    ready.visible.messages.map((message) => message.content),
    ['prefix', 'visible now']
  );
  assert.deepEqual(
    state.messages.map((message) => message.content),
    ['prefix', 'visible now']
  );
});

test('a failed historical lane is revealed with its retained terminal state', () => {
  const bootstrap = createObservationBootstrap();
  let state = emptyProjection();
  const apply = (frame: ObservationFrame) => {
    state = projectFrame(state, frame, 1).state;
    const result = bootstrap.apply(frame, state, []);
    state = result.state;
    return result;
  };
  apply({
    kind: 'output',
    checkpoint: 'bootstrap',
    output: {
      type: 'observation.bootstrap',
      streams: [{ streamId: 'failed', offset: 10, terminal: false }]
    }
  });
  apply({
    kind: 'output',
    checkpoint: 'failed',
    output: {
      type: 'stream.output',
      streamId: 'failed',
      operationId: 'op',
      mediaType: 'text/plain',
      role: 'content',
      metadata: { sourceActionRunId: 'failed-run' }
    }
  });
  apply({
    kind: 'stream-chunk',
    checkpoint: 'failed:part',
    streamId: 'failed',
    offset: 0,
    bytes: new TextEncoder().encode('partial')
  });
  const failed = apply({
    kind: 'stream-error',
    checkpoint: 'failed:end',
    streamId: 'failed',
    offset: 7,
    terminal: {}
  });
  assert.equal(failed.completed, true);
  assert.equal(failed.visible.messages[0].content, 'partial');
  assert.equal(state.lanes.get('failed')?.failed, true);
  assert.equal(state.lanes.get('failed')?.offset, 7);
});

test('a completed historical side lane cannot hide an unfinished lane of the same attempt', () => {
  const bootstrap = createObservationBootstrap();
  let state = emptyProjection();
  const apply = (frame: ObservationFrame) => {
    state = projectFrame(state, frame, 1).state;
    const result = bootstrap.apply(frame, state, []);
    state = result.state;
    return result;
  };
  const descriptor = (streamId: string, role: string): ObservationFrame => ({
    kind: 'output',
    checkpoint: streamId,
    output: {
      type: 'stream.output',
      streamId,
      operationId: 'op',
      mediaType: 'text/plain',
      role,
      metadata: { sourceActionRunId: 'shared-run' }
    }
  });
  apply({
    kind: 'output',
    checkpoint: 'bootstrap',
    output: {
      type: 'observation.bootstrap',
      streams: [
        { streamId: 'reasoning', offset: 3, terminal: true },
        { streamId: 'content', offset: 6, terminal: false }
      ]
    }
  });
  apply(descriptor('reasoning', 'reasoning'));
  apply(descriptor('content', 'content'));
  apply({
    kind: 'stream-chunk',
    checkpoint: 'reasoning:chunk',
    streamId: 'reasoning',
    offset: 0,
    bytes: new TextEncoder().encode('why')
  });
  apply({
    kind: 'stream-end',
    checkpoint: 'reasoning:end',
    streamId: 'reasoning',
    offset: 3,
    terminal: {}
  });
  const ready = apply({
    kind: 'stream-chunk',
    checkpoint: 'content:chunk',
    streamId: 'content',
    offset: 0,
    bytes: new TextEncoder().encode('answer')
  });
  assert.equal(ready.completed, true);
  assert.deepEqual(
    ready.visible.messages.map((message) => message.content),
    ['answer']
  );
  assert.equal(state.lanes.get('content')?.ended, false);
});
