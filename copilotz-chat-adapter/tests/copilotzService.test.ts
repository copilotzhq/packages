import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchThreads, runCopilotzStream } from '../src/copilotzService.ts';

const sse = (event: string, data: unknown) =>
  `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

test('fetchThreads omits the legacy all-status wildcard', async () => {
  const originalFetch = globalThis.fetch;
  let capturedUrl: URL | undefined;

  globalThis.fetch = async (input: RequestInfo | URL) => {
    capturedUrl = new URL(String(input), 'https://example.test');
    return Response.json({ data: [] });
  };

  try {
    assert.deepEqual(await fetchThreads('user-123'), []);
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(capturedUrl?.pathname, '/api/v1/threads');
  assert.equal(capturedUrl?.searchParams.get('participantId'), 'user-123');
  assert.equal(capturedUrl?.searchParams.get('order'), 'desc');
  assert.equal(capturedUrl?.searchParams.has('status'), false);
});

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
  assert.deepEqual(capturedBody.recipients, ['west']);
  assert.equal(capturedBody.participant.externalId, 'user-123');
  assert.equal(capturedBody.participant.participantType, 'human');
  assert.equal(capturedBody.input.content, 'Hello team');
});

test('runCopilotzStream never impersonates an agent for tool-bearing input', async () => {
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
      content: 'Use the existing result',
      user: { externalId: 'user-123', name: 'User' },
      selectedAgent: 'west',
      toolCalls: [{ id: 'call-1', name: 'lookup', args: { query: 'time' } }],
    });
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(capturedBody.participant.externalId, 'user-123');
  assert.equal(capturedBody.participant.participantType, 'human');
  assert.deepEqual(capturedBody.recipients, ['west']);
  assert.deepEqual(capturedBody.input.metadata.toolCalls, [{
    id: 'call-1',
    name: 'lookup',
    args: JSON.stringify({ query: 'time' }),
  }]);
});

test('runCopilotzStream defers routing to channel defaults when no agent is selected', async () => {
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
      content: 'Hello',
      user: { externalId: 'user-123' },
    });
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.deepEqual(capturedBody.thread.participants, ['user-123']);
  assert.equal('recipients' in capturedBody, false);
  assert.deepEqual(capturedBody.participant, {
    externalId: 'user-123',
    participantType: 'human',
  });
});

test('runCopilotzStream sends attachment bytes as canonical content only', async () => {
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
      content: 'See this',
      user: { externalId: 'user-123' },
      selectedAgent: 'west',
      attachments: [{
        kind: 'image',
        dataUrl: 'data:image/png;base64,AQID',
        mimeType: 'image/png',
        fileName: 'diagram.png',
        size: 3,
      }],
    });
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.deepEqual(capturedBody.input.content, [
    { type: 'text', text: 'See this' },
    {
      type: 'image',
      dataBase64: 'AQID',
      mediaType: 'image/png',
      name: 'diagram.png',
      metadata: { attachmentIndex: 0, size: 3 },
    },
  ]);
  assert.deepEqual(capturedBody.input.metadata.attachments, [{
    kind: 'image',
    mimeType: 'image/png',
    fileName: 'diagram.png',
    size: 3,
    contentIndex: 1,
  }]);
  assert.equal(
    JSON.stringify(capturedBody.input.metadata).includes('data:image/png'),
    false,
  );
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

test('runCopilotzStream associates token phases with their LLM attempt', async () => {
  const originalFetch = globalThis.fetch;
  const encoder = new TextEncoder();
  const tokenUpdates: Array<{
    text: string;
    llmAttemptId?: string;
    phaseId?: string;
    phaseOrdinal?: number;
    isReasoning?: boolean;
  }> = [];

  globalThis.fetch = async () => {
    const body = [
      sse('LLM_CALL', {
        type: 'LLM_CALL',
        subjectType: 'llm_attempt',
        subjectId: 'attempt-1',
        payload: { agent: { id: 'north', name: 'North' } },
      }),
      sse('TOKEN', { type: 'TOKEN', payload: { token: 'Think', isReasoning: true } }),
      sse('TOKEN', { type: 'TOKEN', payload: { token: '', isReasoning: true, isComplete: true } }),
      sse('TOKEN', { type: 'TOKEN', payload: { token: 'Answer', isReasoning: false } }),
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
    await runCopilotzStream({
      content: 'Hello',
      user: { externalId: 'user-123', name: 'User' },
      onToken: (text, _complete, _raw, context) => {
        tokenUpdates.push({ text, ...context });
      },
    });

    assert.deepEqual(tokenUpdates, [
      {
        text: 'Think',
        llmAttemptId: 'attempt-1',
        phaseId: 'attempt-1:reasoning:0',
        phaseOrdinal: 0,
        isReasoning: true,
      },
      {
        text: 'Think',
        llmAttemptId: 'attempt-1',
        phaseId: 'attempt-1:reasoning:0',
        phaseOrdinal: 0,
        isReasoning: true,
      },
      {
        text: 'Answer',
        llmAttemptId: 'attempt-1',
        phaseId: 'attempt-1:answer:1',
        phaseOrdinal: 1,
        isReasoning: false,
      },
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('runCopilotzStream treats an unflagged non-empty legacy token as answer text', async () => {
  const originalFetch = globalThis.fetch;
  const encoder = new TextEncoder();
  const tokenUpdates: Array<{
    text: string;
    complete: boolean;
    isReasoning?: boolean;
  }> = [];

  globalThis.fetch = async () => {
    const body = [
      sse('LLM_CALL', {
        type: 'LLM_CALL',
        subjectType: 'llm_attempt',
        subjectId: 'attempt-legacy',
        payload: { agent: { id: 'north', name: 'North' } },
      }),
      sse('TOKEN', { type: 'TOKEN', payload: { token: 'Think', isReasoning: true } }),
      sse('TOKEN', { type: 'TOKEN', payload: { token: 'Answer' } }),
      sse('TOKEN', { type: 'TOKEN', payload: { token: '', isComplete: true } }),
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
    await runCopilotzStream({
      content: 'Hello',
      user: { externalId: 'user-123', name: 'User' },
      onToken: (text, complete, _raw, context) => {
        tokenUpdates.push({
          text,
          complete,
          isReasoning: context?.isReasoning,
        });
      },
    });

    assert.deepEqual(tokenUpdates, [
      { text: 'Think', complete: false, isReasoning: true },
      { text: 'Answer', complete: false, isReasoning: false },
      { text: 'Answer', complete: true, isReasoning: false },
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('runCopilotzStream forwards TOOL_CALL_DELTA envelopes unchanged', async () => {
  const originalFetch = globalThis.fetch;
  const encoder = new TextEncoder();
  const events: unknown[] = [];
  const deltaEvent = {
    type: 'TOOL_CALL_DELTA',
    payload: {
      llmAttemptId: 'attempt-1',
      draftId: 'draft-1',
      callIndex: 0,
      sequence: 0,
      toolName: 'terminal',
      phase: 'start',
      delta: '{"name":"terminal"',
    },
  };

  globalThis.fetch = async () => new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(sse('TOOL_CALL_DELTA', deltaEvent)));
        controller.close();
      },
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    },
  );

  try {
    await runCopilotzStream({
      content: 'Hello',
      user: { externalId: 'user-123', name: 'User' },
      onMessageEvent: (event) => {
        events.push(event);
      },
    });
    assert.deepEqual(events, [deltaEvent]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('runCopilotzStream awaits and surfaces asynchronous event callback failures', async () => {
  const originalFetch = globalThis.fetch;
  const encoder = new TextEncoder();

  globalThis.fetch = async () => new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(sse('TOOL_RESULT', {
          type: 'TOOL_RESULT',
          payload: {
            toolCallId: 'tool-1',
            tool: { id: 'browser' },
            status: 'failed',
            error: 'page crashed',
          },
        })));
        controller.close();
      },
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
    },
  );

  try {
    await assert.rejects(runCopilotzStream({
      content: 'Hello',
      user: { externalId: 'user-123', name: 'User' },
      onMessageEvent: async () => {
        await Promise.resolve();
        throw new Error('event callback failed');
      },
    }), /event callback failed/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
