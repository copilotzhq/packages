import test from 'node:test';
import assert from 'node:assert/strict';
import type { InternalChatMessage } from '../src/activity.ts';
import {
  CLIENT_MESSAGE_ID_METADATA_KEY,
  LLM_ATTEMPT_ID_METADATA_KEY,
  reconcileThreadMessages,
} from '../src/messageReconciliation.ts';

const message = (
  id: string,
  role: 'user' | 'assistant',
  content: string,
  timestamp: number,
  metadata?: Record<string, unknown>,
): InternalChatMessage => ({
  id,
  role,
  content,
  timestamp,
  metadata,
  isStreaming: id.startsWith('optimistic-'),
  isComplete: !id.startsWith('optimistic-'),
});

test('persisted refresh replaces optimistic turn messages by stable correlations', () => {
  const current = [
    message('history-1', 'assistant', 'Earlier', 1),
    message('optimistic-user', 'user', 'Hello', 2, {
      [CLIENT_MESSAGE_ID_METADATA_KEY]: 'optimistic-user',
    }),
    message('optimistic-assistant', 'assistant', 'Hi there', 3, {
      [LLM_ATTEMPT_ID_METADATA_KEY]: 'attempt-1',
    }),
  ];
  const fresh = [
    message('history-1', 'assistant', 'Earlier', 1),
    message('persisted-user', 'user', 'Hello', 4, {
      [CLIENT_MESSAGE_ID_METADATA_KEY]: 'optimistic-user',
    }),
    message('persisted-assistant', 'assistant', 'Hi there', 5, {
      [LLM_ATTEMPT_ID_METADATA_KEY]: 'attempt-1',
    }),
  ];

  const reconciled = reconcileThreadMessages(current, fresh);

  assert.equal(reconciled.changed, true);
  assert.deepEqual(
    reconciled.messages.map((item) => item.id),
    ['history-1', 'persisted-user', 'persisted-assistant'],
  );
  assert.equal(reconciled.messages.some((item) => item.isStreaming), false);

  const repeated = reconcileThreadMessages(reconciled.messages, fresh);
  assert.equal(repeated.changed, false);
  assert.equal(repeated.messages, reconciled.messages);
});

test('ambiguous correlations never discard optimistic messages', () => {
  const current = [
    message('optimistic-assistant', 'assistant', 'Answer', 1, {
      [LLM_ATTEMPT_ID_METADATA_KEY]: 'attempt-1',
    }),
  ];
  const fresh = [
    message('persisted-assistant-1', 'assistant', 'Answer part one', 2, {
      [LLM_ATTEMPT_ID_METADATA_KEY]: 'attempt-1',
    }),
    message('persisted-assistant-2', 'assistant', 'Answer part two', 3, {
      [LLM_ATTEMPT_ID_METADATA_KEY]: 'attempt-1',
    }),
  ];

  const reconciled = reconcileThreadMessages(current, fresh);

  assert.deepEqual(
    reconciled.messages.map((item) => item.id),
    ['optimistic-assistant', 'persisted-assistant-1', 'persisted-assistant-2'],
  );
});
