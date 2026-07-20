import test from 'node:test';
import assert from 'node:assert/strict';
import {
  appendAssistantToolCall,
  applyAssistantToolResult,
  finalizeAssistantMessage,
  updateAssistantMessageToken,
} from '../src/activity.ts';
import {
  canAttachToCurrentStreamingAssistant,
  canAttachToStreamingAssistant,
} from '../src/toolActivity.ts';

test('reasoning tokens create an active thinking timeline item', () => {
  const next = updateAssistantMessageToken({
    id: 'm1',
    role: 'assistant',
    content: '',
    timestamp: Date.now(),
  }, {
    partial: 'Analyzing',
    isReasoning: true,
  });

  assert.equal(next.activity?.items[0].kind, 'thinking');
  assert.equal(next.activity?.items[0].status, 'active');
  assert.equal(next.activity?.items[0].details?.reasoning, 'Analyzing');
});

test('answer tokens complete thinking and create an active answering item', () => {
  const thinking = updateAssistantMessageToken({
    id: 'm1',
    role: 'assistant',
    content: '',
    timestamp: Date.now(),
  }, {
    partial: 'Thinking',
    isReasoning: true,
  });
  const answering = updateAssistantMessageToken(thinking, {
    partial: 'Done',
  });

  assert.equal(answering.activity?.items[0].status, 'complete');
  assert.equal(answering.activity?.items[1].kind, 'answering');
  assert.equal(answering.activity?.items[1].status, 'active');
});

test('tool call then tool result updates one timeline item', () => {
  const withTool = appendAssistantToolCall({
    id: 'm1',
    role: 'assistant',
    content: '',
    timestamp: Date.now(),
    isStreaming: true,
    isComplete: false,
  }, {
    id: 'tool-1',
    name: 'instagramProfile',
    arguments: { username: 'gil' },
    status: 'running',
    startTime: 1,
  });

  assert.equal(withTool.activity?.items[0].kind, 'tool');
  assert.equal(withTool.activity?.items[0].status, 'active');
  assert.equal(withTool.activity?.items[0].toolName, 'instagramProfile');

  const resolved = applyAssistantToolResult(withTool, {
    id: 'tool-1',
    name: 'instagramProfile',
    status: 'completed',
    result: { ok: true },
    endTime: 2,
  });

  assert.equal(resolved.activity?.items.length, 1);
  assert.equal(resolved.activity?.items[0].status, 'complete');
  assert.deepEqual(resolved.activity?.items[0].details?.result, { ok: true });
});

test('failed tool result exposes the error in activity details', () => {
  const withTool = appendAssistantToolCall({
    id: 'm1',
    role: 'assistant',
    content: '',
    timestamp: Date.now(),
  }, {
    id: 'tool-1',
    name: 'browser',
    arguments: { url: 'https://example.com' },
    status: 'running',
  });

  const failed = applyAssistantToolResult(withTool, {
    id: 'tool-1',
    name: 'browser',
    status: 'failed',
    error: 'page crashed',
    endTime: 2,
  });

  assert.equal(failed.activity?.items[0].status, 'failed');
  assert.equal(failed.activity?.items[0].details?.error, 'page crashed');
  assert.equal(failed.activity?.items[0].details?.result, undefined);
});

test('finalizeAssistantMessage removes transient answering activity', () => {
  const answering = updateAssistantMessageToken({
    id: 'm1',
    role: 'assistant',
    content: '',
    timestamp: Date.now(),
    isStreaming: true,
    isComplete: false,
  }, {
    partial: 'Done',
  });

  const finalized = finalizeAssistantMessage(answering, 'Done');

  assert.equal(finalized.content, 'Done');
  assert.equal(finalized.isStreaming, false);
  assert.equal(finalized.isComplete, true);
  assert.equal(finalized.activity, undefined);
});

test('current streaming placeholder can adopt the real token sender', () => {
  const northPlaceholder = {
    id: 'assistant-placeholder',
    role: 'assistant',
    content: '',
    timestamp: Date.now(),
    isStreaming: true,
    isComplete: false,
    sender: {
      type: 'agent',
      id: 'north',
      name: 'North',
      agentId: 'north',
    },
  };

  assert.equal(canAttachToStreamingAssistant(northPlaceholder, 'west'), false);
  assert.equal(canAttachToCurrentStreamingAssistant(northPlaceholder), true);
});
