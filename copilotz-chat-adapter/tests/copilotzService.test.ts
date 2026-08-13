import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchThreadMessagesPage, fetchThreads, runCopilotzStream } from '../src/copilotzService.ts';

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

test('fetchThreadMessagesPage requests canonical compound history newest-first', async () => {
  const originalFetch = globalThis.fetch;
  let capturedUrl: URL | undefined;
  globalThis.fetch = async (input: RequestInfo | URL) => {
    capturedUrl = new URL(String(input), 'https://example.test');
    return Response.json({
      data: [],
      included: { llmAttempts: [], toolExecutions: [], content: [] },
      pageInfo: { next: 'message-older', hasMore: true },
    });
  };
  try {
    const page = await fetchThreadMessagesPage('thread-1', { limit: 50, before: 'message-newer' });
    assert.deepEqual(page.pageInfo, { next: 'message-older', hasMore: true });
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(capturedUrl?.pathname, '/api/v1/threads/thread-1/messages');
  assert.equal(capturedUrl?.searchParams.get('order'), 'desc');
  assert.equal(capturedUrl?.searchParams.get('include'), 'content,workflow');
  assert.equal(capturedUrl?.searchParams.get('before'), 'message-newer');
});

test('runCopilotzStream sends stable participant and target identifiers', async () => {
  const originalFetch = globalThis.fetch;
  let capturedBody: any = null;
  let capturedUrl: URL | undefined;

  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    capturedUrl = new URL(String(input), 'https://example.test');
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
  assert.equal(capturedUrl?.pathname, '/api/v1/channels/web');
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

test('runCopilotzStream resets canonical deltas between durable agent messages', async () => {
  const originalFetch = globalThis.fetch;
  const encoder = new TextEncoder();
  const tokenUpdates: Array<{ text: string; complete: boolean }> = [];

  globalThis.fetch = async () => {
    const body = [
      sse('text.delta', { type: 'text.delta', payload: { text: 'First answer', llmAttemptId: 'attempt-1' } }),
      sse('message.created', { type: 'message.created', payload: { messageId: 'message-1' }, metadata: { copilotzWorkflow: { kind: 'agent_output', llmAttemptId: 'attempt-1' } } }),
      sse('text.delta', { type: 'text.delta', payload: { text: 'Second answer', llmAttemptId: 'attempt-2' } }),
      sse('message.created', { type: 'message.created', payload: { messageId: 'message-2' }, metadata: { copilotzWorkflow: { kind: 'agent_output', llmAttemptId: 'attempt-2' } } }),
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

test('runCopilotzStream associates canonical delta phases with their LLM attempt', async () => {
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
      sse('reasoning.delta', { type: 'reasoning.delta', payload: { text: 'Think', llmAttemptId: 'attempt-1', agent: { id: 'north', name: 'North' } } }),
      sse('text.delta', { type: 'text.delta', payload: { text: 'Answer', llmAttemptId: 'attempt-1', agent: { id: 'north', name: 'North' } } }),
      sse('message.created', { type: 'message.created', payload: { messageId: 'message-1' }, metadata: { copilotzWorkflow: { kind: 'agent_output', llmAttemptId: 'attempt-1' } } }),
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
        agent: { id: 'north', name: 'North' },
      },
      {
        text: 'Answer',
        llmAttemptId: 'attempt-1',
        phaseId: 'attempt-1:answer:1',
        phaseOrdinal: 1,
        isReasoning: false,
        agent: { id: 'north', name: 'North' },
      },
      {
        text: 'Answer',
        llmAttemptId: 'attempt-1',
        phaseId: 'attempt-1:answer:1',
        phaseOrdinal: 1,
        isReasoning: false,
        agent: { id: 'north', name: 'North' },
      },
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('runCopilotzStream preserves interleaved text independently for parallel agent attempts', async () => {
  const originalFetch = globalThis.fetch;
  const encoder = new TextEncoder();
  const updates: Array<{
    attemptId?: string;
    agentId?: string;
    text: string;
    complete: boolean;
  }> = [];

  globalThis.fetch = async () => {
    const body = [
      sse('text.delta', { type: 'text.delta', payload: { text: 'East one', llmAttemptId: 'attempt-east', agent: { id: 'east', name: 'East' } } }),
      sse('text.delta', { type: 'text.delta', payload: { text: 'South one', llmAttemptId: 'attempt-south', agent: { id: 'south', name: 'South' } } }),
      sse('text.delta', { type: 'text.delta', payload: { text: ' East two', llmAttemptId: 'attempt-east', agent: { id: 'east', name: 'East' } } }),
      sse('text.delta', { type: 'text.delta', payload: { text: ' South two', llmAttemptId: 'attempt-south', agent: { id: 'south', name: 'South' } } }),
      sse('message.created', { type: 'message.created', payload: { messageId: 'message-east' }, metadata: { copilotzWorkflow: { kind: 'agent_output', llmAttemptId: 'attempt-east' } } }),
      sse('message.created', { type: 'message.created', payload: { messageId: 'message-south' }, metadata: { copilotzWorkflow: { kind: 'agent_output', llmAttemptId: 'attempt-south' } } }),
    ].join('');

    return new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode(body));
          controller.close();
        },
      }),
      { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
    );
  };

  try {
    await runCopilotzStream({
      content: 'Ask both agents',
      user: { externalId: 'user-123' },
      onToken: (text, complete, _raw, context) => {
        updates.push({
          attemptId: context?.llmAttemptId,
          agentId: context?.agent?.id,
          text,
          complete,
        });
      },
    });
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.deepEqual(updates, [
    { attemptId: 'attempt-east', agentId: 'east', text: 'East one', complete: false },
    { attemptId: 'attempt-south', agentId: 'south', text: 'South one', complete: false },
    { attemptId: 'attempt-east', agentId: 'east', text: 'East one East two', complete: false },
    { attemptId: 'attempt-south', agentId: 'south', text: 'South one South two', complete: false },
    { attemptId: 'attempt-east', agentId: 'east', text: 'East one East two', complete: true },
    { attemptId: 'attempt-south', agentId: 'south', text: 'South one South two', complete: true },
  ]);
});

test('runCopilotzStream rejects SSE event names that disagree with canonical envelopes', async () => {
  const originalFetch = globalThis.fetch;
  const encoder = new TextEncoder();
  globalThis.fetch = async () => {
    const body = sse('TOKEN', {
      type: 'text.delta',
      payload: { text: 'Answer', llmAttemptId: 'attempt-1' },
    });

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
    await assert.rejects(runCopilotzStream({
      content: 'Hello',
      user: { externalId: 'user-123', name: 'User' },
    }), /event mismatch/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('runCopilotzStream forwards canonical tool call and output events unchanged', async () => {
  const originalFetch = globalThis.fetch;
  const encoder = new TextEncoder();
  const events: unknown[] = [];
  const deltaEvent = {
    type: 'tool_call.delta',
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
  const outputEvent = {
    type: 'tool_output.delta',
    sequence: 0,
    payload: {
      toolExecutionId: 'execution-1',
      toolCallId: 'call-1',
      toolId: 'terminal',
      channel: 'stdout',
      mode: 'append',
      delta: 'hello\n',
    },
  };

  globalThis.fetch = async () => new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(
          sse('tool_call.delta', deltaEvent) +
          sse('tool_output.delta', outputEvent),
        ));
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
    assert.deepEqual(events, [deltaEvent, outputEvent]);
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
        controller.enqueue(encoder.encode(sse('tool_execution.failed', {
          type: 'tool_execution.failed',
          payload: {
            toolCallId: 'tool-1',
            toolExecutionId: 'execution-1',
            toolId: 'browser',
            status: 'failed',
            safeError: { message: 'page crashed' },
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
