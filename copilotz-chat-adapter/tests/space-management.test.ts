import test from 'node:test';
import assert from 'node:assert/strict';
import { invokeSpaceManagement } from '../src/spaceManagement.ts';

const stateCallback = undefined;

test('Space management waits for the host result before scoped refresh', async () => {
  let resolve!: (value: unknown) => void;
  const host = new Promise<unknown>((done) => {
    resolve = done;
  });
  let refreshes = 0;
  const run = invokeSpaceManagement(
    async (request) => {
      assert.deepEqual(request, { action: 'edit', space: { id: 'a', name: 'A' } });
      return host;
    },
    { action: 'edit', space: { id: 'a', name: 'A' } },
    stateCallback,
    async () => {
      refreshes++;
      return true;
    }
  );

  await Promise.resolve();
  assert.equal(refreshes, 0);
  resolve(undefined);
  assert.equal(await run, true);
  assert.equal(refreshes, 1);
});

test('Space management cancellation skips scoped refresh', async () => {
  let refreshes = 0;
  const result = await invokeSpaceManagement(
    async () => false,
    { action: 'delete', space: { id: 'a', name: 'A' } },
    stateCallback,
    async () => {
      refreshes++;
      return true;
    }
  );

  assert.equal(result, false);
  assert.equal(refreshes, 0);
});
