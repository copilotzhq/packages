import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyProjection, projectFrame } from '../src/projection.ts';
import type { ObservationFrame } from '@copilotz/copilotz/client';

test('preparation follows each invocation, yields to real activity, and does not follow operation lifetime', () => {
  let state = emptyProjection();
  const apply = (frame: ObservationFrame) => {
    state = projectFrame(state, frame, 10).state;
  };
  const lifecycle = (run: string, agent: string, status: string) =>
    apply({
      kind: 'output',
      checkpoint: 'c',
      output: {
        type: `llm.call.${status}`,
        operationId: 'op',
        data: {
          actionRunId: run,
          metadata: { schema: 'copilotz.core.llm-call.v1', agentId: agent }
        }
      }
    });
  lifecycle('north-1', 'north', 'invoked');
  lifecycle('north-1', 'north', 'invoked');
  assert.equal(state.messages.length, 1);
  assert.equal(state.messages[0].activity?.items[0].kind, 'answering');
  apply({
    kind: 'output',
    checkpoint: 'c',
    output: {
      type: 'stream.output',
      operationId: 'op',
      streamId: 'reason',
      role: 'reasoning',
      mediaType: 'text/plain',
      metadata: { sourceActionRunId: 'north-1' }
    }
  });
  apply({
    kind: 'stream-chunk',
    checkpoint: 'c',
    streamId: 'reason',
    offset: 0,
    bytes: new TextEncoder().encode('Plan')
  });
  assert.deepEqual(
    state.messages[0].activity?.items.map((item) => item.kind),
    ['thinking']
  );
  lifecycle('north-1', 'north', 'completed');
  lifecycle('west-1', 'west', 'invoked');
  lifecycle('east-1', 'east', 'invoked');
  assert.deepEqual(
    state.messages.filter((m) => m.isStreaming).map((m) => m.sender?.agentId),
    ['west', 'east']
  );
  const order = state.messages.map((m) => m.id);
  lifecycle('west-1', 'west', 'completed');
  assert.deepEqual(
    state.messages.filter((m) => m.isStreaming).map((m) => m.sender?.agentId),
    ['east']
  );
  assert.equal(state.messages[0].id, order[0]);
  lifecycle('north-2', 'north', 'invoked');
  assert.deepEqual(
    state.messages.filter((m) => m.isStreaming).map((m) => m.sender?.agentId),
    ['east', 'north']
  );
  apply({
    kind: 'output',
    checkpoint: 'c',
    output: { type: 'operation.completed', operationId: 'op' }
  });
  assert.equal(
    state.messages.some((m) => m.isStreaming),
    false
  );
});

const WEST = {
  id: 'west',
  name: 'West',
  color: '#9d8cff',
  avatarUrl: 'data:image/svg+xml,west'
};

const invoked = (run: string, agent: string): ObservationFrame => ({
  kind: 'output',
  checkpoint: 'c',
  output: {
    type: 'llm.call.invoked',
    operationId: 'op',
    data: {
      actionRunId: run,
      metadata: { schema: 'copilotz.core.llm-call.v1', agentId: agent }
    }
  }
});

test('an agent preparing a reply is presented as its configured option, not its id', () => {
  const senderOptions = { agents: [WEST] };
  const state = projectFrame(
    emptyProjection(),
    invoked('west-1', 'west'),
    10,
    senderOptions
  ).state;
  assert.deepEqual(state.messages[0].sender, {
    type: 'agent',
    id: 'west',
    agentId: 'west',
    name: 'West',
    avatarUrl: WEST.avatarUrl,
    color: WEST.color
  });
  // Without a configured option the id is all there is to show.
  const bare = projectFrame(emptyProjection(), invoked('west-1', 'west'), 10)
    .state;
  assert.equal(bare.messages[0].sender?.name, 'west');
  assert.equal(bare.messages[0].sender?.avatarUrl, undefined);
});

test('a preparation entry keeps the configured avatar and color when its invocation is observed', () => {
  const senderOptions = { agents: [WEST] };
  const started = emptyProjection();
  started.messages = [
    {
      id: 'pending:1:preparing',
      role: 'assistant',
      content: '',
      timestamp: 1,
      isStreaming: true,
      sender: { type: 'agent', id: 'west', agentId: 'west', name: 'west' },
      metadata: { operationId: 'op' }
    }
  ];
  const state = projectFrame(
    started,
    invoked('west-1', 'west'),
    10,
    senderOptions
  ).state;
  assert.equal(state.messages.length, 1);
  assert.equal(state.messages[0].id, 'pending:1:preparing');
  assert.equal(state.messages[0].sender?.name, 'West');
  assert.equal(state.messages[0].sender?.avatarUrl, WEST.avatarUrl);
  assert.equal(state.messages[0].sender?.color, WEST.color);
});

test('a streaming reply is presented through the configured agent even when the server names it by id', () => {
  const senderOptions = { agents: [WEST] };
  let state = projectFrame(
    emptyProjection(),
    invoked('west-1', 'west'),
    10,
    senderOptions
  ).state;
  state = projectFrame(
    state,
    {
      kind: 'output',
      checkpoint: 'c',
      output: {
        type: 'stream.output',
        operationId: 'op',
        streamId: 'answer',
        role: 'content',
        mediaType: 'text/plain',
        metadata: {
          sourceActionRunId: 'west-1',
          copilotzCore: { agent: { id: 'west', name: 'west' } }
        }
      }
    },
    11,
    senderOptions
  ).state;
  state = projectFrame(
    state,
    {
      kind: 'stream-chunk',
      checkpoint: 'c',
      streamId: 'answer',
      offset: 0,
      bytes: new TextEncoder().encode('Hi')
    },
    12,
    senderOptions
  ).state;
  const reply = state.messages.find((message) => message.content === 'Hi');
  assert.equal(reply?.sender?.name, 'West');
  assert.equal(reply?.sender?.avatarUrl, WEST.avatarUrl);
  assert.equal(reply?.sender?.color, WEST.color);
});
