import test from 'node:test';
import assert from 'node:assert/strict';
import type { ChatMessage, ChatSender } from '../src/types/chatTypes.ts';
import { createOwnMessagePredicate } from '../src/lib/messageOwnership.ts';

const person = (id: string, name: string): ChatSender => ({
  type: 'user',
  id,
  externalId: id,
  participantId: `participant-${id}`,
  name,
});
const north: ChatSender = { type: 'agent', id: 'north', name: 'North', agentId: 'north' };

const message = (id: string, sender?: ChatSender): ChatMessage => ({
  id,
  role: sender?.type === 'agent' ? 'assistant' : 'user',
  content: id,
  timestamp: 0,
  ...(sender ? { sender } : {}),
});

const ana = person('person-ana', 'Ana');
const ben = person('person-ben', 'Ben');

test('one human sender keeps every human message as the user\'s', () => {
  const messages = [message('a1', ana), message('n1', north), message('a2', ana)];
  const own = createOwnMessagePredicate(messages, 'signed-in-user');
  assert.deepEqual(messages.map(own), [true, false, true]);
});

test('with several people, only the signed-in user\'s messages are theirs', () => {
  const messages = [message('a1', ana), message('b1', ben), message('n1', north)];
  const own = createOwnMessagePredicate(messages, 'person-ana');
  assert.deepEqual(messages.map(own), [true, false, false]);
});

test('the user matches by participant id as well as external id', () => {
  const messages = [message('a1', ana), message('b1', ben)];
  const own = createOwnMessagePredicate(messages, 'participant-person-ben');
  assert.deepEqual(messages.map(own), [false, true]);
});

test('an unmatched user id falls back to every human message being the user\'s', () => {
  const messages = [message('a1', ana), message('b1', ben)];
  const own = createOwnMessagePredicate(messages, 'someone-else');
  assert.deepEqual(messages.map(own), [true, true]);
});

test('a human message without a sender stays the user\'s', () => {
  const messages = [message('a1', ana), message('b1', ben), message('pending')];
  const own = createOwnMessagePredicate(messages, 'person-ana');
  assert.deepEqual(messages.map(own), [true, false, true]);
});
