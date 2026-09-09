import test from 'node:test';
import assert from 'node:assert/strict';
import { emptyProjection, projectFrame } from '../src/projection.ts';
import { createObservationBootstrap } from '../src/observationBootstrap.ts';
import type { ObservationFrame } from '@copilotz/copilotz/client';

function lifecycle(run: string, agent: string, status: string): ObservationFrame {
  return { kind: 'output', checkpoint: status, output: {
    type: `copilotz.core.context.compact.${status}`, operationId: 'op',
    data: { actionRunId: run, metadata: {
      schema: 'copilotz.core.context-compaction.v1', agentId: agent, agentName: agent,
    } },
  } };
}

test('foreground compaction belongs to the waiting Agent and clears independently', () => {
  let state = emptyProjection();
  const apply = (frame: ObservationFrame) => state = projectFrame(state, frame, 1).state;
  apply(lifecycle('north-wait', 'north', 'invoked'));
  apply(lifecycle('north-wait', 'north', 'invoked'));
  apply(lifecycle('west-wait', 'west', 'invoked'));
  assert.deepEqual(state.messages.map(message => [message.sender?.id, message.activity?.items[0].kind]),
    [['north', 'compacting'], ['west', 'compacting']]);
  apply(lifecycle('north-wait', 'north', 'completed'));
  assert.deepEqual(state.messages.map(message => message.sender?.id), ['west']);
  apply(lifecycle('west-wait', 'west', 'cancelled'));
  assert.equal(state.messages.length, 0);
});

test('compaction replay is visible during bootstrap and operation cancellation clears it', () => {
  const bootstrap = createObservationBootstrap();
  let state = emptyProjection();
  bootstrap.apply({ kind: 'output', checkpoint: 'b', output: {
    type: 'observation.bootstrap', streams: [{ streamId: 'old', offset: 30, terminal: false }],
  } }, state);
  state = projectFrame(state, lifecycle('waiting', 'north', 'invoked'), 1).state;
  assert.equal(bootstrap.visible(state).messages[0].activity?.items[0].kind, 'compacting');
  state = projectFrame(state, { kind: 'output', checkpoint: 'c', output: {
    type: 'operation.cancelled', operationId: 'op',
  } }, 2).state;
  assert.equal(state.messages.length, 0);
});

test('background consolidation is not foreground activity; failures end the indicator', () => {
  let state = emptyProjection();
  state = projectFrame(state, { kind: 'output', checkpoint: 'b', output: {
    type: 'copilotz.memory.consolidation.commit.invoked', operationId: 'op',
    data: { actionRunId: 'private', input: { continuity: 'private content' } },
  } }, 1).state;
  assert.equal(state.messages.length, 0);
  state = projectFrame(state, lifecycle('waiting', 'north', 'invoked'), 2).state;
  state = projectFrame(state, lifecycle('waiting', 'north', 'failed'), 3).state;
  assert.equal(state.messages[0].isStreaming, false);
  assert.equal(state.messages[0].activity, undefined);
  assert.match(state.messages[0].content, /could not be consolidated/);
  assert.doesNotMatch(JSON.stringify(state), /private content/);
});
