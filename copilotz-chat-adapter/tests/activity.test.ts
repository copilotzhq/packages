import test from 'node:test';
import assert from 'node:assert/strict';
import {
  appendAssistantToolCall,
  applyAssistantToolResult,
  buildAssistantActivity,
  finalizeAssistantMessage,
  syncAssistantActivity,
  updateAssistantMessageToken,
} from '../src/activity.ts';

test('buildAssistantActivity derives thinking activity from reasoning history', () => {
  const activity = buildAssistantActivity({
    content: '',
    _activityReasoning: 'Reasoning trace',
    _activityReasoningStreaming: false,
    isStreaming: false,
    _activityToolCalls: undefined,
  });

  assert.ok(activity);
  assert.equal(activity.summary.kind, 'thinking');
  assert.equal(activity.isActive, false);
  assert.equal(activity.isComplete, true);
});

test('updateAssistantMessageToken marks reasoning as active', () => {
  const next = updateAssistantMessageToken({
    id: 'm1',
    role: 'assistant',
    content: '',
    timestamp: Date.now(),
  }, {
    partial: 'Analyzing',
    isReasoning: true,
  });

  assert.equal(next._activityReasoning, 'Analyzing');
  assert.equal(next.activity?.summary.kind, 'thinking');
  assert.equal(next.activity?.isActive, true);
});

test('tool call then tool result resolves to using_tools summary', () => {
  const base = syncAssistantActivity({
    id: 'm1',
    role: 'assistant',
    content: '',
    timestamp: Date.now(),
    isStreaming: true,
    isComplete: false,
  });

  const withTool = appendAssistantToolCall(base, {
    id: 'tool-1',
    name: 'instagramProfile',
    arguments: { username: 'gil' },
    status: 'running',
    startTime: 1,
  });

  assert.equal(withTool.activity?.summary.kind, 'using_tools');
  assert.equal(withTool.activity?.summary.toolName, 'instagramProfile');

  const resolved = applyAssistantToolResult(withTool, {
    id: 'tool-1',
    name: 'instagramProfile',
    status: 'completed',
    result: { ok: true },
    endTime: 2,
  });

  assert.equal(resolved.activity?.toolCalls?.[0]?.status, 'completed');
  assert.equal(resolved.activity?.summary.kind, 'using_tools');
  assert.equal(resolved.activity?.isActive, true);
});

test('persisted completed tool result does not reactivate assistant history', () => {
  const persisted = syncAssistantActivity({
    id: 'm-history',
    role: 'assistant',
    content: 'Saved.',
    timestamp: Date.now(),
    isStreaming: false,
    isComplete: true,
    _activityReasoning: 'Reasoning trace',
    _activityToolCalls: [{
      id: 'tool-1',
      name: 'saveUserContext',
      arguments: { origin: { nonNegotiableValue: 'x' } },
      status: 'completed',
    }],
  });

  const resolved = applyAssistantToolResult(persisted, {
    id: 'tool-1',
    name: 'saveUserContext',
    status: 'completed',
    result: { success: true },
  });

  assert.equal(resolved.isStreaming, false);
  assert.equal(resolved.isComplete, true);
  assert.equal(resolved.activity?.isActive, false);
  assert.equal(resolved.activity?.isComplete, true);
});

test('finalizeAssistantMessage moves active turn to preparing/complete answer state', () => {
  const streaming = syncAssistantActivity({
    id: 'm1',
    role: 'assistant',
    content: '',
    timestamp: Date.now(),
    isStreaming: true,
    isComplete: false,
    _activityReasoning: 'Thinking',
    _activityReasoningStreaming: true,
  });

  const finalized = finalizeAssistantMessage(streaming, 'Done');

  assert.equal(finalized.content, 'Done');
  assert.equal(finalized.isStreaming, false);
  assert.equal(finalized.activity?.isActive, false);
  assert.equal(finalized.activity?.isComplete, true);
});
