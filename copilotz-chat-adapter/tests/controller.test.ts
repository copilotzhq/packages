import test from 'node:test';
import assert from 'node:assert/strict';
import { createChatController } from '../src/controller.ts';
import type { CoreClient } from '@copilotz/copilotz/core/client';
import type { ControllerOptions } from '../src/controller.ts';
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
    controller: (options: Partial<ControllerOptions> = {}) =>
      createChatController(core as unknown as CoreClient, {
        userId: 'owner',
        ...options
      })
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

test('send start is reported before attachment upload and settled exactly once', async () => {
  const f = fixture();
  const events: string[] = [];
  f.core.assets.upload = async () => {
    events.push('upload');
    return { data: { content: { assetId: 'uploaded' } } };
  };
  f.core.threads.send = async () => {
    events.push('send');
    return { operationId: 'send-operation' };
  };
  const c = f.controller({
    onSendStart: () => events.push('start'),
    onSendSettled: () => events.push('settled')
  });
  await c.openThread('a');
  await c.send('hello', [{
    kind: 'file',
    source: new Blob(['hello']),
    dataUrl: 'blob:preview-only',
    mimeType: 'text/plain',
    fileName: 'hello.txt'
  }]);
  assert.deepEqual(events, ['start', 'upload', 'send', 'settled']);
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

test('history reconciliation failure commits the frame and does not detach observation', async () => {
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
  await f.observations[0].options.onFrame(frame);
  await new Promise((resolve) => setImmediate(resolve));
  assert.match(String(c.getSnapshot().error), /history unavailable/);
  assert.equal(f.observations[0].options.signal?.aborted, false);
  c.dispose();
  await assert.rejects(
    f.observations[0].options.onFrame(frame),
    /Thread changed/
  );
});

test('slow canonical history does not block subsequent token frames', async () => {
  const f = fixture();
  const refresh = deferred<ReturnType<typeof page>>();
  let reads = 0;
  f.core.threads.messages = async () =>
    ++reads === 1 ? page() : refresh.promise;
  const c = f.controller();
  await c.openThread('a');
  const frame = f.observations[0].options.onFrame;
  await frame({
    kind: 'output',
    checkpoint: 'one',
    output: { type: 'message.created' }
  });
  await frame({
    kind: 'output',
    checkpoint: 'two',
    output: {
      type: 'stream.output',
      streamId: 'stream',
      operationId: 'op',
      role: 'content',
      mediaType: 'text/plain',
      metadata: { sourceActionRunId: 'run' }
    }
  });
  await frame({
    kind: 'stream-chunk',
    checkpoint: 'three',
    streamId: 'stream',
    offset: 0,
    bytes: new TextEncoder().encode('fast')
  });
  assert.deepEqual(
    c.getSnapshot().messages.map((message) => message.content),
    ['fast']
  );
  refresh.resolve(page());
  c.dispose();
});

test('clean observer EOF retries while forbidden observation does not', async () => {
  const f = fixture();
  let attempts = 0;
  f.core.threads.observe = async (id, options) => {
    attempts++;
    f.observations.push({ id, options });
    if (attempts === 1) return;
    await new Promise<void>((resolve) =>
      options.signal?.addEventListener('abort', () => resolve(), { once: true })
    );
  };
  const c = f.controller();
  await c.openThread('a');
  await new Promise((resolve) => setTimeout(resolve, 300));
  assert.equal(attempts, 2);
  c.dispose();
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
  f.core.threads.send = () => {
    submitted.resolve();
    return receipt.promise;
  };
  const c = f.controller();
  await c.openThread('a');
  const sending = c.send('hello');
  await submitted.promise;
  assert.equal(c.getSnapshot().isStreaming, true);
  await f.observations[0].options.onFrame({
    kind: 'output',
    checkpoint: 'older-finished',
    output: { type: 'operation.completed', operationId: 'older' }
  });
  assert.equal(c.getSnapshot().isStreaming, true);
  receipt.reject(new Error('submission failed'));
  await sending;
  assert.equal(c.getSnapshot().isStreaming, false);
  c.dispose();
});

test('a terminal operation clears scoped preparation before an invocation arrives', async () => {
  const f = fixture();
  const settling = deferred<{ threadId: string }>();
  f.core.operations.result = () => settling.promise;
  const c = createChatController(f.core as unknown as CoreClient, {
    userId: 'owner',
    targetAgentName: 'agent'
  });
  await c.openThread('a');
  const sending = c.send('hello');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(
    c
      .getSnapshot()
      .messages.some((message) => message.id.endsWith(':preparing')),
    true
  );
  await f.observations[0].options.onFrame({
    kind: 'output',
    checkpoint: 'terminal',
    output: { type: 'operation.completed', operationId: 'send-operation' }
  });
  assert.equal(
    c
      .getSnapshot()
      .messages.some((message) => message.id.endsWith(':preparing')),
    false
  );
  settling.resolve({ threadId: 'a' });
  await sending;
  c.dispose();
});

test('older-page boundary survives live refreshes and advances until history is exhausted', async () => {
  const f = fixture();
  const requested: Array<string | undefined> = [];
  f.core.threads.messages = async (_id: string, query?: { after?: string }) => {
    requested.push(query?.after);
    return {
      data: [],
      pageInfo: {
        hasMore: query?.after !== 'second',
        next: query?.after === 'first' ? 'second' : 'first',
        checkpoint: 'boundary'
      }
    };
  };
  const c = f.controller();
  await c.openThread('a');
  assert.equal(c.getSnapshot().messagePageInfo.hasMore, true);
  await c.loadOlderMessages();
  assert.equal(c.getSnapshot().messagePageInfo.hasMore, true);
  assert.equal(c.getSnapshot().messagePageInfo.next, 'second');
  await f.observations[0].options.onFrame({
    kind: 'output',
    checkpoint: 'live',
    output: { type: 'message.created' }
  });
  assert.equal(c.getSnapshot().messagePageInfo.next, 'second');
  await c.loadOlderMessages();
  assert.equal(c.getSnapshot().messagePageInfo.hasMore, false);
  assert.deepEqual(requested, [undefined, 'first', undefined, 'second']);
  c.dispose();
});

test('loading older history cannot reveal an unfinished restoration prefix', async () => {
  const f = fixture();
  f.core.threads.messages = async () => ({
    ...page(),
    pageInfo: { hasMore: true, next: 'older', checkpoint: 'boundary' }
  });
  const c = f.controller();
  await c.openThread('a');
  const apply = f.observations[0].options.onFrame;
  await apply({
    kind: 'output',
    checkpoint: 'c',
    output: {
      type: 'observation.bootstrap',
      streams: [{ streamId: 'live', offset: 6, terminal: false }]
    }
  });
  await apply({
    kind: 'output',
    checkpoint: 'c',
    output: {
      type: 'stream.output',
      streamId: 'live',
      operationId: 'op',
      mediaType: 'text/plain',
      role: 'content',
      metadata: { sourceActionRunId: 'run' }
    }
  });
  await apply({
    kind: 'stream-chunk',
    checkpoint: 'c',
    streamId: 'live',
    offset: 0,
    bytes: new TextEncoder().encode('abc')
  });
  await c.loadOlderMessages();
  assert.deepEqual(c.getSnapshot().messages, []);
  await apply({
    kind: 'stream-chunk',
    checkpoint: 'c',
    streamId: 'live',
    offset: 3,
    bytes: new TextEncoder().encode('def')
  });
  assert.deepEqual(
    c.getSnapshot().messages.map((message) => message.content),
    ['abcdef']
  );
  c.dispose();
});

test('a transient initial history failure retries before attaching observation', async () => {
  const f = fixture();
  let reads = 0;
  f.core.threads.messages = async () => {
    if (++reads === 1) {
      throw Object.assign(new Error('Unavailable'), { status: 503 });
    }
    return page();
  };
  const c = f.controller();
  await c.openThread('a');
  assert.equal(reads, 2);
  assert.equal(f.observations.length, 1);
  assert.equal(c.getSnapshot().error, null);
  c.dispose();
});

test('new-thread preparation keeps its identity through invocation and tokens', async () => {
  const f = fixture();
  const c = createChatController(f.core as unknown as CoreClient, {
    userId: 'owner',
    targetAgentName: 'north'
  });
  await c.send('hello');
  assert.equal(c.getSnapshot().currentThreadId, 'new-thread');
  assert.ok(
    c
      .getSnapshot()
      .messages.some((m) => m.role === 'user' && m.content === 'hello')
  );
  const preparing = c
    .getSnapshot()
    .messages.find((m) => m.id.endsWith(':preparing'));
  assert.ok(preparing);
  await f.observations[0].options.onFrame({
    kind: 'output',
    output: {
      type: 'llm.call.invoked',
      operationId: 'send-operation',
      data: {
        actionRunId: 'attempt',
        metadata: { schema: 'copilotz.core.llm-call.v1', agentId: 'north' }
      }
    }
  } as any);
  const invoked = c
    .getSnapshot()
    .messages.find((m) => m.metadata?.llmAttemptId === 'attempt');
  assert.equal(invoked?.id, preparing.id);
  assert.equal(invoked?.metadata?.operationId, 'send-operation');
  await f.observations[0].options.onFrame({
    kind: 'output',
    output: {
      type: 'stream.output',
      operationId: 'send-operation',
      streamId: 'answer',
      role: 'content',
      mediaType: 'text/plain',
      metadata: { sourceActionRunId: 'attempt' }
    }
  } as any);
  await f.observations[0].options.onFrame({
    kind: 'stream-chunk',
    streamId: 'answer',
    offset: 0,
    bytes: new TextEncoder().encode('hello back')
  } as any);
  const streamed = c
    .getSnapshot()
    .messages.find((m) => m.metadata?.llmAttemptId === 'attempt');
  assert.equal(streamed?.id, preparing.id);
  assert.equal(streamed?.content, 'hello back');
  c.dispose();
});

test('simultaneous navigation cannot publish or fetch the superseded thread', async () => {
  const f = fixture();
  const reads: string[] = [];
  f.core.threads.messages = async (id) => {
    reads.push(id);
    return page();
  };
  const c = f.controller();
  const seen: (string | null)[] = [];
  c.subscribe(() => seen.push(c.getSnapshot().currentThreadId));
  await Promise.all([c.openThread('old'), c.openThread('selected')]);
  assert.deepEqual(reads, ['selected']);
  assert.equal(seen.includes('old'), false);
  c.dispose();
});

const listedThread = {
  id: 'thread-a',
  name: 'Thread A',
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString(),
  status: 'active',
  metadata: {},
  participants: []
};

test('Space move is optimistic and restores the confirmed placement after a rejected move', async () => {
  const f = fixture();
  f.core.threads.list = async () => ({
    data: [listedThread],
    pageInfo: { hasMore: false }
  });
  const failure = deferred<void>();
  const c = f.controller({
    spaceService: {
      list: async () => [{ id: 'research', name: 'Research' }],
      create: async (name) => ({ id: 'new', name }),
      move: async () => failure.promise
    }
  });
  await c.start();
  const moving = c.moveThreadToSpace('thread-a', 'research');
  assert.equal(c.getSnapshot().threads[0].spaceId, 'research');
  failure.reject(new Error('Forbidden'));
  assert.equal(await moving, false);
  assert.equal(c.getSnapshot().threads[0].spaceId, null);
  assert.match(String(c.getSnapshot().error), /Forbidden/);
  c.dispose();
});

test('Space moves for one thread are serialized so an older failure cannot roll back a newer placement', async () => {
  const f = fixture();
  f.core.threads.list = async () => ({
    data: [listedThread],
    pageInfo: { hasMore: false }
  });
  const first = deferred<void>();
  const second = deferred<void>();
  const calls: string[] = [];
  let spaces = [
    { id: 'one', name: 'One', threadIds: [] as string[] },
    { id: 'two', name: 'Two', threadIds: [] as string[] }
  ];
  const c = f.controller({
    spaceService: {
      list: async () => spaces,
      create: async (name) => ({ id: name, name }),
      move: async (_id, spaceId) => {
        calls.push(spaceId!);
        if (spaceId === 'one') {
          await first.promise;
          spaces = [
            { id: 'one', name: 'One', threadIds: ['thread-a'] },
            { id: 'two', name: 'Two', threadIds: [] }
          ];
          return;
        }
        return second.promise;
      }
    }
  });
  await c.start();
  const movingOne = c.moveThreadToSpace('thread-a', 'one');
  const movingTwo = c.moveThreadToSpace('thread-a', 'two');
  assert.deepEqual(calls, ['one']);
  first.resolve();
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(calls, ['one', 'two']);
  second.reject(new Error('Forbidden'));
  assert.equal(await movingOne, true);
  assert.equal(await movingTwo, false);
  assert.equal(c.getSnapshot().threads[0].spaceId, 'one');
  c.dispose();
});

test('two rejected queued Space moves restore the initial placement', async () => {
  const f = fixture();
  f.core.threads.list = async () => ({
    data: [listedThread],
    pageInfo: { hasMore: false }
  });
  const first = deferred<void>();
  const second = deferred<void>();
  const calls: string[] = [];
  const c = f.controller({
    spaceService: {
      list: async () => [],
      create: async (name) => ({ id: name, name }),
      move: async (_id, spaceId) => {
        calls.push(spaceId!);
        return (spaceId === 'one' ? first : second).promise;
      }
    }
  });
  await c.start();
  const movingOne = c.moveThreadToSpace('thread-a', 'one');
  const movingTwo = c.moveThreadToSpace('thread-a', 'two');
  first.reject(new Error('first move denied'));
  await new Promise((resolve) => setImmediate(resolve));
  second.reject(new Error('second move denied'));
  assert.equal(await movingOne, false);
  assert.equal(await movingTwo, false);
  assert.deepEqual(calls, ['one', 'two']);
  assert.equal(c.getSnapshot().threads[0].spaceId, null);
  c.dispose();
});

test('a successful Space read can confirm reassignment and remote detach', async () => {
  const f = fixture();
  f.core.threads.list = async () => ({
    data: [listedThread],
    pageInfo: { hasMore: false }
  });
  let spaces: Array<{ id: string; name: string; threadIds?: string[] }> = [
    { id: 'one', name: 'One' }
  ];
  const c = f.controller({
    spaceService: {
      list: async () => spaces,
      create: async (name) => ({ id: 'new', name }),
      move: async () => undefined
    }
  });
  await c.start();
  spaces = [{ id: 'one', name: 'One', threadIds: ['thread-a'] }];
  assert.equal(await c.moveThreadToSpace('thread-a', 'one'), true);
  assert.equal(c.getSnapshot().threads[0].spaceId, 'one');

  spaces = [{ id: 'two', name: 'Two', threadIds: ['thread-a'] }];
  await c.refreshThreads();
  assert.equal(c.getSnapshot().threads[0].spaceId, 'two');

  spaces = [{ id: 'two', name: 'Two', threadIds: [] }];
  await c.refreshThreads();
  assert.equal(c.getSnapshot().threads[0].spaceId, null);

  const list = c.getSnapshot().spaces;
  c.updateOptions({
    userId: 'owner',
    spaceService: {
      list: async () => {
        throw new Error('Space service unavailable');
      },
      create: async (name) => ({ id: 'new', name }),
      move: async () => undefined
    }
  });
  await c.refreshThreads();
  assert.deepEqual(c.getSnapshot().spaces, list);
  assert.equal(c.getSnapshot().threads[0].spaceId, null);
  c.dispose();
});

test('failed Space creation reports an error while retaining conversation navigation', async () => {
  const f = fixture();
  const c = f.controller({
    spaceService: {
      list: async () => [],
      create: async () => {
        throw new Error('Space creation denied');
      },
      move: async () => undefined
    }
  });
  await c.start();
  assert.equal(await c.createSpace('Research'), undefined);
  assert.match(String(c.getSnapshot().error), /Space creation denied/);
  assert.deepEqual(c.getSnapshot().threads, []);
  c.dispose();
});

test('list-only Space service exposes read-only discovery without mutation success', async () => {
  const f = fixture();
  f.core.threads.list = async () => ({
    data: [listedThread],
    pageInfo: { hasMore: false }
  });
  const c = f.controller({
    spaceService: {
      list: async () => [{ id: 'research', name: 'Research' }]
    }
  });
  await c.start();
  assert.deepEqual(c.getSnapshot().spaces, [{ id: 'research', name: 'Research' }]);
  assert.equal(await c.createSpace('New Space'), undefined);
  assert.equal(await c.moveThreadToSpace('thread-a', 'research'), false);
  c.dispose();
});

test('Space creation returns the host record and refreshes the Space snapshot', async () => {
  const f = fixture();
  let spaces: Array<{ id: string; name: string }> = [];
  let requestedName = '';
  const c = f.controller({
    spaceService: {
      list: async () => spaces,
      create: async (name) => {
        requestedName = name;
        const created = { id: 'research', name };
        spaces = [created];
        return created;
      },
      move: async () => undefined
    }
  });
  await c.start();
  const created = await c.createSpace('  Research  ');
  assert.deepEqual(created, { id: 'research', name: 'Research' });
  assert.equal(requestedName, 'Research');
  assert.deepEqual(c.getSnapshot().spaces, [created]);
  c.dispose();
});

test('refreshSpaces updates only the Space snapshot', async () => {
  const f = fixture();
  let threadListCalls = 0;
  let spaces: Array<{ id: string; name: string }> = [
    { id: 'research', name: 'Research' }
  ];
  f.core.threads.list = async () => {
    threadListCalls++;
    return { data: [listedThread], pageInfo: { hasMore: false } };
  };
  const c = f.controller({
    spaceService: {
      list: async () => spaces,
      create: async (name) => ({ id: name, name }),
      move: async () => undefined
    }
  });
  await c.start();
  const threadSnapshot = c.getSnapshot().threads;
  spaces = [{ id: 'planning', name: 'Planning' }];

  assert.equal(await c.refreshSpaces(), true);
  assert.equal(threadListCalls, 1);
  assert.deepEqual(c.getSnapshot().spaces, spaces);
  assert.equal(c.getSnapshot().threads, threadSnapshot);
  c.dispose();
});

test('a committed Space move survives a failed thread refresh', async () => {
  const f = fixture();
  f.core.threads.list = async () => ({
    data: [listedThread],
    pageInfo: { hasMore: false }
  });
  let failRefresh = false;
  const c = f.controller({
    spaceService: {
      list: async () => [{ id: 'research', name: 'Research' }],
      create: async (name) => ({ id: 'new', name }),
      move: async () => undefined
    }
  });
  await c.start();
  f.core.threads.list = async () => {
    if (failRefresh) throw new Error('thread refresh unavailable');
    return { data: [listedThread], pageInfo: { hasMore: false } };
  };
  failRefresh = true;
  assert.equal(await c.moveThreadToSpace('thread-a', 'research'), true);
  assert.equal(c.getSnapshot().threads[0].spaceId, 'research');
  assert.match(String(c.getSnapshot().error), /thread refresh unavailable/);
  c.dispose();
});
