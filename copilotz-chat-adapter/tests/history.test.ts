import test from 'node:test';
import assert from 'node:assert/strict';
import type { ConversationMessage } from '@copilotz/copilotz/core/client';
import { createHistoryReader } from '../src/history.ts';
const message = {
  id: 'message',
  threadId: 'thread',
  namespace: 'tenant',
  content: [
    { assetId: 'asset', kind: 'text', role: 'body', mediaType: 'text/plain' }
  ],
  metadata: {},
  sender: {
    id: 'owner',
    externalId: 'owner',
    participantType: 'human',
    name: 'Owner',
    metadata: {}
  },
  recipientIds: [],
  createdAt: '2026-09-04T00:00:00Z',
  updatedAt: '2026-09-04T00:00:00Z'
} as ConversationMessage;
test('history projects resolved values without network access', async () => {
  const history = createHistoryReader();
  const page = {
    data: [
      { ...message, content: [{ ...message.content[0], value: 'Hello 🌎' }] }
    ],
    pageInfo: { hasMore: false }
  };
  const projected = await history.project(page, {});
  assert.equal(projected.viewMessages[0].content, 'Hello 🌎');
  const abort = new AbortController();
  abort.abort();
  await assert.rejects(
    history.project(page, { signal: abort.signal }),
    /abort/i
  );
});

import { canonicalHistory } from './history.fixture.ts';
import { mergePersistedToolResults } from '../src/toolActivity.ts';
test('paginated history remembers a tool result until its source plan is loaded', async () => {
  const fixture = canonicalHistory();
  const history = createHistoryReader();
  for (const message of fixture.data) {
    if (Array.isArray(message.metadata.llmReasoning))
      message.metadata.llmReasoning = message.metadata.llmReasoning.map(
        (ref) => ({
          ...ref,
          value: fixture.included.content.find(
            (entry) => entry.ref.assetId === ref.assetId
          )!.value
        })
      );
    message.content = message.content.map((ref) => ({
      ...ref,
      value: fixture.included.content.find(
        (entry) => entry.ref.assetId === ref.assetId
      )!.value
    }));
  }
  const newest = await history.project(
    {
      data: [fixture.data[2] as ConversationMessage],
      pageInfo: { hasMore: true }
    },
    {}
  );
  assert.equal(newest.toolResultUpdates.length, 1);
  const older = await history.project(
    {
      data: [fixture.data[1] as ConversationMessage],
      pageInfo: { hasMore: false }
    },
    {}
  );
  const merged = mergePersistedToolResults(
    older.viewMessages,
    older.toolResultUpdates
  );
  assert.equal(
    merged[0].activity?.items.find((item) => item.kind === 'tool')?.status,
    'failed'
  );
  history.clear();
  const clean = await history.project(
    { data: [], pageInfo: { hasMore: false } },
    {}
  );
  assert.equal(clean.toolResultUpdates.length, 0);
});

test('unresolved history fails explicitly instead of fetching assets', async () => {
  const history = createHistoryReader();
  await assert.rejects(
    history.project({ data: [message], pageInfo: { hasMore: false } }, {}),
    /requires resolved content/
  );
});
