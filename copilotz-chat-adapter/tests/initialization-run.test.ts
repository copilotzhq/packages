import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isCurrentInitializationRun,
  type InitializationRunState,
} from '../src/initializationRun.ts';

test('a replacement initialization run fences a delayed StrictMode run', () => {
  const first = { userId: 'user-1', generation: 1 } as const;
  const current: InitializationRunState = {
    userId: 'user-1',
    started: true,
    generation: 3,
  };

  assert.equal(
    isCurrentInitializationRun(current, first, new AbortController().signal),
    false,
  );
  assert.equal(
    isCurrentInitializationRun(
      current,
      { userId: 'user-1', generation: 3 },
      new AbortController().signal,
    ),
    true,
  );
});

test('an aborted initialization run cannot commit', () => {
  const controller = new AbortController();
  controller.abort();
  assert.equal(
    isCurrentInitializationRun(
      { userId: 'user-1', started: true, generation: 1 },
      { userId: 'user-1', generation: 1 },
      controller.signal,
    ),
    false,
  );
});
