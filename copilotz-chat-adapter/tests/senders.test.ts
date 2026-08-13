import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveCanonicalParticipantSender,
  resolveLiveEventSender,
} from '../src/senders.ts';

const agents = [
  { id: 'east', name: 'East', color: '#84cc16' },
  { id: 'north', name: 'North', color: '#3b82f6' },
];

const participant = (
  overrides: Partial<Parameters<typeof resolveCanonicalParticipantSender>[0]> = {},
): Parameters<typeof resolveCanonicalParticipantSender>[0] => ({
  id: 'participant-east',
  namespace: 'tenant-a',
  externalId: 'east',
  participantType: 'agent',
  name: 'East',
  agentId: 'east',
  metadata: {},
  createdAt: '2026-08-13T10:00:00.000Z',
  updatedAt: '2026-08-13T10:00:00.000Z',
  ...overrides,
});

test('canonical participant identity resolves the hydrated agent sender', () => {
  assert.deepEqual(resolveCanonicalParticipantSender(participant(), { agents }), {
    type: 'agent',
    id: 'east',
    name: 'East',
    agentId: 'east',
    color: '#84cc16',
    participantId: 'participant-east',
  });
});

test('live stream event resolves to the same agent sender as canonical history', () => {
  assert.deepEqual(resolveLiveEventSender({
    type: 'text.delta',
    payload: { agent: { id: 'east', name: 'East' }, text: 'Hello' },
  }, { agents }), {
    type: 'agent',
    id: 'east',
    name: 'East',
    agentId: 'east',
    color: '#84cc16',
  });
});

test('canonical human participant prefers current user display name', () => {
  assert.deepEqual(resolveCanonicalParticipantSender(participant({
    id: 'participant-user',
    externalId: 'usr-alice',
    participantType: 'human',
    name: 'Stored name',
    agentId: undefined,
  }), { user: { id: 'usr-alice', name: 'Alice' } }), {
    type: 'user',
    id: 'usr-alice',
    externalId: 'usr-alice',
    name: 'Alice',
    participantId: 'participant-user',
  });
});
