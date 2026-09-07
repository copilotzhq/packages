import test from 'node:test';
import assert from 'node:assert/strict';
import { createHistoryReconciliation } from '../src/historyReconciliation.ts';

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
const tick = () => new Promise<void>((resolve) => setImmediate(resolve));

test('refresh requests coalesce and an aborted generation cannot publish late history', async () => {
  const abort = new AbortController();
  const first = deferred<number>();
  let loads = 0;
  const applied: number[] = [];
  const queue = createHistoryReconciliation({
    signal: abort.signal,
    load: () => (++loads === 1 ? first.promise : Promise.resolve(loads)),
    apply: async (value) => {
      applied.push(value);
    },
    onError: assert.fail,
    onRecovered: assert.fail
  });
  queue.request();
  queue.request();
  queue.request();
  first.resolve(1);
  await tick();
  assert.deepEqual(applied, [1, 2]);
  assert.equal(loads, 2);
  abort.abort();
  queue.request();
  assert.equal(loads, 2);

  const old = deferred<number>();
  const cancelled = new AbortController();
  const late = createHistoryReconciliation({
    signal: cancelled.signal,
    load: () => old.promise,
    apply: async () => assert.fail('stale generation applied'),
    onError: assert.fail,
    onRecovered: assert.fail
  });
  late.request();
  cancelled.abort();
  old.resolve(3);
  await tick();
});

test('policy failures and projection bugs are not automatically retried', async () => {
  for (const applying of [false, true]) {
    let reads = 0;
    const error = applying
      ? new TypeError('projection bug')
      : Object.assign(new Error('Forbidden'), { status: 403 });
    const errors: unknown[] = [];
    const queue = createHistoryReconciliation({
      signal: new AbortController().signal,
      load: async () => {
        reads++;
        if (!applying) throw error;
        return 1;
      },
      apply: async () => {
        throw error;
      },
      onError: (value) => errors.push(value),
      onRecovered: assert.fail
    });
    queue.request();
    await tick();
    assert.deepEqual(errors, [error]);
    assert.equal(reads, 1);
  }
});

test('a request queued during a failed read still gets its own reconciliation', async () => {
  const gate = deferred<void>();
  let reads = 0;
  const applied: number[] = [];
  const queue = createHistoryReconciliation({
    signal: new AbortController().signal,
    load: async () => {
      if (++reads === 1) {
        await gate.promise;
        throw Object.assign(new Error('Conflict'), { status: 409 });
      }
      return reads;
    },
    apply: async (value) => {
      applied.push(value);
    },
    onError: () => {},
    onRecovered: () => {}
  });
  queue.request();
  queue.request();
  gate.resolve();
  await tick();
  assert.equal(reads, 2);
  assert.deepEqual(applied, [2]);
});
