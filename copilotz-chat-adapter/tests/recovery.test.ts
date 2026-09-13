import test from 'node:test';
import assert from 'node:assert/strict';
import { createChatController } from '../src/controller.ts';
import { createObservationSupervisor } from '../src/observationSupervisor.ts';
import { createObservationBootstrap } from '../src/observationBootstrap.ts';
import { emptyProjection } from '../src/projection.ts';
import { createToolCallDraftStore } from '../src/toolCallDraftStore.ts';
import type { CoreClient } from '@copilotz/copilotz/core/client';

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};

const page = (checkpoint = 'history') => ({
  data: [],
  pageInfo: { hasMore: false, checkpoint }
});

function fixture() {
  const observations: Array<{
    id: string;
    options: Parameters<CoreClient['threads']['observe']>[1];
  }> = [];
  const cancellations: string[] = [];
  const core = {
    threads: {
      list: async () => page(),
      messages: async () => page(),
      observe: async (
        id: string,
        options: Parameters<CoreClient['threads']['observe']>[1]
      ) => {
        observations.push({ id, options });
        await new Promise<void>((resolve) =>
          options.signal?.addEventListener('abort', () => resolve(), {
            once: true
          })
        );
      },
      send: async () => ({ operationId: 'send-operation' }),
      update: async () => ({ operationId: 'update-operation' }),
      delete: async () => ({ operationId: 'delete-operation' })
    },
    operations: {
      get: async () => ({ state: 'running' }),
      result: async () => ({ threadId: 'thread' }),
      cancel: async (id: string) => {
        cancellations.push(id);
      }
    },
    messages: {
      edit: async () => ({ operationId: 'edit-operation' }),
      asset: async () => new Response('asset')
    },
    assets: {
      upload: async () => ({ data: { content: { assetId: 'uploaded' } } }),
      get: async () => new Response('asset')
    }
  };
  return {
    core,
    observations,
    cancellations,
    controller: () =>
      createChatController(core as unknown as CoreClient, { userId: 'owner' })
  };
}

const wait = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

test('a subscriber failure does not prevent applied checkpoint progress', async () => {
  const f = fixture();
  let attempts = 0;
  f.core.threads.observe = async (id, options) => {
    attempts += 1;
    f.observations.push({ id, options });
    if (attempts === 1) {
      await options.onFrame?.({
        kind: 'output',
        checkpoint: 'applied-after-render-error',
        output: { type: 'message.created' }
      });
      throw Object.assign(new Error('connection lost'), {
        name: 'TransportError'
      });
    }
    await new Promise<void>((resolve) =>
      options.signal?.addEventListener('abort', () => resolve(), {
        once: true
      })
    );
  };
  const c = f.controller();
  await c.openThread('thread');
  const renderError = new Error('render failed');
  c.subscribe(() => {
    throw renderError;
  });
  await wait(350);
  assert.equal(f.observations[1]?.options.checkpoint, 'applied-after-render-error');
  assert.equal(c.getSnapshot().error, renderError);
  c.dispose();
});

test('a frame projection failure resyncs history before reconnecting', async () => {
  const f = fixture();
  let messageReads = 0;
  f.core.threads.messages = async () => page(++messageReads === 1 ? 'initial' : 'resynced');
  let attempts = 0;
  f.core.threads.observe = async (id, options) => {
    attempts += 1;
    f.observations.push({ id, options });
    if (attempts === 1) {
      await options.onFrame?.({
        kind: 'stream-chunk',
        streamId: 'missing-lane',
        checkpoint: 'poison'
      });
      return;
    }
    await new Promise<void>((resolve) =>
      options.signal?.addEventListener('abort', () => resolve(), {
        once: true
      })
    );
  };
  const c = f.controller();
  await c.openThread('thread');
  await wait(350);
  assert.equal(f.observations[1]?.options.checkpoint, 'resynced');
  c.dispose();
});

test('authoritative resync clears an operation whose terminal frame was missed', async () => {
  const f = fixture();
  let messageReads = 0;
  f.core.threads.messages = async () =>
    page(++messageReads === 1 ? 'initial' : 'authoritative');
  let attempts = 0;
  f.core.threads.observe = async (id, options) => {
    attempts += 1;
    f.observations.push({ id, options });
    if (attempts === 1) {
      await options.onFrame?.({
        kind: 'output',
        checkpoint: 'running',
        output: { type: 'message.created', operationId: 'ended-operation' }
      });
      await options.onFrame?.({
        kind: 'stream-chunk',
        streamId: 'missing-lane',
        checkpoint: 'poison'
      });
      return;
    }
    await options.onFrame?.({
      kind: 'output',
      checkpoint: 'after-bootstrap',
      output: {
        type: 'observation.bootstrap',
        streams: [],
        more: false
      }
    });
    await options.onFrame?.({
      kind: 'output',
      checkpoint: 'after-resync',
      output: { type: 'message.created' }
    });
    await new Promise<void>((resolve) =>
      options.signal?.addEventListener('abort', () => resolve(), {
        once: true
      })
    );
  };
  const c = f.controller();
  await c.openThread('thread');
  await wait(350);
  assert.equal(f.observations[1]?.options.checkpoint, 'authoritative');
  assert.equal(c.getSnapshot().isStreaming, false);
  assert.equal(f.cancellations.length, 0);
  c.dispose();
});

test('repeated poison frames expose recovery without cancelling operations', async () => {
  const f = fixture();
  let attempts = 0;
  f.core.threads.observe = async (id, options) => {
    attempts += 1;
    f.observations.push({ id, options });
    await options.onFrame?.({
      kind: 'output',
      checkpoint: `valid-${attempts}`,
      output: { type: 'message.created' }
    });
    await options.onFrame?.({
      kind: 'stream-chunk',
      streamId: 'missing-lane',
      checkpoint: 'poison'
    });
  };
  const c = f.controller();
  await c.openThread('thread');
  await wait(900);
  assert.match(String(c.getSnapshot().error), /resynchronize|applied repeatedly/i);
  assert.equal(f.cancellations.length, 0);
  assert.equal(c.getSnapshot().isStreaming, false);
  c.dispose();
});

test('stop remains active after cancellation acknowledgement until result confirmation', async () => {
  const f = fixture();
  const result = deferred<unknown>();
  const c = f.controller();
  await c.openThread('thread');
  await f.observations[0].options.onFrame?.({
    kind: 'output',
    checkpoint: 'running',
    output: { type: 'message.created', operationId: 'operation-1' }
  });
  f.core.operations.result = async (id: string) => result.promise;
  await c.stop();
  assert.equal(c.getSnapshot().isStopping, true);
  result.resolve({});
  await wait();
  assert.equal(c.getSnapshot().isStopping, false);
  assert.deepEqual(f.cancellations, ['operation-1']);
  c.dispose();
});

test('stop confirmation from an old generation cannot clear the new thread state', async () => {
  const f = fixture();
  const result = deferred<unknown>();
  const c = f.controller();
  await c.openThread('a');
  await f.observations[0].options.onFrame?.({
    kind: 'output',
    checkpoint: 'running',
    output: { type: 'message.created', operationId: 'operation-1' }
  });
  f.core.operations.result = async () => result.promise;
  await c.stop();
  await c.openThread('b');
  assert.equal(c.getSnapshot().isStopping, false);
  result.resolve({});
  await wait();
  assert.equal(c.getSnapshot().currentThreadId, 'b');
  assert.equal(c.getSnapshot().isStopping, false);
  c.dispose();
});

test('a delayed send receipt treats terminal cancellation as an expected result', async () => {
  const f = fixture();
  const receipt = deferred<{ operationId: string }>();
  f.core.threads.send = async () => receipt.promise;
  f.core.operations.result = async () => {
    throw Object.assign(new Error('Action did not complete.'), {
      code: 'action_not_completed'
    });
  };
  f.core.operations.get = async () => ({ state: 'cancelled' });
  const c = f.controller();
  await c.openThread('thread');
  const sending = c.send('hello');
  await wait();
  await c.stop();
  receipt.resolve({ operationId: 'operation-delayed' });
  await sending;
  assert.equal(c.getSnapshot().error, null);
  assert.equal(c.getSnapshot().isStopping, false);
  assert.deepEqual(f.cancellations, ['operation-delayed']);
  c.dispose();
});

test('cancellation failure is reported and does not masquerade as a completed stop', async () => {
  const f = fixture();
  const c = f.controller();
  await c.openThread('thread');
  await f.observations[0].options.onFrame?.({
    kind: 'output',
    checkpoint: 'running',
    output: { type: 'message.created', operationId: 'operation-1' }
  });
  f.core.operations.cancel = async () => {
    throw new Error('cancel endpoint unavailable');
  };
  await c.stop();
  assert.match(String(c.getSnapshot().error), /cancel endpoint unavailable/);
  assert.equal(c.getSnapshot().isStopping, false);
  c.dispose();
});

test('a throwing draft subscriber is removed and reported without rejecting apply', () => {
  const errors: unknown[] = [];
  const store = createToolCallDraftStore({
    onSubscriberError: (error) => errors.push(error)
  });
  const error = new Error('draft render failed');
  store.subscribe('draft', () => {
    throw error;
  });
  assert.doesNotThrow(() =>
    store.apply({
      draftId: 'draft',
      llmAttemptId: 'attempt',
      callIndex: 0,
      sequence: 1,
      toolName: 'lookup',
      phase: 'start',
      delta: '{'
    })
  );
  assert.deepEqual(errors, [error]);
});

test('malformed bootstrap declarations do not partially commit valid lanes', () => {
  const bootstrap = createObservationBootstrap();
  const state = emptyProjection();
  assert.throws(
    () =>
      bootstrap.apply(
        {
          kind: 'output',
          checkpoint: 'poison',
          output: {
            type: 'observation.bootstrap',
            more: true,
            streams: [
              { streamId: 'valid', offset: 0, terminal: false },
              { streamId: 42, offset: 1, terminal: false }
            ]
          }
        } as never,
        state
      ),
    /Invalid observation bootstrap stream/
  );
  assert.equal(bootstrap.isPending(), false);
});

test('supervisor keeps one bounded reconnect loop', async () => {
  let starts = 0;
  let retries = 0;
  const supervisor = createObservationSupervisor({
    observe: async () => {
      starts += 1;
      throw Object.assign(new Error('network'), { name: 'TransportError' });
    },
    retryable: (error) => (error as { name?: string })?.name === 'TransportError',
    onRetry: () => {
      retries += 1;
    },
    onError: assert.fail
  });
  supervisor.start();
  await wait(1100);
  assert.ok(starts >= 2);
  assert.equal(supervisor.active, true);
  assert.ok(retries >= 2);
  supervisor.close();
});

test('completed replay is inactive and late historical events cannot reactivate it', async () => {
  const f = fixture();
  let reads = 0;
  f.core.operations.get = async () => { reads += 1; return { state: 'completed' }; };
  const c = f.controller();
  try {
    await c.openThread('thread');
    const frame = f.observations[0].options.onFrame!;
    await frame({ kind: 'output', checkpoint: 'bootstrap', output: {
      type: 'observation.bootstrap', streams: [{ streamId: 'old', offset: 0, terminal: true }], more: false
    }} as never);
    await frame({ kind: 'output', checkpoint: 'descriptor', output: {
      type: 'stream.output', operationId: 'done', streamId: 'old', role: 'reasoning', mediaType: 'text/plain',
      metadata: { sourceActionRunId: 'attempt' }
    }} as never);
    await frame({ kind: 'stream-end', checkpoint: 'end', streamId: 'old', offset: 0,
      terminal: { outcome: 'completed', availability: 'retained', capture: 'complete', offset: 0 }
    } as never);
    await wait();
    assert.equal(c.getSnapshot().isStreaming, false);
    await frame({ kind: 'output', checkpoint: 'late', output: { type: 'message.created', operationId: 'done' }} as never);
    assert.equal(c.getSnapshot().isStreaming, false);
    assert.equal(reads, 1);
  } finally { c.dispose(); }
});

test('active operations stay active between calls and heartbeat repairs missing completion', async () => {
  const f = fixture();
  let state = 'running';
  f.core.operations.get = async () => ({ state });
  const c = f.controller();
  try {
    await c.openThread('thread');
    const frame = f.observations[0].options.onFrame!;
    await frame({ kind: 'output', checkpoint: 'call', output: { type: 'message.created', operationId: 'op' }} as never);
    await wait();
    assert.equal(c.getSnapshot().isStreaming, true);
    state = 'completed';
    await frame({ kind: 'output', checkpoint: 'heartbeat', output: { type: 'observation.heartbeat' }} as never);
    await wait();
    assert.equal(c.getSnapshot().isStreaming, false);
  } finally { c.dispose(); }
});

test('a pending status read neither blocks terminal frames nor revives a completed operation', async () => {
  const f = fixture();
  const pending = deferred<{ state: string }>();
  f.core.operations.get = () => pending.promise;
  const c = f.controller();
  try {
    await c.openThread('thread');
    const frame = f.observations[0].options.onFrame!;
    await frame({ kind: 'output', checkpoint: 'call', output: { type: 'message.created', operationId: 'op' }} as never);
    await frame({ kind: 'output', checkpoint: 'done', output: { type: 'operation.completed', operationId: 'op' }} as never);
    assert.equal(c.getSnapshot().isStreaming, false);
    pending.resolve({ state: 'running' });
    await wait();
    assert.equal(c.getSnapshot().isStreaming, false);
  } finally { c.dispose(); }
});

test('a delayed terminal status from another thread cannot clear the current run', async () => {
  const f = fixture();
  const pending = deferred<{ state: string }>();
  let reads = 0;
  f.core.operations.get = () => ++reads === 1 ? pending.promise : Promise.resolve({ state: 'running' });
  const c = f.controller();
  try {
    await c.openThread('old');
    await f.observations[0].options.onFrame!({ kind: 'output', checkpoint: 'old', output: { type: 'message.created', operationId: 'op' }} as never);
    await c.openThread('new');
    await f.observations[1].options.onFrame!({ kind: 'output', checkpoint: 'new', output: { type: 'message.created', operationId: 'op' }} as never);
    pending.resolve({ state: 'completed' });
    await wait();
    assert.equal(c.getSnapshot().currentThreadId, 'new');
    assert.equal(c.getSnapshot().isStreaming, true);
  } finally { c.dispose(); }
});
