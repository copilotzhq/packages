import test from 'node:test';
import assert from 'node:assert/strict';
import { getLlmAttemptId, isTerminalEmptyLlmResultEvent } from '../src/streamEvents.ts';

test('LLM attempt identity is read from event metadata with subject fallback', () => {
  assert.equal(getLlmAttemptId({
    metadata: {
      streamLlmAttemptId: 'attempt-from-stream',
      llmAttemptId: 'attempt-from-metadata',
    },
    subjectType: 'llm_attempt',
    subjectId: 'attempt-from-subject',
  }), 'attempt-from-stream');

  assert.equal(getLlmAttemptId({
    metadata: { llmAttemptId: 'attempt-from-metadata' },
    subjectType: 'llm_attempt',
    subjectId: 'attempt-from-subject',
  }), 'attempt-from-metadata');

  assert.equal(getLlmAttemptId({
    subjectType: 'llm_attempt',
    subjectId: 'attempt-from-subject',
  }), 'attempt-from-subject');

  assert.equal(getLlmAttemptId({ subjectType: 'thread', subjectId: 'thread-1' }), null);
});

test('terminal empty LLM result is detected when it has no tools or routing', () => {
  assert.equal(isTerminalEmptyLlmResultEvent({
    type: 'LLM_RESULT',
    metadata: { targetId: 'north', targetQueue: [] },
    payload: {
      answer: '',
      finishReason: 'stop',
      toolCalls: null,
    },
  }), true);
});

test('empty LLM result is not terminal when it still has routing work', () => {
  assert.equal(isTerminalEmptyLlmResultEvent({
    type: 'LLM_RESULT',
    metadata: {
      routing: {
        action: 'handoff',
        targetId: 'east',
        source: 'model_control',
        message: 'Continue the implementation.',
      },
      targetQueue: [],
    },
    payload: {
      answer: '',
      finishReason: 'stop',
      toolCalls: null,
    },
  }), false);

  assert.equal(isTerminalEmptyLlmResultEvent({
    type: 'LLM_RESULT',
    metadata: { targetQueue: ['east'] },
    payload: {
      answer: '',
      finishReason: 'stop',
      toolCalls: null,
    },
  }), false);
});

test('empty LLM result is not terminal when it has tool calls', () => {
  assert.equal(isTerminalEmptyLlmResultEvent({
    type: 'LLM_RESULT',
    metadata: { targetQueue: [] },
    payload: {
      answer: '',
      finishReason: 'tool_calls',
      toolCalls: [{ id: 'call-1' }],
    },
  }), false);
});

test('non-empty LLM result is not a terminal empty result', () => {
  assert.equal(isTerminalEmptyLlmResultEvent({
    type: 'LLM_RESULT',
    metadata: { targetQueue: [] },
    payload: {
      answer: 'Done',
      finishReason: 'stop',
      toolCalls: null,
    },
  }), false);
});
