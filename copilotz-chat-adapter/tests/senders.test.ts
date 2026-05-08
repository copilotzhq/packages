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
