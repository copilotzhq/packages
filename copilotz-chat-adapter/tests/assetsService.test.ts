import test from 'node:test';
import assert from 'node:assert/strict';
import { getAssetDataUrl } from '../src/assetsService.ts';

test('getAssetDataUrl consumes the canonical asset document', async () => {
  const previousFetch = globalThis.fetch;
  let requestedUrl = '';
  globalThis.fetch = async (input) => {
    requestedUrl = String(input);
    return new Response(JSON.stringify({
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
  };

  try {
    assert.deepEqual(await getAssetDataUrl('asset://tenant-a/asset%2F1'), {
      assetId: 'asset-1',
      mime: 'image/png',
      dataUrl: 'data:image/png;base64,AQID',
    });
    assert.equal(
      new URL(requestedUrl, 'https://example.test').pathname,
      '/api/v1/assets/asset%2F1',
    );
  } finally {
    globalThis.fetch = previousFetch;
  }
});
