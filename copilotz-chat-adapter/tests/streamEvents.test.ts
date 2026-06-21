import test from 'node:test';
import assert from 'node:assert/strict';
import { isTerminalEmptyLlmResultEvent } from '../src/streamEvents.ts';

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
    metadata: { routing: { routeTo: ['east'] }, targetQueue: [] },
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
