import test from 'node:test';
import assert from 'node:assert/strict';
import { extractLiveToolCallDelta } from '../src/toolActivity.ts';
import { ToolCallDraftStore } from '../src/toolCallDraftStore.ts';

const baseDelta = {
  llmAttemptId: 'attempt-1',
  draftId: 'draft-1',
  callIndex: 0,
  toolName: 'terminal',
};

test('TOOL_CALL_DELTA parsing validates phases, sequence, and completion id', () => {
  assert.deepEqual(extractLiveToolCallDelta({
    ...baseDelta,
    sequence: 0,
    phase: 'start',
    delta: '{"name":"terminal"',
  }), {
    ...baseDelta,
    sequence: 0,
    phase: 'start',
    delta: '{"name":"terminal"',
  });

  assert.throws(() => extractLiveToolCallDelta({
    ...baseDelta,
    sequence: 1,
    phase: 'complete',
    delta: '',
  }), /toolCallId is required on complete/);
  assert.throws(() => extractLiveToolCallDelta({
    ...baseDelta,
    sequence: -1,
    phase: 'delta',
    delta: '',
  }), /sequence must be a non-negative integer/);
});

test('draft store appends monotonic deltas and deduplicates replay', () => {
  const store = new ToolCallDraftStore();
  let notifications = 0;
  store.subscribe('draft-1', () => {
    notifications += 1;
  });

  assert.equal(store.apply({
    ...baseDelta,
    sequence: 0,
    phase: 'start',
    delta: '{"name":"terminal"',
  }), 'created');
  assert.equal(store.apply({
    ...baseDelta,
    sequence: 1,
    phase: 'delta',
    delta: ',"arguments":{"stdin":"pwd"}}',
  }), 'updated');
  assert.equal(store.apply({
    ...baseDelta,
    sequence: 1,
    phase: 'delta',
    delta: 'duplicate',
  }), 'ignored');
  assert.equal(store.apply({
    ...baseDelta,
    sequence: 2,
    phase: 'complete',
    delta: '',
    toolCallId: 'call-1',
  }), 'completed');

  assert.deepEqual(store.getSnapshot('draft-1'), {
    ...baseDelta,
    sequence: 2,
    rawInput: '{"name":"terminal","arguments":{"stdin":"pwd"}}',
    phase: 'complete',
    toolCallId: 'call-1',
  });
  assert.equal(notifications, 3);
});

test('draft store discards snapshots and keeps a replay tombstone', () => {
  const store = new ToolCallDraftStore();
  store.apply({
    ...baseDelta,
    sequence: 0,
    phase: 'start',
    delta: '{"name":"terminal"',
  });
  assert.equal(store.apply({
    ...baseDelta,
    sequence: 1,
    phase: 'discarded',
    delta: '',
  }), 'discarded');
  assert.equal(store.getSnapshot('draft-1'), undefined);
  assert.equal(store.apply({
    ...baseDelta,
    sequence: 0,
    phase: 'start',
    delta: 'replayed',
  }), 'ignored');
  assert.equal(store.getSnapshot('draft-1'), undefined);
});
