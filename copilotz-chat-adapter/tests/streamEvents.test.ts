import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getAgentFailure,
  getLlmAttemptId,
  getRoutingMessage,
  getVisibleLlmResultAnswer,
  isAgentOutputMessageEvent,
  isTerminalEmptyLlmResultEvent,
} from '../src/streamEvents.ts';

test('LLM attempt identity uses official stream metadata and validated lifecycle data', () => {
  assert.equal(getLlmAttemptId({
    metadata: { llmAttemptId: 'attempt-from-metadata' },
  }), 'attempt-from-metadata');

  assert.equal(getLlmAttemptId({
    subject: { type: 'llm.call', id: 'attempt-from-subject' },
    data: { actionId: 'llm.call', actionRunId: 'attempt-from-subject' },
  }), 'attempt-from-subject');

  assert.equal(getLlmAttemptId({
    subject: { type: 'llm.call', id: 'attempt-from-subject' },
    data: { actionId: 'llm.call', actionRunId: 'other-attempt' },
  }), null);
});

test('agent failures require matching durable receipt metadata and outcome', () => {
  const event = {
    type: 'message.created',
    metadata: {
      copilotzWorkflow: {
        kind: 'agent_failure',
        llmAttemptId: 'attempt-failed',
        outcome: 'failed',
      },
      copilotzAgentFailure: {
        schema: 'copilotz.agent-failure',
        llmAttemptId: 'attempt-failed',
        source: 'llm.call',
        status: 'failed',
      },
    },
  };
  assert.deepEqual(getAgentFailure(event), {
    llmAttemptId: 'attempt-failed', outcome: 'failed',
  });
  assert.equal(getAgentFailure({
    ...event,
    metadata: {
      ...event.metadata,
      copilotzAgentFailure: {
        ...event.metadata.copilotzAgentFailure,
        status: 'cancelled',
      },
    },
  }), null);
});

test('canonical agent output exposes its explicit workflow attempt identity', () => {
  assert.equal(getLlmAttemptId({
    type: 'llm.call.completed',
    subject: { type: 'llm.call', id: 'attempt-from-subject' },
    data: { actionId: 'llm.call', actionRunId: 'attempt-from-subject' },
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
