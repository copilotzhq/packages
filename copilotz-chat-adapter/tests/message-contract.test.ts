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
const ref = (
  assetId: string,
  kind: 'text' | 'json' | 'file',
  role: string,
  mediaType = kind === 'json' ? 'application/json' : 'text/plain; charset=utf-8',
  name?: string,
) => ({
  assetId,
  kind,
  role,
  mediaType,
  ...(name ? { name } : {}),
});
const encoded = (value: unknown) => Buffer.from(
  typeof value === 'string' ? value : JSON.stringify(value),
).toString('base64');
const content = (
  assetId: string,
  kind: 'text' | 'json' | 'file',
  role: string,
  value: unknown,
  mediaType = kind === 'json' ? 'application/json' : 'text/plain; charset=utf-8',
  name?: string,
) => ({
  ref: ref(assetId, kind, role, mediaType, name),
  asset: {
    id: assetId,
    namespace,
    mediaType,
    byteLength: Buffer.byteLength(typeof value === 'string' ? value : JSON.stringify(value)),
    digest: `sha256:${'0'.repeat(64)}`,
    state: 'ready',
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
  assert.equal('location' in page.included.content[0].asset, false);
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
  assert.equal(viewMessages[1].activity?.items[1].toolId, 'terminal');
  assert.equal(viewMessages[1].activity?.items[1].toolName, 'Terminal');
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

test('canonical history renders exported tool files as downloadable attachments', () => {
  const history = canonicalHistory();
  const fileRef = ref(
    'asset-export',
    'file',
    'attachment',
    'text/csv',
    'report.csv',
  );
  history.data[2].content.push(fileRef);
  history.data[2].metadata.toolStatus = 'completed';
  history.included.toolExecutions[0].status = 'completed';
  history.included.toolExecutions[0].safeError = undefined;
  history.included.toolExecutions[0].content.push(fileRef);
  history.included.content.push(content(
    'asset-export',
    'file',
    'attachment',
    'name,value\nalpha,1\n',
    'text/csv',
    'report.csv',
  ));

  const { viewMessages } = projectCanonicalMessageHistory(
    parseCanonicalMessagePage(history),
  );
  const exported = viewMessages.find((message) => message.id === 'message-tool');
  assert.equal(exported?.sender?.type, 'tool');
  assert.deepEqual(exported?.attachments, [{
    kind: 'file',
    dataUrl: `data:text/csv;base64,${encoded('name,value\nalpha,1\n')}`,
    mimeType: 'text/csv',
    fileName: 'report.csv',
    size: 19,
  }]);
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

test('canonical ask question is represented once by its mention renderer', () => {
  const history = canonicalHistory();
  const copilotzAsk = {
    schema: 'copilotz.ask.v1',
    askId: 'ask:execution-1',
    phase: 'question',
    toolExecutionId: 'execution-1',
    questionMessageId: 'message-question',
    askingParticipantId: 'participant:north',
    askingAgentId: 'north',
    askedParticipantId: 'participant:east',
    askedAgentId: 'east',
    depth: 1,
  };
  history.data.push({
    id: 'message-question', namespace, threadId,
    sender: participant('agent', 'north', 'North'),
    recipientIds: ['participant:east'],
    content: [ref('asset-question', 'text', 'body')],
    metadata: { copilotzAsk },
    createdAt: '2026-08-13T10:00:01.500Z',
    updatedAt: '2026-08-13T10:00:01.500Z',
  });
  history.included.llmAttempts[0].availableToolIds = ['ask'];
  history.included.toolExecutions[0].tool = { id: 'ask', name: 'Ask Agent' };
  const toolCalls = history.included.content.find((item) => item.ref.assetId === 'asset-calls')!;
  toolCalls.base64 = encoded([{
    id: 'call-1',
    tool: { id: 'ask', name: 'Ask Agent' },
    args: '{"target":"east","message":"Review this plan."}',
  }]);
  const argumentsContent = history.included.content.find((item) => item.ref.assetId === 'asset-args')!;
  argumentsContent.base64 = encoded({ target: 'east', message: 'Review this plan.' });
  history.included.content.push(content('asset-question', 'text', 'body', 'Review this plan.'));

  const projected = projectCanonicalMessageHistory(parseCanonicalMessagePage(history));
  assert.equal(projected.viewMessages.some((message) => message.id === 'message-question'), false);
  const ask = projected.viewMessages.find((message) => message.id === 'message-agent')
    ?.activity?.items.find((item) => item.toolId === 'ask');
  assert.equal(ask?.toolName, 'Ask Agent');
  assert.deepEqual(ask?.details?.toolCall?.arguments, {
    target: 'east',
    message: 'Review this plan.',
  });

  history.data = history.data.filter((message) => message.id !== 'message-agent');
  const withoutSource = projectCanonicalMessageHistory(parseCanonicalMessagePage(history));
  assert.equal(withoutSource.viewMessages.some((message) => message.id === 'message-question'), true);
});

test('live tool events retain the same call identity as canonical history', () => {
  assert.deepEqual(extractLiveToolCall({
    toolCall: { id: 'call-1', args: { command: 'pwd' }, tool: { id: 'terminal' } },
  }), { id: 'call-1', toolId: 'terminal', name: 'terminal', arguments: { command: 'pwd' }, status: 'running' });
  assert.deepEqual(extractLiveToolResultUpdate({
    toolCallId: 'call-1', tool: { id: 'terminal', name: 'Terminal' },
    projectedOutput: { ok: true }, status: 'completed',
  }, () => 123), {
    id: 'call-1', name: 'Terminal', status: 'completed', result: { ok: true }, endTime: 123,
  });
});
