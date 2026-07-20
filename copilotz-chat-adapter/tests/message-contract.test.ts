import test from 'node:test';
import assert from 'node:assert/strict';
import {
  convertServerMessage,
  prepareHydratedMessages,
  shouldRenderHydratedMessage,
} from '../src/messageContract.ts';
import {
  extractLiveToolCall,
  extractLiveToolResultUpdate,
  mergePersistedToolResults,
} from '../src/toolActivity.ts';
import type { RestMessage } from '../src/copilotzService.ts';

const agents = [
  { id: 'north', name: 'North', color: '#3b82f6' },
];

test('hydrated message contract resolves sender, activity, and content from Copilotz metadata', () => {
  const message = convertServerMessage({
    id: 'msg-agent',
    threadId: 'thread-1',
    senderType: 'agent',
    senderId: '01KQV7M84RVH3FZ82MT665XPBB',
    senderUserId: '01KQV7M84RVH3FZ82MT665XPBB',
    content: 'Ready.',
    reasoning: 'Checking direction.',
    metadata: {
      senderExternalId: 'north',
      senderDisplayName: 'North',
      senderParticipantId: '01KQV7M84RVH3FZ82MT665XPBB',
    },
    createdAt: '2026-05-05T14:36:48.959Z',
  }, { senderOptions: { agents } });

  assert.equal(message.role, 'assistant');
  assert.equal(message.content, 'Ready.');
  assert.deepEqual(message.sender, {
    type: 'agent',
    id: 'north',
    name: 'North',
    agentId: 'north',
    color: '#3b82f6',
    participantId: '01KQV7M84RVH3FZ82MT665XPBB',
  });
  assert.deepEqual(message.activity?.items[0], {
    id: 'msg-agent:thinking',
    kind: 'thinking',
    status: 'complete',
    completedAt: new Date('2026-05-05T14:36:48.959Z').getTime(),
    details: { reasoning: 'Checking direction.' },
  });
});

test('internal hydrated messages are filtered out by contract', () => {
  assert.equal(shouldRenderHydratedMessage({
    id: 'internal',
    threadId: 'thread-1',
    senderType: 'agent',
    content: 'hidden',
    metadata: { visibility: 'internal' },
  }), false);
});

test('hydrated message contract throws instead of normalizing malformed sender metadata', () => {
  assert.throws(() => convertServerMessage({
    id: 'msg-agent',
    threadId: 'thread-1',
    senderType: 'agent',
    senderId: '01KQV7M84RVH3FZ82MT665XPBB',
    senderUserId: '01KQV7M84RVH3FZ82MT665XPBB',
    content: 'Ready.',
    metadata: {
      senderParticipantId: '01KQV7M84RVH3FZ82MT665XPBB',
    },
  }), /senderExternalId/);
});

test('persisted tool call and tool result hydrate into one completed activity', async () => {
  const toolCall: RestMessage = {
    id: 'tool-call-message',
    threadId: 'thread-1',
    senderType: 'agent',
    senderId: '01KQV7M84RVH3FZ82MT665XPBB',
    senderUserId: '01KQV7M84RVH3FZ82MT665XPBB',
    content: '',
    toolCalls: [{
      id: 'tool-1',
      args: { action: 'list_cards' },
      tool: { id: 'kanban' },
    }],
    metadata: {
      senderExternalId: 'north',
      senderDisplayName: 'North',
      senderParticipantId: '01KQV7M84RVH3FZ82MT665XPBB',
    },
    createdAt: '2026-05-05T14:36:25.267Z',
  };
  const toolResult: RestMessage = {
    id: 'tool-result-message',
    threadId: 'thread-1',
    senderType: 'tool',
    senderId: '01KQV7M84RVH3FZ82MT665XPBB',
    senderUserId: '01KQV7M84RVH3FZ82MT665XPBB',
    content: '{"cards":[]}',
    metadata: {
      senderExternalId: 'north',
      senderDisplayName: 'North',
      senderParticipantId: '01KQV7M84RVH3FZ82MT665XPBB',
      toolExecutionId: 'tool-exec-1',
      toolCalls: [{
        id: 'tool-1',
        args: '{"action":"list_cards"}',
        tool: { id: 'kanban', name: 'kanban' },
        output: { cards: [] },
        status: 'completed',
      }],
    },
    createdAt: '2026-05-05T14:36:25.308Z',
  };

  const { viewMessages, toolResultUpdates } = await prepareHydratedMessages(
    [toolCall, toolResult],
    { senderOptions: { agents }, createId: () => 'generated-id' },
  );

  assert.equal(viewMessages.length, 1);
  assert.equal(toolResultUpdates.length, 1);
  assert.equal(viewMessages[0].activity?.items[0].kind, 'tool');
  const mergedMessages = mergePersistedToolResults(viewMessages, toolResultUpdates);
  assert.deepEqual(mergedMessages[0].activity?.items[0].details?.toolCall, {
    id: 'tool-1',
    toolExecutionId: 'tool-exec-1',
    name: 'kanban',
    arguments: { action: 'list_cards' },
    status: 'completed',
    result: { cards: [] },
    endTime: new Date('2026-05-05T14:36:25.308Z').getTime(),
  });
  assert.deepEqual(toolResultUpdates[0], {
    id: 'tool-1',
    toolExecutionId: 'tool-exec-1',
    name: 'kanban',
    status: 'completed',
    result: { cards: [] },
    endTime: new Date('2026-05-05T14:36:25.308Z').getTime(),
  });
});

test('persisted job tool call and tool result hydrate into one completed activity', async () => {
  const jobToolCall: RestMessage = {
    id: 'job-tool-call-message',
    threadId: 'thread-1',
    senderType: 'job',
    senderId: 'job-1',
    senderUserId: 'job-1',
    content: '',
    toolCalls: [{
      id: 'tool-1',
      args: { action: 'list_cards' },
      tool: { id: 'kanban' },
    }],
    metadata: {
      senderExternalId: 'job-1',
      senderDisplayName: 'Test Tool Call Job',
      senderParticipantId: 'job-1',
      scheduledJob: {
        jobId: 'job-1',
        jobName: 'Test Tool Call Job',
        runId: 'job-1:123',
      },
    },
    createdAt: '2026-05-05T14:36:25.267Z',
  };
  const toolResult: RestMessage = {
    id: 'job-tool-result-message',
    threadId: 'thread-1',
    senderType: 'tool',
    senderId: 'job-1',
    senderUserId: 'job-1',
    content: '{"cards":[]}',
    metadata: {
      senderExternalId: 'job-1',
      senderDisplayName: 'Test Tool Call Job',
      senderParticipantId: 'job-1',
      toolCalls: [{
        id: 'tool-1',
        args: '{"action":"list_cards"}',
        tool: { id: 'kanban', name: 'kanban' },
        output: { cards: [] },
        status: 'completed',
      }],
    },
    createdAt: '2026-05-05T14:36:25.308Z',
  };

  const { viewMessages, toolResultUpdates } = await prepareHydratedMessages(
    [jobToolCall, toolResult],
    { createId: () => 'generated-id' },
  );

  assert.equal(viewMessages.length, 1);
  assert.equal(toolResultUpdates.length, 1);
  assert.equal(viewMessages[0].role, 'assistant');
  assert.equal(viewMessages[0].sender?.type, 'job');
  assert.equal(viewMessages[0].sender?.name, 'Test Tool Call Job');
  assert.equal(viewMessages[0].activity?.items[0].kind, 'tool');

  const mergedMessages = mergePersistedToolResults(viewMessages, toolResultUpdates);
  assert.deepEqual(mergedMessages[0].activity?.items[0].details?.toolCall, {
    id: 'tool-1',
    name: 'kanban',
    arguments: { action: 'list_cards' },
    status: 'completed',
    result: { cards: [] },
    endTime: new Date('2026-05-05T14:36:25.308Z').getTime(),
  });
});

test('live tool events parse to the same tool identity as persisted history', () => {
  const liveCall = extractLiveToolCall({
    toolCall: {
      id: 'tool-1',
      args: { action: 'list_cards' },
      tool: { id: 'kanban' },
    },
  });
  const liveResult = extractLiveToolResultUpdate({
    toolCallId: 'tool-1',
    tool: { id: 'kanban', name: 'kanban' },
    output: { cards: [] },
    status: 'completed',
  }, () => 123);

  assert.deepEqual(liveCall, {
    id: 'tool-1',
    name: 'kanban',
    arguments: { action: 'list_cards' },
    status: 'running',
  });
  assert.deepEqual(liveResult, {
    id: 'tool-1',
    name: 'kanban',
    status: 'completed',
    result: { cards: [] },
    endTime: 123,
  });
});

test('live failed tool result accepts error without output', () => {
  assert.deepEqual(extractLiveToolResultUpdate({
    toolCallId: 'tool-1',
    tool: { id: 'browser', name: 'browser' },
    status: 'failed',
    error: 'page crashed',
  }, () => 123), {
    id: 'tool-1',
    name: 'browser',
    status: 'failed',
    error: 'page crashed',
    endTime: 123,
  });
});

test('live cancelled tool result normalizes to failed activity', () => {
  assert.deepEqual(extractLiveToolResultUpdate({
    toolCallId: 'tool-1',
    tool: { id: 'browser', name: 'browser' },
    status: 'cancelled',
    error: { message: 'cancelled by user' },
  }, () => 123), {
    id: 'tool-1',
    name: 'browser',
    status: 'failed',
    error: '{"message":"cancelled by user"}',
    endTime: 123,
  });
});

test('tool contract throws instead of defaulting malformed statuses', () => {
  assert.throws(() => extractLiveToolResultUpdate({
    toolCallId: 'tool-1',
    tool: { id: 'kanban', name: 'kanban' },
    output: { cards: [] },
    status: 'mystery',
  }, () => 123), /status/);
});
