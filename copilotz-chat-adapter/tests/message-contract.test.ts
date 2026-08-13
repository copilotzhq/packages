import test from 'node:test';
import assert from 'node:assert/strict';
import { projectCanonicalMessageHistory } from '../src/messageContract.ts';
import { parseCanonicalMessagePage } from '../src/canonicalHistory.ts';
import {
  extractLiveToolCall,
  extractLiveToolResultUpdate,
  mergePersistedToolResults,
} from '../src/toolActivity.ts';

const namespace = 'tenant-a';
const threadId = 'thread-1';
const time = '2026-08-13T10:00:00.000Z';
const participant = (type: 'human' | 'agent' | 'tool', externalId: string, name: string) => ({
  id: `participant:${externalId}`,
  namespace,
  externalId,
  participantType: type,
  name,
  ...(type === 'agent' ? { agentId: externalId } : {}),
  metadata: {},
  createdAt: time,
  updatedAt: time,
});
const ref = (assetId: string, kind: 'text' | 'json', role: string, mediaType = kind === 'json' ? 'application/json' : 'text/plain; charset=utf-8') => ({
  assetId,
  kind,
  role,
  mediaType,
});
const encoded = (value: unknown) => Buffer.from(
  typeof value === 'string' ? value : JSON.stringify(value),
).toString('base64');
const content = (assetId: string, kind: 'text' | 'json', role: string, value: unknown) => ({
  ref: ref(assetId, kind, role),
  asset: {
    id: assetId,
    namespace,
    mediaType: kind === 'json' ? 'application/json' : 'text/plain; charset=utf-8',
    byteLength: Buffer.byteLength(typeof value === 'string' ? value : JSON.stringify(value)),
    digest: `sha256:${'0'.repeat(64)}`,
    state: 'ready',
    location: { kind: 'database', encoding: kind === 'json' ? 'json' : 'utf8' },
    createdAt: time,
    readyAt: time,
  },
  base64: encoded(value),
});

const canonicalHistory = () => ({
  data: [
    {
      id: 'message-user', namespace, threadId,
      sender: participant('human', 'usr-alice', 'Alice'),
      recipientIds: ['participant:north'],
      content: [ref('asset-user', 'text', 'body')],
      metadata: { clientMessageId: 'client-1' },
      createdAt: time, updatedAt: time,
    },
    {
      id: 'message-agent', namespace, threadId,
      sender: participant('agent', 'north', 'North'),
      recipientIds: [],
      content: [],
      metadata: { copilotzWorkflow: { kind: 'agent_output', llmAttemptId: 'attempt-1', agentParticipantId: 'participant:north' } },
      createdAt: '2026-08-13T10:00:01.000Z', updatedAt: '2026-08-13T10:00:01.000Z',
    },
    {
      id: 'message-tool', namespace, threadId,
      sender: participant('tool', 'tool:terminal', 'Terminal'),
      recipientIds: ['participant:north'],
      content: [ref('asset-result', 'json', 'tool.projected_output')],
      metadata: {
        toolId: 'terminal', toolStatus: 'failed',
        copilotzWorkflow: {
          kind: 'tool_result', llmAttemptId: 'attempt-1',
          toolCallId: 'call-1', toolExecutionId: 'execution-1',
          sourceMessageId: 'message-agent', agentParticipantId: 'participant:north',
        },
      },
      createdAt: '2026-08-13T10:00:02.000Z', updatedAt: '2026-08-13T10:00:02.000Z',
    },
  ],
  included: {
    llmAttempts: [{
      id: 'attempt-1', namespace, threadId, messageId: 'message-user',
      participantId: 'participant:north', initiatorParticipantId: 'participant:usr-alice', agentId: 'north',
      provider: 'openai', model: 'gpt-5', status: 'completed', attemptIndex: 0,
      inputMessageIds: ['message-user'], availableToolIds: ['terminal'],
      content: [ref('asset-reasoning', 'text', 'reasoning'), ref('asset-calls', 'json', 'llm.tool_calls')],
      finishReason: 'tool_calls', startedAt: time, finishedAt: '2026-08-13T10:00:01.000Z',
      metadata: {}, createdAt: time, updatedAt: '2026-08-13T10:00:01.000Z',
    }],
    toolExecutions: [{
      id: 'execution-1', namespace, threadId, messageId: 'message-agent',
      participantId: 'participant:north', agentId: 'north', toolCallId: 'call-1',
      tool: { id: 'terminal', name: 'Terminal' }, status: 'failed',
      content: [ref('asset-args', 'json', 'tool.arguments'), ref('asset-result', 'json', 'tool.projected_output')],
      safeError: { message: 'Sandbox unavailable.', code: 'tool_error' },
      startedAt: '2026-08-13T10:00:01.000Z', finishedAt: '2026-08-13T10:00:02.000Z',
      metadata: {}, createdAt: '2026-08-13T10:00:01.000Z', updatedAt: '2026-08-13T10:00:02.000Z',
    }],
    content: [
      content('asset-user', 'text', 'body', 'Run a terminal check.'),
      content('asset-reasoning', 'text', 'reasoning', 'I should inspect the terminal.'),
      content('asset-calls', 'json', 'llm.tool_calls', [{ id: 'call-1', tool: { id: 'terminal', name: 'Terminal' }, args: '{"command":"pwd"}' }]),
      content('asset-args', 'json', 'tool.arguments', { command: 'pwd' }),
      content('asset-result', 'json', 'tool.projected_output', { ok: false, error: 'Sandbox unavailable.' }),
    ],
  },
  pageInfo: { hasMore: false },
});

test('canonical production-shaped history projects text, tool-only turns, and failed tool results', () => {
  const output: Record<string, unknown>[] = [];
  const page = parseCanonicalMessagePage(canonicalHistory());
  const { viewMessages, toolResultUpdates } = projectCanonicalMessageHistory(page, {
    senderOptions: { agents: [{ id: 'north', name: 'North', color: '#3b82f6' }] },
    onToolOutput: (value) => output.push(value),
  });

  assert.deepEqual(viewMessages.map((message) => message.id), ['message-user', 'message-agent']);
  assert.equal(viewMessages[0].content, 'Run a terminal check.');
  assert.equal(viewMessages[1].content, '');
  assert.equal(viewMessages[1].sender?.id, 'north');
  assert.equal(viewMessages[1].activity?.items[0].details?.reasoning, 'I should inspect the terminal.');
  assert.equal(viewMessages[1].activity?.items[1].kind, 'tool');
  assert.equal(viewMessages[1].activity?.items[1].status, 'failed');
  assert.deepEqual(viewMessages[1].activity?.items[1].details?.toolCall?.arguments, { command: 'pwd' });
  assert.deepEqual(viewMessages[1].activity?.items[1].details?.result, { ok: false, error: 'Sandbox unavailable.' });
  assert.equal(viewMessages[1].activity?.items[1].details?.error, 'Sandbox unavailable.');
  assert.deepEqual(toolResultUpdates[0], {
    id: 'call-1', toolExecutionId: 'execution-1', sourceMessageId: 'message-agent',
    name: 'Terminal', status: 'failed', result: { ok: false, error: 'Sandbox unavailable.' },
    error: 'Sandbox unavailable.', endTime: new Date('2026-08-13T10:00:02.000Z').getTime(),
  });
  assert.deepEqual(output, [{ ok: false, error: 'Sandbox unavailable.' }]);
  assert.equal(mergePersistedToolResults(viewMessages, toolResultUpdates)[1].activity?.items[1].status, 'failed');
});

test('canonical parser rejects the removed flattened message contract', () => {
  assert.throws(() => parseCanonicalMessagePage({
    data: [{ id: 'legacy', threadId, senderType: 'agent', content: 'old shape' }],
    pageInfo: { hasMoreBefore: false },
  }), /included/);
});

test('canonical parser accepts an empty immutable content body', () => {
  const history = canonicalHistory();
  history.included.content.push({
    ...content('asset-empty', 'text', 'attachment', ''),
    base64: '',
  });
  assert.equal(
    parseCanonicalMessagePage(history).included.content.at(-1)?.base64,
    '',
  );
});

test('canonical history binds reused provider call IDs to their source message', () => {
  const history = canonicalHistory();
  history.included.toolExecutions.push({
    ...history.included.toolExecutions[0],
    id: 'execution-newer',
    messageId: 'another-agent-message',
    status: 'completed',
    content: [
      ref('asset-args-newer', 'json', 'tool.arguments'),
      ref('asset-result-newer', 'json', 'tool.projected_output'),
    ],
    safeError: undefined,
  });
  history.included.content.push(
    content('asset-args-newer', 'json', 'tool.arguments', { command: 'wrong' }),
    content('asset-result-newer', 'json', 'tool.projected_output', { ok: true, wrong: true }),
  );

  const { viewMessages } = projectCanonicalMessageHistory(
    parseCanonicalMessagePage(history),
  );
  const tool = viewMessages.find((message) => message.id === 'message-agent')
    ?.activity?.items.find((item) => item.kind === 'tool');
  assert.equal(tool?.details?.toolCall?.toolExecutionId, 'execution-1');
  assert.deepEqual(tool?.details?.result, {
    ok: false,
    error: 'Sandbox unavailable.',
  });
});

test('live tool events retain the same call identity as canonical history', () => {
  assert.deepEqual(extractLiveToolCall({
    toolCall: { id: 'call-1', args: { command: 'pwd' }, tool: { id: 'terminal' } },
  }), { id: 'call-1', name: 'terminal', arguments: { command: 'pwd' }, status: 'running' });
  assert.deepEqual(extractLiveToolResultUpdate({
    toolCallId: 'call-1', tool: { id: 'terminal', name: 'Terminal' },
    projectedOutput: { ok: true }, status: 'completed',
  }, () => 123), {
    id: 'call-1', name: 'Terminal', status: 'completed', result: { ok: true }, endTime: 123,
  });
});
