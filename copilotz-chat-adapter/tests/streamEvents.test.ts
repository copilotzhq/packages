import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getLlmAttemptId,
  getRoutingMessage,
  getVisibleLlmResultAnswer,
  isAgentOutputMessageEvent,
  isTerminalEmptyLlmResultEvent,
} from '../src/streamEvents.ts';

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

test('canonical events expose attempt identity from payload, subject, and workflow metadata', () => {
  assert.equal(getLlmAttemptId({
    type: 'text.delta',
    payload: { llmAttemptId: 'attempt-from-payload' },
  }), 'attempt-from-payload');
  assert.equal(getLlmAttemptId({
    type: 'llm_attempt.completed',
    subject: { type: 'llm_attempt', id: 'attempt-from-subject' },
  }), 'attempt-from-subject');
  const message = {
    type: 'message.created',
    metadata: {
      copilotzWorkflow: {
        kind: 'agent_output',
        llmAttemptId: 'attempt-from-workflow',
      },
    },
  };
  assert.equal(getLlmAttemptId(message), 'attempt-from-workflow');
  assert.equal(isAgentOutputMessageEvent(message), true);
  assert.equal(isAgentOutputMessageEvent({
    ...message,
    metadata: { copilotzWorkflow: { kind: 'tool_result' } },
  }), false);
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

test('consultation message is projected from current and legacy routing metadata', () => {
  for (const action of ['consult', 'ask', 'handoff']) {
    assert.equal(getRoutingMessage({
      metadata: {
        routing: {
          action,
          targetId: 'east',
          source: 'model_control',
          message: 'Please inspect this.',
        },
      },
    }), 'Please inspect this.');
  }
});

test('empty live LLM results use their consultation question as the visible answer', () => {
  assert.equal(getVisibleLlmResultAnswer({
    type: 'LLM_RESULT',
    payload: { answer: '' },
    metadata: {
      routing: {
        action: 'consult',
        targetId: 'east',
        source: 'model_control',
        message: 'Please inspect this.',
      },
    },
  }), 'Please inspect this.');

  assert.equal(getVisibleLlmResultAnswer({
    type: 'LLM_RESULT',
    payload: { answer: 'Visible provider answer.' },
    metadata: {
      routing: {
        action: 'consult',
        targetId: 'east',
        source: 'model_control',
        message: 'Please inspect this.',
      },
    },
  }), 'Visible provider answer.');
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
