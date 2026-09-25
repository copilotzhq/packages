import test from 'node:test';
import assert from 'node:assert/strict';
import { Virtualizer } from '@tanstack/virtual-core';
import type { ChatMessage, ChatSender } from '../src/types/chatTypes.ts';
import { groupMessagesForRender } from '../src/lib/messageGrouping.ts';

const sender: ChatSender = {
  type: 'agent',
  id: 'north',
  name: 'North',
  agentId: 'north',
};

const assistantMessage = (id: string, content = id): ChatMessage => ({
  id,
  role: 'assistant',
  content,
  timestamp: 0,
  sender,
});

const userMessage = (id: string): ChatMessage => ({
  id,
  role: 'user',
  content: id,
  timestamp: 0,
});

test('prepending a matching assistant fragment retains the measured row height', () => {
  let groups = groupMessagesForRender([
    assistantMessage('assistant-first'),
    assistantMessage('assistant-last'),
    userMessage('user-next'),
  ]);
  const getItemKey = (index: number) =>
    groups[index]?.primaryMessage.id ?? index;
  const options = {
    count: groups.length,
    getScrollElement: () => null,
    estimateSize: () => 100,
    getItemKey,
    scrollToFn: () => {},
    observeElementRect: () => {},
    observeElementOffset: () => {},
  };
  const virtualizer = new Virtualizer(options);

  virtualizer.getTotalSize();
  virtualizer.resizeItem(0, 420);

  const oldGroupId = groups[0].id;
  const oldPrimaryMessageId = groups[0].primaryMessage.id;
  groups = groupMessagesForRender([
    userMessage('user-older'),
    assistantMessage('assistant-older'),
    assistantMessage('assistant-first'),
    assistantMessage('assistant-last'),
    userMessage('user-next'),
  ]);

  assert.equal(groups.length, 3);
  assert.notEqual(groups[1].id, oldGroupId);
  assert.equal(groups[1].primaryMessage.id, oldPrimaryMessageId);

  virtualizer.setOptions({
    ...options,
    count: groups.length,
    getItemKey,
  });

  assert.equal(virtualizer.getTotalSize(), 620);
});
