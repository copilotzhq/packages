import test from 'node:test';
import assert from 'node:assert/strict';
import { selectAcceptedOperationFeedCursor } from '../src/feedBootstrap.ts';

test('a sole newly accepted operation starts from its receipt cursor', () => {
  assert.equal(
    selectAcceptedOperationFeedCursor({
      activeOperationIds: ['operation-new'],
      acceptedOperationId: 'operation-new',
      currentCursor: 'stale-history-cursor',
      receiptCursor: 'accepted-operation-cursor',
    }),
    'accepted-operation-cursor',
  );
});

test('parallel operations preserve the current compound feed cursor', () => {
  assert.equal(
    selectAcceptedOperationFeedCursor({
      activeOperationIds: ['operation-existing', 'operation-new'],
      acceptedOperationId: 'operation-new',
      currentCursor: 'compound-feed-cursor',
      receiptCursor: 'new-operation-only-cursor',
    }),
    'compound-feed-cursor',
  );
});

test('parallel operations fall back to the receipt when no feed cursor exists', () => {
  assert.equal(
    selectAcceptedOperationFeedCursor({
      activeOperationIds: ['operation-existing', 'operation-new'],
      acceptedOperationId: 'operation-new',
      currentCursor: null,
      receiptCursor: 'new-operation-only-cursor',
    }),
    'new-operation-only-cursor',
  );
});
