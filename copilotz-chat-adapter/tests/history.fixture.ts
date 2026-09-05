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


export { encoded, namespace, threadId, time, participant, ref, content, canonicalHistory };
