import assert from 'node:assert/strict';
import test from 'node:test';
import {
  batchDraftSource,
  batchSubscription
} from '../src/batchedNotifications.ts';
import { createToolCallDraftStore } from '../src/toolCallDraftStore.ts';

const nextTask = () => new Promise((resolve) => setTimeout(resolve, 0));

/** A minimal synchronous store, like the controller's subscribe. */
function store() {
  const listeners = new Set<() => void>();
  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    notify() {
      for (const listener of [...listeners]) listener();
    },
    size: () => listeners.size
  };
}

test('a burst of notifications reaches React once, after the burst', async () => {
  const source = store();
  let renders = 0;
  batchSubscription(source.subscribe, assert.fail)(() => renders++);

  // Four tool calls streaming at once: hundreds of frames in one task.
  for (let frame = 0; frame < 500; frame++) source.notify();
  assert.equal(renders, 0, 'nothing is delivered while the burst runs');

  await nextTask();
  assert.equal(renders, 1);

  source.notify();
  await nextTask();
  assert.equal(renders, 2, 'a later change is delivered again');
});

test('unsubscribing cancels a pending notification', async () => {
  const source = store();
  let renders = 0;
  const unsubscribe = batchSubscription(source.subscribe, assert.fail)(
    () => renders++
  );
  source.notify();
  unsubscribe();
  await nextTask();
  assert.equal(renders, 0);
  assert.equal(source.size(), 0);
});

test('a failing render is reported, not thrown from a timer', async () => {
  const source = store();
  const renderError = new Error('Maximum update depth exceeded');
  const reported: unknown[] = [];
  batchSubscription(source.subscribe, (error) => reported.push(error))(() => {
    throw renderError;
  });
  source.notify();
  await nextTask();
  assert.deepEqual(reported, [renderError]);
});

test('streamed tool-call drafts are delivered once per task per draft', async () => {
  const drafts = createToolCallDraftStore();
  const source = batchDraftSource(drafts, assert.fail);
  let renders = 0;
  source.subscribe('draft', () => renders++);

  for (let sequence = 1; sequence <= 100; sequence++) {
    drafts.apply({
      draftId: 'draft',
      llmAttemptId: 'attempt',
      callIndex: 0,
      sequence,
      toolName: 'kanban',
      phase: sequence === 1 ? 'start' : 'delta',
      delta: '{'
    });
  }
  assert.equal(renders, 0);
  await nextTask();
  assert.equal(renders, 1);
  assert.equal(source.getSnapshot('draft')?.rawInput.length, 100);
});
