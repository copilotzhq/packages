import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveHydratedMessageSender,
  resolveLiveEventSender,
} from '../src/senders.ts';

const agents = [
  { id: 'east', name: 'East', color: '#84cc16' },
  { id: 'north', name: 'North', color: '#3b82f6' },
];

test('hydrated agent message prefers Copilotz conversational sender metadata over storage id', () => {
  const sender = resolveHydratedMessageSender({
    senderType: 'agent',
    senderId: '01KQVCMZZE8W5Z99E94VP3EYWN',
    senderUserId: '01KQVCMZZE8W5Z99E94VP3EYWN',
    metadata: {
      senderExternalId: 'east',
      senderDisplayName: 'East',
      senderParticipantId: '01KQVCMZZE8W5Z99E94VP3EYWN',
    },
  }, { agents });

  assert.deepEqual(sender, {
    type: 'agent',
    id: 'east',
    name: 'East',
    agentId: 'east',
    color: '#84cc16',
    participantId: '01KQVCMZZE8W5Z99E94VP3EYWN',
  });
});

test('live stream event resolves to the same agent sender as hydrated history', () => {
  const sender = resolveLiveEventSender({
    type: 'TOKEN',
    payload: {
      agent: { id: 'east', name: 'East' },
      token: 'Hello',
      isComplete: false,
    },
  }, { agents });

  assert.deepEqual(sender, {
    type: 'agent',
    id: 'east',
    name: 'East',
    agentId: 'east',
    color: '#84cc16',
  });
});

test('hydrated current-user message prefers current user display name over storage id', () => {
  const sender = resolveHydratedMessageSender({
    senderType: 'user',
    senderId: 'node-1',
    senderUserId: '01KREXBE25ZSKRHP9RDJC72YD0:ig:patiputz',
    metadata: {
      senderExternalId: '01KREXBE25ZSKRHP9RDJC72YD0:ig:patiputz',
      senderDisplayName: '01KREXBE25ZSKRHP9RDJC72YD0:ig:patiputz',
      senderParticipantId: '01KREXBE25ZSKRHP9RDJC72YD0:ig:patiputz',
    },
  }, {
    user: {
      id: '01KREXBE25ZSKRHP9RDJC72YD0:ig:patiputz',
      name: '@patiputz',
    },
  });

  assert.deepEqual(sender, {
    type: 'user',
    id: '01KREXBE25ZSKRHP9RDJC72YD0:ig:patiputz',
    externalId: '01KREXBE25ZSKRHP9RDJC72YD0:ig:patiputz',
    name: '@patiputz',
    participantId: '01KREXBE25ZSKRHP9RDJC72YD0:ig:patiputz',
  });
});
