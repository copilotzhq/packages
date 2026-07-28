import test from 'node:test';
import assert from 'node:assert/strict';
import type { ChatSender } from '@copilotz/chat-ui';
import {
  applyLiveRunOperations,
  createLiveRunState,
  transitionLiveRun,
} from '../src/liveRun.ts';

const sender: ChatSender = {
  type: 'agent',
  id: 'north',
  name: 'North',
  agentId: 'north',
};

test('live run preserves multi-attempt reasoning, answers, and tools in event order', () => {
  let nextId = 1;
  const createId = () => `generated-${nextId++}`;
  let run = createLiveRunState('placeholder');
  let messages = [{
    id: 'placeholder',
    role: 'assistant' as const,
    content: '',
    timestamp: 0,
    isStreaming: true,
    isComplete: false,
    sender,
  }];

  const dispatch = (action: Parameters<typeof transitionLiveRun>[1]) => {
    const transition = transitionLiveRun(run, action, { createId });
    run = transition.state;
    messages = applyLiveRunOperations(messages, transition.operations);
  };

  dispatch({ type: 'attempt-start', attemptId: 'attempt-1', sender, at: 1 });
  dispatch({
    type: 'token',
    attemptId: 'attempt-1',
    phaseId: 'attempt-1:reasoning:0',
    partial: 'Reasoning one',
    isReasoning: true,
    sender,
    at: 2,
  });
  dispatch({ type: 'attempt-result', attemptId: 'attempt-1', answer: '', at: 3 });
  dispatch({
    type: 'tool-call',
    attemptId: 'attempt-1',
    sender,
    at: 4,
    toolCall: {
      id: 'tool-1',
      name: 'search',
      arguments: { query: 'evidence' },
      status: 'running',
    },
  });
  dispatch({
    type: 'tool-result',
    update: {
      id: 'tool-1',
      name: 'search',
      status: 'completed',
      result: { found: true },
      endTime: 5,
    },
  });
  dispatch({ type: 'attempt-start', attemptId: 'attempt-2', sender, at: 6 });
  dispatch({
    type: 'token',
    attemptId: 'attempt-2',
    phaseId: 'attempt-2:reasoning:0',
    partial: 'Reasoning two',
    isReasoning: true,
    sender,
    at: 7,
  });
  dispatch({
    type: 'token',
    attemptId: 'attempt-2',
    phaseId: 'attempt-2:answer:1',
    partial: 'Final answer',
    isReasoning: false,
    sender,
    at: 8,
  });
  dispatch({ type: 'attempt-result', attemptId: 'attempt-2', answer: 'Final answer', at: 9 });

  assert.deepEqual(messages.map((message) => message.id), ['placeholder', 'generated-1']);
  assert.deepEqual(
    messages[0].activity?.items.map((item) => item.id),
    ['attempt-1:reasoning:0', 'tool-1'],
  );
  assert.equal(messages[0].activity?.items[0].details?.reasoning, 'Reasoning one');
  assert.deepEqual(messages[0].activity?.items[1].details?.result, { found: true });
  assert.deepEqual(
    messages[1].activity?.items.map((item) => item.id),
    ['attempt-2:reasoning:0'],
  );
  assert.equal(messages[1].content, 'Final answer');
  assert.equal(messages[1].isStreaming, false);
  assert.equal(messages[1].isComplete, true);
});

test('tool result received before its call is applied when the call arrives', () => {
  let run = createLiveRunState('placeholder');
  let messages = [{
    id: 'placeholder',
    role: 'assistant' as const,
    content: '',
    timestamp: 0,
    isStreaming: true,
    isComplete: false,
    sender,
  }];
  const createId = () => 'unused';

  for (const action of [
    { type: 'attempt-start', attemptId: 'attempt-1', sender, at: 1 } as const,
    {
      type: 'tool-result',
      update: {
        id: 'tool-1',
        name: 'browser',
        status: 'failed' as const,
        error: 'page crashed',
        endTime: 2,
      },
    } as const,
    {
      type: 'tool-call',
      attemptId: 'attempt-1',
      sender,
      at: 3,
      toolCall: {
        id: 'tool-1',
        name: 'browser',
        arguments: { url: 'https://example.com' },
        status: 'running' as const,
      },
    } as const,
  ]) {
    const transition = transitionLiveRun(run, action, { createId });
    run = transition.state;
    messages = applyLiveRunOperations(messages, transition.operations);
  }

  assert.equal(messages[0].activity?.items[0].status, 'failed');
  assert.equal(messages[0].activity?.items[0].details?.error, 'page crashed');
});

test('fallback result finalizes the active streamed attempt', () => {
  let run = createLiveRunState('placeholder');
  let messages = [{
    id: 'placeholder',
    role: 'assistant' as const,
    content: '',
    timestamp: 0,
    isStreaming: true,
    isComplete: false,
    sender,
  }];
  const createId = () => 'unused';
  const dispatch = (action: Parameters<typeof transitionLiveRun>[1]) => {
    const transition = transitionLiveRun(run, action, { createId });
    run = transition.state;
    messages = applyLiveRunOperations(messages, transition.operations);
  };

  dispatch({ type: 'attempt-start', attemptId: 'primary-attempt', sender, at: 1 });
  dispatch({
    type: 'token',
    attemptId: 'primary-attempt',
    phaseId: 'primary-attempt:reasoning:0',
    partial: 'Recovered reasoning',
    isReasoning: true,
    sender,
    at: 2,
  });
  dispatch({
    type: 'attempt-result',
    attemptId: 'fallback-attempt',
    answer: 'Recovered answer',
    at: 3,
  });

  assert.equal(messages[0].content, 'Recovered answer');
  assert.equal(messages[0].isStreaming, false);
  assert.equal(messages[0].isComplete, true);
  assert.equal(messages[0].activity?.items[0].details?.reasoning, 'Recovered reasoning');
  assert.equal(run.activeAttemptId, null);
  assert.equal(run.lastAttemptId, 'primary-attempt');
});

test('replayed token and tool-call events do not duplicate or reopen timeline items', () => {
  let run = createLiveRunState('placeholder');
  let messages = [{
    id: 'placeholder',
    role: 'assistant' as const,
    content: '',
    timestamp: 0,
    isStreaming: true,
    isComplete: false,
    sender,
  }];
  const createId = () => 'unused';
  const dispatch = (action: Parameters<typeof transitionLiveRun>[1]) => {
    const transition = transitionLiveRun(run, action, { createId });
    run = transition.state;
    messages = applyLiveRunOperations(messages, transition.operations);
  };

  const token = {
    type: 'token' as const,
    attemptId: 'attempt-1',
    phaseId: 'attempt-1:reasoning:0',
    partial: 'Stable reasoning',
    isReasoning: true,
    sender,
    at: 2,
  };
  const toolCall = {
    type: 'tool-call' as const,
    attemptId: 'attempt-1',
    sender,
    at: 3,
    toolCall: {
      id: 'tool-1',
      name: 'search',
      arguments: {},
      status: 'running' as const,
    },
  };

  dispatch({ type: 'attempt-start', attemptId: 'attempt-1', sender, at: 1 });
  dispatch(token);
  dispatch(token);
  dispatch(toolCall);
  dispatch({
    type: 'tool-result',
    update: {
      id: 'tool-1',
      name: 'search',
      status: 'completed',
      result: { ok: true },
      endTime: 4,
    },
  });
  dispatch(toolCall);

  assert.deepEqual(
    messages[0].activity?.items.map((item) => item.id),
    ['attempt-1:reasoning:0', 'tool-1'],
  );
  assert.equal(messages[0].activity?.items[1].status, 'complete');
  assert.deepEqual(messages[0].activity?.items[1].details?.result, { ok: true });
});

test('tool draft reconciles into one finalized tool activity', () => {
  let run = createLiveRunState('placeholder');
  let messages = [{
    id: 'placeholder',
    role: 'assistant' as const,
    content: '',
    timestamp: 0,
    isStreaming: true,
    isComplete: false,
    sender,
  }];
  const dispatch = (action: Parameters<typeof transitionLiveRun>[1]) => {
    const transition = transitionLiveRun(run, action, {
      createId: () => 'unused',
    });
    run = transition.state;
    messages = applyLiveRunOperations(messages, transition.operations);
  };

  dispatch({
    type: 'tool-draft-start',
    attemptId: 'attempt-1',
    draftId: 'draft-1',
    toolName: 'terminal',
    sender,
    at: 1,
  });
  assert.equal(messages[0].activity?.items.length, 1);
  assert.equal(
    messages[0].activity?.items[0].details?.toolCallDraftId,
    'draft-1',
  );

  dispatch({
    type: 'tool-draft-complete',
    draftId: 'draft-1',
    toolCallId: 'call-1',
  });
  dispatch({
    type: 'tool-call',
    attemptId: 'attempt-1',
    sender,
    at: 2,
    toolCall: {
      id: 'call-1',
      name: 'terminal',
      arguments: { stdin: 'pwd' },
      status: 'running',
    },
  });
  dispatch({
    type: 'tool-call',
    attemptId: 'attempt-1',
    sender,
    at: 2,
    toolCall: {
      id: 'call-1',
      name: 'terminal',
      arguments: { stdin: 'pwd' },
      status: 'running',
    },
  });

  assert.equal(messages[0].activity?.items.length, 1);
  assert.equal(messages[0].activity?.items[0].id, 'call-1');
  assert.deepEqual(
    messages[0].activity?.items[0].details?.toolCall?.arguments,
    { stdin: 'pwd' },
  );
  assert.equal(
    messages[0].activity?.items[0].details?.toolCallDraftId,
    'draft-1',
  );
});

test('discarded tool draft removes its provisional activity', () => {
  let run = createLiveRunState('placeholder');
  let messages = [{
    id: 'placeholder',
    role: 'assistant' as const,
    content: '',
    timestamp: 0,
    isStreaming: true,
    isComplete: false,
    sender,
  }];
  const dispatch = (action: Parameters<typeof transitionLiveRun>[1]) => {
    const transition = transitionLiveRun(run, action, {
      createId: () => 'unused',
    });
    run = transition.state;
    messages = applyLiveRunOperations(messages, transition.operations);
  };

  dispatch({
    type: 'tool-draft-start',
    attemptId: 'attempt-1',
    draftId: 'draft-1',
    toolName: 'terminal',
    sender,
    at: 1,
  });
  dispatch({ type: 'tool-draft-discard', draftId: 'draft-1' });

  assert.equal(messages[0].activity, undefined);
  assert.equal(run.draftMessageById.has('draft-1'), false);
});
