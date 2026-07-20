import test from 'node:test';
import assert from 'node:assert/strict';
import { isSameThreadIdentity } from '../src/threadIdentity.ts';

test('optimistic and persisted thread identities match through external id', () => {
  assert.equal(isSameThreadIdentity(
    { id: 'optimistic-id', externalId: 'optimistic-id' },
    { id: 'persisted-id', externalId: 'optimistic-id' },
  ), true);
});

test('a stream does not own a genuinely different selected thread', () => {
  assert.equal(isSameThreadIdentity(
    { id: 'thread-1', externalId: 'external-1' },
    { id: 'thread-2', externalId: 'external-2' },
  ), false);
});

test('an unbound stream retains the legacy visible-thread behavior', () => {
  assert.equal(isSameThreadIdentity(
    {},
    { id: 'thread-1', externalId: 'external-1' },
  ), true);
});
