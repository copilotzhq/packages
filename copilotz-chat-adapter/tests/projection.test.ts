import test from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyProjection,
  projectFrame,
  projectHistoryMessages,
} from '../src/projection.ts';
import {
  appendAssistantToolCall,
  applyAssistantToolResult,
} from '../src/activity.ts';
import type { ObservationFrame } from '@copilotz/copilotz/client';
import type { ChatMessage } from '@copilotz/chat-ui';

const descriptor = (
  id: string,
  run: string,
  options: Record<string, unknown> = {}
): ObservationFrame => ({
  kind: 'output',
  checkpoint: id,
  output: {
    type: 'stream.output',
    streamId: id,
    operationId: 'operation',
    role: 'content',
    mediaType: 'text/plain',
    metadata: { sourceActionRunId: run },
    ...options,
  },
});
const chunk = (
  id: string,
  value: string | Uint8Array,
  offset = 0
): ObservationFrame => ({
  kind: 'stream-chunk',
  streamId: id,
  checkpoint: `${id}:${offset}`,
  offset,
  bytes: typeof value === 'string' ? new TextEncoder().encode(value) : value,
});
const end = (id: string, offset: number, failed = false): ObservationFrame => ({
  kind: failed ? 'stream-error' : 'stream-end',
  streamId: id,
  checkpoint: `${id}:end`,
  offset,
  terminal: {
    outcome: failed ? 'failed' : 'completed',
    availability: 'retained',
    capture: failed ? 'truncated' : 'complete',
    terminalAt: '2026-09-04T00:00:00Z',
    offset,
  },
});
function projector(messages: ChatMessage[] = []) {
  let state = { ...emptyProjection(), messages };
  return {
    get state() {
      return state;
    },
    apply(frame: ObservationFrame) {
      const next = projectFrame(state, frame, 10);
      state = next.state;
      return next;
    },
    history(messages: ChatMessage[]) {
      state = projectHistoryMessages(state, messages);
    },
  };
}
const plan = (id: string) =>
  appendAssistantToolCall(
    {
      id,
      role: 'assistant',
      content: '',
      timestamp: 0,
    },
    { id: 'reused-id', name: 'search', arguments: {}, status: 'running' }
  );
const toolDescriptor = (id: string, run: string, messageId: string) =>
  descriptor(id, run, {
    role: 'tool-output',
    metadata: {
      sourceActionRunId: run,
      channel: 'stdout',
      sourceAction: {
        actionRunId: run,
        metadata: {
          copilotzToolAction: {
            planMessageId: messageId,
            toolCallId: 'reused-id',
          },
        },
      },
    },
  });
const output = (message: ChatMessage) =>
  message.activity?.items.find((item) => item.kind === 'tool')?.details
    ?.toolOutput?.channels.stdout.value;

test('interleaved agents keep independent bytes, reasoning, and terminal boundaries', () => {
  const p = projector();
  p.apply(descriptor('a', 'agent-a'));
  p.apply(descriptor('b', 'agent-b'));
  p.apply(descriptor('thought', 'agent-a', { role: 'reasoning' }));
  p.apply(chunk('a', 'First'));
  p.apply(chunk('b', 'Second'));
  p.apply(chunk('thought', 'Thinking'));
  p.apply(end('a', 5));
  assert.equal(p.state.messages[0].isStreaming, true);
  p.apply(end('thought', 8));
  assert.equal(p.state.messages[0].isStreaming, false);
  assert.equal(p.state.messages[1].isStreaming, true);
  assert.deepEqual(
    p.state.messages.map((m) => m.content),
    ['First', 'Second']
  );
});

test('UTF-8 splits and overlapping replay apply each byte once', () => {
  const p = projector();
  p.apply(descriptor('a', 'run'));
  const bytes = new TextEncoder().encode('Hi 🌎');
  for (let index = 0; index < bytes.length; index++)
    p.apply(chunk('a', bytes.slice(index, index + 1), index));
  p.apply(descriptor('a', 'run'));
  p.apply(chunk('a', bytes));
  p.apply(chunk('a', '🌎!', 3));
  assert.equal(p.state.messages[0].content, 'Hi 🌎!');
  assert.throws(() => p.apply(chunk('a', 'gap', 100)), /gap/);
});

test('replayed tool descriptors bind reused provider IDs to the exact plan and Action run', () => {
  const p = projector([plan('one'), plan('two')]);
  p.apply(toolDescriptor('a', 'run-a', 'one'));
  p.apply(toolDescriptor('b', 'run-b', 'two'));
  p.apply(chunk('b', 'second'));
  p.apply(chunk('a', 'first'));
  assert.deepEqual(p.state.messages.map(output), ['first', 'second']);
  assert.equal(p.state.messages.length, 2);
});

test('progress before the tool plan is recovered when history arrives and cannot reopen settled history', () => {
  const p = projector();
  p.apply(toolDescriptor('a', 'run', 'plan'));
  p.apply(chunk('a', 'early'));
  p.history([plan('plan')]);
  assert.equal(output(p.state.messages[0]), 'early');
  const settled = applyAssistantToolResult(p.state.messages[0], {
    id: 'reused-id',
    name: 'search',
    status: 'completed',
    result: 'final',
    toolExecutionId: 'run',
  });
  p.history([settled]);
  assert.equal(p.state.messages[0].activity?.items[0].status, 'complete');
  p.apply(chunk('a', 'early later'));
  assert.equal(p.state.messages[0].activity?.items[0].status, 'complete');
});

test('binary lanes retain exact bytes and partial failures retain visible text', () => {
  const p = projector();
  p.apply(
    descriptor('binary', 'file-run', {
      mediaType: 'application/octet-stream',
      role: 'attachment',
      name: 'data.bin',
    })
  );
  p.apply(chunk('binary', new Uint8Array([0, 255, 128])));
  p.apply(end('binary', 3));
  assert.equal(
    p.state.messages[0].attachments?.[0].dataUrl,
    'data:application/octet-stream;base64,AP+A'
  );
  p.apply(descriptor('text', 'failed-run'));
  p.apply(chunk('text', 'partial'));
  p.apply(end('text', 7, true));
  assert.equal(p.state.messages[1].content, 'partial');
  assert.equal(p.state.messages[1].isStreaming, false);
});

test('canonical history replaces a streamed attempt without replay truncating its durable content', () => {
  const p = projector([
    {
      id: 'durable',
      role: 'assistant',
      content: 'Complete answer',
      timestamp: 0,
      metadata: { llmAttemptId: 'run' },
    },
  ]);
  p.apply(descriptor('a', 'run'));
  p.apply(chunk('a', 'Complete'));
  assert.equal(p.state.messages.length, 1);
  assert.equal(p.state.messages[0].content, 'Complete answer');
});

test('incomplete UTF-8 and NDJSON reject terminal application without consuming progress', () => {
  const p = projector();
  p.apply(descriptor('a', 'run'));
  p.apply(chunk('a', new Uint8Array([0xf0])));
  assert.throws(() => p.apply(end('a', 1)), /UTF-8/);
  const q = projector();
  q.apply(
    descriptor('tools', 'run', {
      mediaType: 'application/x-ndjson',
      role: 'tool-calls',
    })
  );
  q.apply(chunk('tools', '{"id":'));
  assert.throws(() => q.apply(end('tools', 6)), /NDJSON/);
});

test('discarding a tool draft removes only that draft and returns its canonical delta', () => {
  const p = projector();
  p.apply(
    descriptor('tools', 'run', {
      mediaType: 'application/x-ndjson',
      role: 'tool-call-drafts',
    })
  );
  let offset = 0;
  const delta = (draftId: string, phase: string, sequence: number) => {
    const line =
      JSON.stringify({
        draftId,
        phase,
        sequence,
        callIndex: 0,
        toolName: 'search',
        delta: '',
      }) + '\n';
    const result = p.apply(chunk('tools', line, offset));
    offset += new TextEncoder().encode(line).length;
    return result;
  };
  delta('keep', 'start', 0);
  delta('discard', 'start', 0);
  const result = delta('discard', 'discarded', 1);
  assert.equal(result.drafts[0].llmAttemptId, 'run');
  assert.equal(result.drafts[0].phase, 'discarded');
  assert.equal(p.state.messages[0].activity?.items.length, 1);
});

test('a zero-byte failed attempt never closes or replaces another active attempt', () => {
  const p = projector();
  p.apply(descriptor('a', 'visible'));
  p.apply(chunk('a', 'working'));
  p.apply(descriptor('b', 'empty'));
  p.apply(end('b', 0, true));
  assert.equal(p.state.messages.length, 1);
  assert.equal(p.state.messages[0].isStreaming, true);
  assert.equal(p.state.messages[0].content, 'working');
});


test('fallback replaces provisional reasoning without mixing candidates on replay', () => {
  const p = projector();
  p.apply(descriptor('old', 'run', { role: 'reasoning', metadata: { sourceActionRunId: 'run', providerAttemptIndex: 0, lane: 'reasoning' } }));
  p.apply(chunk('old', 'discarded reasoning'));
  p.apply(end('old', 19, true));
  p.apply(descriptor('new', 'run', { metadata: { sourceActionRunId: 'run', providerAttemptIndex: 1 } }));
  p.apply(chunk('new', 'Recovered'));
  assert.equal(p.state.messages.length, 1);
  assert.equal(p.state.messages[0].content, 'Recovered');
  assert.equal(JSON.stringify(p.state.messages).includes('discarded reasoning'), false);
  p.apply(end('old', 19, true));
  assert.equal(p.state.messages[0].isStreaming, true);
  p.apply(end('new', 9));
  assert.equal(p.state.messages[0].isStreaming, false);
});
