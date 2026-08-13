import test from 'node:test';
import assert from 'node:assert/strict';
import { getAssetDataUrl } from '../src/assetsService.ts';

test('getAssetDataUrl consumes the canonical asset document', async () => {
  const previousFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    data: {
      asset: {
        id: 'asset-1',
        namespace: 'tenant-a',
        mediaType: 'image/png',
        byteLength: 3,
        digest: `sha256:${'0'.repeat(64)}`,
        state: 'ready',
        location: { kind: 'database', encoding: 'base64' },
        createdAt: '2026-08-13T10:00:00.000Z',
      },
      dataUrl: 'data:image/png;base64,AQID',
    },
  }), { status: 200, headers: { 'content-type': 'application/json' } });

  try {
    assert.deepEqual(await getAssetDataUrl('asset://asset-1'), {
      assetId: 'asset-1',
      mime: 'image/png',
      dataUrl: 'data:image/png;base64,AQID',
    });
  } finally {
    globalThis.fetch = previousFetch;
  }
});
