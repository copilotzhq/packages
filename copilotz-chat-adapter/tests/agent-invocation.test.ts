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
