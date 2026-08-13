import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractLiveToolCallDelta,
  extractToolExecutionLifecycle,
  extractToolOutputDelta,
  parseCompletedToolCallDraft,
} from '../src/toolActivity.ts';
import { createToolCallDraftStore } from '../src/toolCallDraftStore.ts';

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
  const store = createToolCallDraftStore();
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
  assert.deepEqual(parseCompletedToolCallDraft(store.getSnapshot('draft-1')!), {
    id: 'call-1',
    name: 'terminal',
    arguments: { stdin: 'pwd' },
    status: 'running',
  });
  assert.equal(notifications, 3);
});

test('draft store discards snapshots and keeps a replay tombstone', () => {
  const store = createToolCallDraftStore();
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

test('completed canonical draft rejects malformed or renamed calls', () => {
  assert.throws(() => parseCompletedToolCallDraft({
    ...baseDelta,
    sequence: 1,
    rawInput: '{bad json',
    phase: 'complete',
    toolCallId: 'call-1',
  }), /valid JSON/);
  assert.throws(() => parseCompletedToolCallDraft({
    ...baseDelta,
    sequence: 1,
    rawInput: '{"name":"browser","arguments":{}}',
    phase: 'complete',
    toolCallId: 'call-1',
  }), /name changed/);
});

test('canonical tool output and lifecycle parsers preserve execution identity', () => {
  assert.deepEqual(extractToolOutputDelta({
    type: 'tool_output.delta',
    sequence: 4,
    payload: {
      toolExecutionId: 'execution-1',
      toolCallId: 'call-1',
      toolId: 'terminal',
      toolName: 'Run a one-shot script',
      channel: 'stdout',
      mode: 'append',
      mediaType: 'text/plain',
      delta: 'hello\n',
    },
  }), {
    id: 'call-1',
    toolExecutionId: 'execution-1',
    name: 'terminal',
    channel: 'stdout',
    mode: 'append',
    mediaType: 'text/plain',
    delta: 'hello\n',
    sequence: 4,
  });

  assert.deepEqual(extractToolExecutionLifecycle({
    type: 'tool_execution.failed',
    payload: {
      toolExecutionId: 'execution-1',
      toolCallId: 'call-1',
      toolId: 'terminal',
      toolName: 'Run a one-shot script',
      status: 'failed',
      safeError: { message: 'command failed' },
    },
  }, () => 123), {
    id: 'call-1',
    toolExecutionId: 'execution-1',
    name: 'terminal',
    status: 'failed',
    error: 'command failed',
    terminal: true,
    endTime: 123,
  });
});
