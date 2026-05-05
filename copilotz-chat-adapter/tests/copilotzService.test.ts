import test from 'node:test';
import assert from 'node:assert/strict';
import { runCopilotzStream } from '../src/copilotzService.ts';

test('runCopilotzStream sends stable participant and target identifiers', async () => {
  const originalFetch = globalThis.fetch;
  let capturedBody: any = null;

  globalThis.fetch = async (_input: RequestInfo | URL, init?: RequestInit) => {
    capturedBody = JSON.parse(String(init?.body ?? '{}'));
    return new Response('', {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    });
  };

  try {
    await runCopilotzStream({
      content: 'Hello team',
      user: { externalId: 'user-123', name: 'User' },
      selectedAgent: 'west',
      participants: ['west', 'north', 'east', 'south'],
      targetAgent: 'west',
    });
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.deepEqual(capturedBody.thread.participants, [
    'west',
    'north',
    'east',
    'south',
    'user-123',
  ]);
  assert.equal(capturedBody.target, 'west');
  assert.equal(capturedBody.sender.externalId, 'user-123');
  assert.equal(capturedBody.content, 'Hello team');
});
