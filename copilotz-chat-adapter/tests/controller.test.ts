import test from 'node:test';
import assert from 'node:assert/strict';
import { createChatController } from '../src/controller.ts';
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
const page = (checkpoint = 'boundary') => ({
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
      messages: async (_id: string) => page(),
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
      result: async () => ({ threadId: 'new-thread' }),
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

test('navigation during the initial thread list cannot restore the old URL thread', async () => {
  const f = fixture();
  const listing = deferred<ReturnType<typeof page>>();
  f.core.threads.list = () => listing.promise;
  const c = f.controller();
  const starting = c.start('old-url');
  await c.openThread('selected');
  listing.resolve(page());
  await starting;
  assert.equal(c.getSnapshot().currentThreadId, 'selected');
  assert.deepEqual(
    f.observations.map((value) => value.id),
    ['selected']
  );
  c.dispose();
});

test('a replaced history bootstrap cannot overwrite the selected thread or attach an old observer', async () => {
  const f = fixture();
  const a = deferred<ReturnType<typeof page>>();
  f.core.threads.messages = (id) =>
    id === 'a' ? a.promise : Promise.resolve(page('b-boundary'));
  const c = f.controller();
  const opening = c.openThread('a');
  await c.openThread('b');
  a.resolve(page('a-boundary'));
  await opening;
  assert.equal(c.getSnapshot().currentThreadId, 'b');
  assert.deepEqual(
    f.observations.map((o) => [o.id, o.options.checkpoint]),
    [['b', 'b-boundary']]
  );
  c.dispose();
});

test('dispose fences history and detaches observation without durably cancelling operations', async () => {
  const f = fixture();
  const c = f.controller();
  await c.openThread('a');
  c.dispose();
  assert.equal(f.observations[0].options.signal?.aborted, true);
  assert.deepEqual(f.cancellations, []);
  const g = fixture();
  const history = deferred<ReturnType<typeof page>>();
  g.core.threads.messages = () => history.promise;
  const d = g.controller();
  const opening = d.openThread('a');
  d.dispose();
  history.resolve(page());
  await opening;
  assert.equal(g.observations.length, 0);
});

test('Stop before the submission receipt cancels that exact operation when the receipt arrives', async () => {
  const f = fixture();
  const receipt = deferred<{ operationId: string }>();
  const submitted = deferred<void>();
  f.core.threads.send = () => {
    submitted.resolve();
    return receipt.promise;
  };
  const c = f.controller();
  await c.openThread('a');
  const sending = c.send('hello');
  await submitted.promise;
  await c.stop();
  assert.deepEqual(f.cancellations, []);
  receipt.resolve({ operationId: 'late-receipt' });
  await sending;
  assert.deepEqual(f.cancellations, ['late-receipt']);
  c.dispose();
});

test('Stop on a new thread does not cancel a submission owned by the previously selected thread', async () => {
  const f = fixture();
  const receipt = deferred<{ operationId: string }>();
  const submitted = deferred<void>();
  f.core.threads.send = () => {
    submitted.resolve();
    return receipt.promise;
  };
  const c = f.controller();
  await c.openThread('a');
  const sending = c.send('hello');
  await submitted.promise;
  await c.openThread('b');
  await c.stop();
  receipt.resolve({ operationId: 'old-operation' });
  await sending;
  assert.deepEqual(f.cancellations, []);
  assert.equal(c.getSnapshot().currentThreadId, 'b');
  c.dispose();
});

test('failed frame application rejects before checkpoint commit and a disposed controller cannot apply frames', async () => {
  const f = fixture();
  const c = f.controller();
  await c.openThread('a');
  const frame = {
    kind: 'output' as const,
    checkpoint: 'next',
    output: { type: 'message.created' }
  };
  f.core.threads.messages = async () => {
    throw new Error('history unavailable');
  };
  await assert.rejects(
    f.observations[0].options.onFrame(frame),
    /history unavailable/
  );
  c.dispose();
  await assert.rejects(
    f.observations[0].options.onFrame(frame),
    /Thread changed/
  );
});

test('an edit settling after navigation cannot reopen either thread', async () => {
  const f = fixture();
  const result = deferred<{ threadId: string }>();
  f.core.operations.result = () => result.promise;
  const c = f.controller();
  await c.openThread('a');
  const editing = c.editMessage('message', 'edit');
  await c.openThread('b');
  result.resolve({ threadId: 'a' });
  await editing;
  assert.deepEqual(
    f.observations.map((o) => o.id),
    ['a', 'b']
  );
  c.dispose();
});

test('resetting to a new thread clears a pending history spinner', async () => {
  const f = fixture();
  const history = deferred<ReturnType<typeof page>>();
  f.core.threads.messages = () => history.promise;
  const c = f.controller();
  const opening = c.openThread('a');
  await Promise.resolve();
  await Promise.resolve();
  c.createThread();
  history.resolve(page());
  await opening;
  assert.equal(c.getSnapshot().currentThreadId, null);
  assert.equal(c.getSnapshot().isMessagesLoading, false);
  c.dispose();
});

test('a forbidden observation stops the spinner without retrying or losing cancellation identity', async () => {
  const f = fixture();
  const observing = deferred<void>();
  const settling = deferred<{ threadId: string }>();
  let attempts = 0;
  f.core.threads.observe = async (id, options) => {
    attempts++;
    f.observations.push({ id, options });
    await observing.promise;
  };
  f.core.operations.result = () => settling.promise;
  const c = f.controller();
  await c.openThread('a');
  const sending = c.send('hello');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(c.getSnapshot().isStreaming, true);
  observing.reject(Object.assign(new Error('Forbidden'), { status: 403 }));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(c.getSnapshot().isStreaming, false);
  assert.match(String(c.getSnapshot().error), /Forbidden/);
  settling.resolve({ threadId: 'a' });
  await sending;
  assert.equal(c.getSnapshot().isStreaming, false);
  assert.equal(attempts, 1);
  assert.deepEqual(f.cancellations, []);
  await c.stop();
  assert.deepEqual(f.cancellations, ['send-operation']);
  c.dispose();
});

test('pending submission stays active while an older observed operation settles', async () => {
  const f = fixture();
  const receipt = deferred<{ operationId: string }>();
  const submitted = deferred<void>();
  f.core.threads.send = () => { submitted.resolve(); return receipt.promise; };
  const c = f.controller();
  await c.openThread('a');
  const sending = c.send('hello');
  await submitted.promise;
  assert.equal(c.getSnapshot().isStreaming, true);
  await f.observations[0].options.onFrame({
    kind: 'output', checkpoint: 'older-finished',
    output: { type: 'operation.completed', operationId: 'older' }
  });
  assert.equal(c.getSnapshot().isStreaming, true);
  receipt.reject(new Error('submission failed'));
  await sending;
  assert.equal(c.getSnapshot().isStreaming, false);
  c.dispose();
});
