import test from 'node:test';
import assert from 'node:assert/strict';
import type { ChatMessage, ChatSender } from '../src/types/chatTypes.ts';
import { groupMessagesForRender } from '../src/lib/messageGrouping.ts';

const sender: ChatSender = {
  type: 'agent',
  id: 'north',
  name: 'North',
  agentId: 'north',
};

const message = (
  id: string,
  activityItems: NonNullable<ChatMessage['activity']>['items'],
): ChatMessage => ({
  id,
  role: 'assistant',
  content: '',
  timestamp: Number(id.slice(-1)),
  sender,
  activity: { items: activityItems },
});

test('same-agent grouping preserves ordered source messages without flattening activity', () => {
  const messages = [
    message('message-1', [{
      id: 'attempt-1:reasoning:0',
      kind: 'thinking',
      status: 'complete',
      details: { reasoning: 'First reasoning' },
    }]),
    message('message-2', [
      {
        id: 'tool-1',
        kind: 'tool',
        status: 'complete',
        toolName: 'search',
      },
      {
        id: 'attempt-2:reasoning:0',
        kind: 'thinking',
        status: 'active',
        details: { reasoning: 'Second reasoning' },
      },
    ]),
  ];

  const groups = groupMessagesForRender(messages);

  assert.equal(groups.length, 1);
  assert.equal(groups[0].id, 'message-1');
  assert.deepEqual(groups[0].messages.map((item) => item.id), [
    'message-1',
    'message-2',
  ]);
  assert.deepEqual(
    groups[0].messages.flatMap((item) => item.activity?.items.map((activity) => activity.id) ?? []),
    ['attempt-1:reasoning:0', 'tool-1', 'attempt-2:reasoning:0'],
  );
});
