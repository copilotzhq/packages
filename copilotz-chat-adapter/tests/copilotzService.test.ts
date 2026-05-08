import test from 'node:test';
import assert from 'node:assert/strict';
import { runCopilotzStream } from '../src/copilotzService.ts';

const sse = (event: string, data: unknown) =>
  `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

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

test('runCopilotzStream resets token aggregation between completed LLM token sequences', async () => {
  const originalFetch = globalThis.fetch;
  const encoder = new TextEncoder();
  const tokenUpdates: Array<{ text: string; complete: boolean }> = [];

  globalThis.fetch = async () => {
    const body = [
      sse('TOKEN', { type: 'TOKEN', payload: { token: 'First answer', isComplete: false } }),
      sse('TOKEN', { type: 'TOKEN', payload: { token: '', isComplete: true } }),
      sse('LLM_RESULT', { type: 'LLM_RESULT', payload: { answer: 'First answer' } }),
      sse('TOKEN', { type: 'TOKEN', payload: { token: 'Second answer', isComplete: false } }),
      sse('TOKEN', { type: 'TOKEN', payload: { token: '', isComplete: true } }),
      sse('LLM_RESULT', { type: 'LLM_RESULT', payload: { answer: 'Second answer' } }),
    ].join('');

    return new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(body));
          controller.close();
        },
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'text/event-stream' },
      },
    );
  };

  try {
    const result = await runCopilotzStream({
      content: 'Hello',
      user: { externalId: 'user-123', name: 'User' },
      onToken: (text, complete) => {
        tokenUpdates.push({ text, complete });
      },
    });

    assert.deepEqual(tokenUpdates, [
      { text: 'First answer', complete: false },
      { text: 'First answer', complete: true },
      { text: 'Second answer', complete: false },
      { text: 'Second answer', complete: true },
    ]);
    assert.equal(result.text, 'Second answer');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
