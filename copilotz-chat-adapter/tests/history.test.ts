import test from 'node:test';
import assert from 'node:assert/strict';
import type {
  CoreClient,
  ConversationMessage,
} from '@copilotz/copilotz/core/client';
import { createHistoryReader } from '../src/history.ts';
const message = {
  id: 'message',
  threadId: 'thread',
  namespace: 'tenant',
  content: [
    { assetId: 'asset', kind: 'text', role: 'body', mediaType: 'text/plain' },
  ],
  metadata: {},
  sender: {
    id: 'owner',
    externalId: 'owner',
    participantType: 'human',
    name: 'Owner',
    metadata: {},
  },
  recipientIds: [],
  createdAt: '2026-09-04T00:00:00Z',
  updatedAt: '2026-09-04T00:00:00Z',
} as ConversationMessage;
test('history resolves raw retained Assets once and propagates authorization failures', async () => {
  let reads = 0;
  let fail = false;
  const signal = new AbortController().signal;
  const history = createHistoryReader({
    assets: {
      get: async (id: string, options: { signal: AbortSignal }) => {
        assert.equal(id, 'asset');
        assert.equal(options.signal, signal);
        reads++;
        if (fail) throw new Error('asset forbidden');
        return new Response('Hello 🌎', {
          headers: { 'content-type': 'text/plain' },
        });
      },
    },
  } as unknown as CoreClient);
  const page = { data: [message], pageInfo: { hasMore: false } };
  const projected = await history.project(page, { signal });
  assert.equal(projected.viewMessages[0].content, 'Hello 🌎');
  await history.project(page, { signal });
  assert.equal(reads, 1);
  history.clear();
  fail = true;
  await assert.rejects(history.project(page, { signal }), /forbidden/);
  fail = false;
  await history.project(page, { signal });
  assert.equal(reads, 3);
});

import { canonicalHistory } from './history.fixture.ts';
import { mergePersistedToolResults } from '../src/toolActivity.ts';
test('paginated history remembers a tool result until its source plan is loaded', async () => {
  const fixture = canonicalHistory();
  const history = createHistoryReader({
    assets: {
      get: async (id: string) => {
        const value = fixture.included.content.find(
          (value) => value.ref.assetId === id
        )!;
        return new Response(Buffer.from(value.base64, 'base64'), {
          headers: { 'content-type': value.asset.mediaType },
        });
      },
    },
  } as unknown as CoreClient);
  const newest = await history.project(
    {
      data: [fixture.data[2] as ConversationMessage],
      pageInfo: { hasMore: true },
    },
    {}
  );
  assert.equal(newest.toolResultUpdates.length, 1);
  const older = await history.project(
    {
      data: [fixture.data[1] as ConversationMessage],
      pageInfo: { hasMore: false },
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
