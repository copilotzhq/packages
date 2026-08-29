import test from 'node:test';
import assert from 'node:assert/strict';
import { projectCanonicalMessageHistory } from '../src/messageContract.ts';
import { parseCanonicalMessagePage } from '../src/canonicalHistory.ts';
import { extractLiveToolCall, extractLiveToolResultUpdate, mergePersistedToolResults } from '../src/toolActivity.ts';

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
const encoded = (value: unknown) => Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)).toString('base64');
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
      id: 'message-user',
      namespace,
      threadId,
      sender: participant('human', 'usr-alice', 'Alice'),
      recipientIds: ['participant:north'],
      content: [ref('asset-user', 'text', 'body')],
      metadata: { clientMessageId: 'client-1' },
      createdAt: time,
      updatedAt: time,
    },
    {
      id: 'message-agent',
      namespace,
      threadId,
      sender: participant('agent', 'north', 'North'),
      recipientIds: [],
      content: [],
      metadata: {
        llmReasoning: [ref('asset-reasoning', 'text', 'reasoning')],
        llmToolCalls: [
          {
            id: 'call-1',
            action: 'terminal',
            input: { command: 'pwd' },
          },
        ],
        copilotzWorkflow: {
          kind: 'agent_output',
          llmAttemptId: 'attempt-1',
          agentParticipantId: 'participant:north',
        },
      },
      createdAt: '2026-08-13T10:00:01.000Z',
      updatedAt: '2026-08-13T10:00:01.000Z',
    },
    {
      id: 'message-tool',
      namespace,
      threadId,
      sender: participant('tool', 'tool:terminal', 'Terminal'),
      recipientIds: ['participant:north'],
      content: [ref('asset-result', 'json', 'tool.projected_output')],
      metadata: {
        toolId: 'terminal',
        toolStatus: 'failed',
        toolInvocation: {
          id: 'call-1',
          tool: { id: 'terminal', name: 'Terminal' },
          args: JSON.stringify({ command: 'pwd' }),
        },
        copilotzWorkflow: {
          kind: 'tool_result',
          llmAttemptId: 'attempt-1',
          sourceMessageId: 'message-agent',
          agentParticipantId: 'participant:north',
        },
        copilotzToolAction: {
          schema: 'copilotz.core.tool-action.v1',
          planMessageId: 'message-agent',
          actionRunId: 'execution-1',
        },
      },
      createdAt: '2026-08-13T10:00:02.000Z',
      updatedAt: '2026-08-13T10:00:02.000Z',
    },
  ],
  included: {
    content: [
      content('asset-user', 'text', 'body', 'Run a terminal check.'),
      content('asset-reasoning', 'text', 'reasoning', 'I should inspect the terminal.'),
      content('asset-result', 'json', 'tool.projected_output', {
        ok: false,
        error: 'Sandbox unavailable.',
      }),
    ],
  },
  pageInfo: { hasMore: false },
});

test('v4 message history restores reasoning, tool calls, and failed results', () => {
  const output: Record<string, unknown>[] = [];
  const page = parseCanonicalMessagePage(canonicalHistory());
  assert.equal('location' in page.included.content[0].asset, false);
  const { viewMessages, toolResultUpdates } = projectCanonicalMessageHistory(page, {
    senderOptions: {
      agents: [{ id: 'north', name: 'North', color: '#3b82f6' }],
    },
    onToolOutput: (value) => output.push(value),
  });

  assert.deepEqual(
    viewMessages.map((message) => message.id),
    ['message-user', 'message-agent'],
  );
  assert.equal(viewMessages[0].content, 'Run a terminal check.');
  assert.equal(viewMessages[1].content, '');
  assert.equal(viewMessages[1].sender?.id, 'north');
  assert.equal(viewMessages[1].activity?.items[0].details?.reasoning, 'I should inspect the terminal.');
  assert.equal(viewMessages[1].activity?.items[1].kind, 'tool');
  assert.equal(viewMessages[1].activity?.items[1].toolId, 'terminal');
  assert.equal(viewMessages[1].activity?.items[1].toolName, 'Terminal');
  assert.equal(viewMessages[1].activity?.items[1].status, 'failed');
  assert.deepEqual(viewMessages[1].activity?.items[1].details?.toolCall?.arguments, { command: 'pwd' });
  assert.deepEqual(viewMessages[1].activity?.items[1].details?.result, {
    ok: false,
    error: 'Sandbox unavailable.',
  });
  assert.equal(viewMessages[1].activity?.items[1].details?.error, 'Sandbox unavailable.');
  assert.deepEqual(toolResultUpdates[0], {
    id: 'call-1',
    toolExecutionId: 'execution-1',
    sourceMessageId: 'message-agent',
    name: 'Terminal',
    status: 'failed',
    result: { ok: false, error: 'Sandbox unavailable.' },
    error: 'Sandbox unavailable.',
    endTime: new Date('2026-08-13T10:00:02.000Z').getTime(),
  });
  assert.deepEqual(output, [{ ok: false, error: 'Sandbox unavailable.' }]);
  assert.equal(mergePersistedToolResults(viewMessages, toolResultUpdates)[1].activity?.items[1].status, 'failed');
});

test('v4 history renders exported tool files as downloadable attachments', () => {
  const history = canonicalHistory();
  const fileRef = ref('asset-export', 'file', 'attachment', 'text/csv', 'report.csv');
  history.data[2].content.push(fileRef);
  history.data[2].metadata.toolStatus = 'completed';
  history.included.content.push(content('asset-export', 'file', 'attachment', 'name,value\nalpha,1\n', 'text/csv', 'report.csv'));

  const { viewMessages } = projectCanonicalMessageHistory(parseCanonicalMessagePage(history));
  const exported = viewMessages.find((message) => message.id === 'message-tool');
  assert.equal(exported?.sender?.type, 'tool');
  assert.deepEqual(exported?.attachments, [
    {
      kind: 'file',
      dataUrl: `data:text/csv;base64,${encoded('name,value\nalpha,1\n')}`,
      mimeType: 'text/csv',
      fileName: 'report.csv',
      size: 19,
    },
  ]);
});

test('canonical parser requires the v4 content include', () => {
  assert.throws(
    () =>
      parseCanonicalMessagePage({
        data: [],
        included: {},
        pageInfo: { hasMore: false },
      }),
    /content array/,
  );
});

test('canonical parser accepts an empty immutable content body', () => {
  const history = canonicalHistory();
  history.included.content.push({
    ...content('asset-empty', 'text', 'attachment', ''),
    base64: '',
  });
  assert.equal(parseCanonicalMessagePage(history).included.content.at(-1)?.base64, '');
});

test('v4 history binds reused provider call IDs to their source message', () => {
  const history = canonicalHistory();
  history.data.push({
    ...structuredClone(history.data[2]),
    id: 'message-tool-newer',
    content: [ref('asset-result-newer', 'json', 'tool.projected_output')],
    metadata: {
      ...structuredClone(history.data[2].metadata),
      toolStatus: 'completed',
      copilotzWorkflow: {
        kind: 'tool_result',
        sourceMessageId: 'another-agent-message',
      },
      copilotzToolAction: {
        schema: 'copilotz.core.tool-action.v1',
        planMessageId: 'another-agent-message',
        actionRunId: 'execution-newer',
      },
    },
    createdAt: '2026-08-13T10:00:03.000Z',
    updatedAt: '2026-08-13T10:00:03.000Z',
  });
  history.included.content.push(
    content('asset-result-newer', 'json', 'tool.projected_output', {
      ok: true,
      wrong: true,
    }),
  );

  const { viewMessages } = projectCanonicalMessageHistory(parseCanonicalMessagePage(history));
  const tool = viewMessages.find((message) => message.id === 'message-agent')?.activity?.items.find((item) => item.kind === 'tool');
  assert.equal(tool?.details?.toolCall?.toolExecutionId, 'execution-1');
  assert.deepEqual(tool?.details?.result, {
    ok: false,
    error: 'Sandbox unavailable.',
  });
});

test('v4 Ask metadata restores the mention and suppresses its duplicate question', () => {
  const history = canonicalHistory();
  history.data[1].metadata.llmToolCalls = [
    {
      id: 'call-1',
      action: 'ask',
      input: { target: 'east', message: 'Review this plan.' },
    },
  ];
  history.data[2].metadata.toolInvocation = {
    id: 'call-1',
    tool: { id: 'ask', name: 'Ask Agent' },
    args: JSON.stringify({ target: 'east', message: 'Review this plan.' }),
  };
  const copilotzAsk = {
    schema: 'copilotz.ask.v1',
    askId: 'ask:execution-1',
    phase: 'question',
    toolActionRunId: 'execution-1',
    toolCallId: 'call-1',
    questionMessageId: 'message-question',
    askingParticipantId: 'participant:north',
    askingAgentId: 'north',
    askingAgentName: 'North',
    askedParticipantId: 'participant:east',
    askedAgentId: 'east',
    askedAgentName: 'East',
    depth: 1,
  };
  history.data.push({
    id: 'message-question',
    namespace,
    threadId,
    sender: participant('agent', 'north', 'North'),
    recipientIds: ['participant:east'],
    content: [ref('asset-question', 'text', 'body')],
    metadata: { copilotzAsk },
    createdAt: '2026-08-13T10:00:01.500Z',
    updatedAt: '2026-08-13T10:00:01.500Z',
  });
  history.included.content.push(content('asset-question', 'text', 'body', 'Review this plan.'));

  const projected = projectCanonicalMessageHistory(parseCanonicalMessagePage(history));
  assert.equal(
    projected.viewMessages.some((message) => message.id === 'message-question'),
    false,
  );
  const ask = projected.viewMessages
    .find((message) => message.id === 'message-agent')
    ?.activity?.items.find((item) => item.toolId === 'ask');
  assert.equal(ask?.toolName, 'Ask Agent');
  assert.deepEqual(ask?.details?.toolCall?.arguments, {
    target: 'east',
    message: 'Review this plan.',
  });

  history.data = history.data.filter((message) => message.id !== 'message-agent');
  const withoutSource = projectCanonicalMessageHistory(parseCanonicalMessagePage(history));
  const question = withoutSource.viewMessages.find((message) => message.id === 'message-question');
  assert.deepEqual(question?.metadata?.copilotzAsk, copilotzAsk);
});

test('live tool events retain the same call identity as v4 history', () => {
  assert.deepEqual(
    extractLiveToolCall({
      toolCall: {
        id: 'call-1',
        args: { command: 'pwd' },
        tool: { id: 'terminal' },
      },
    }),
    {
      id: 'call-1',
      toolId: 'terminal',
      name: 'terminal',
      arguments: { command: 'pwd' },
      status: 'running',
    },
  );
  assert.deepEqual(
    extractLiveToolResultUpdate(
      {
        toolCallId: 'call-1',
        tool: { id: 'terminal', name: 'Terminal' },
        projectedOutput: { ok: true },
        status: 'completed',
      },
      () => 123,
    ),
    {
      id: 'call-1',
      name: 'Terminal',
      status: 'completed',
      result: { ok: true },
      endTime: 123,
    },
  );
});
