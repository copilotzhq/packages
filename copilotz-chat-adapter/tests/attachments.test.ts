import test from 'node:test';
import assert from 'node:assert/strict';
import type { CoreClient } from '@copilotz/copilotz/core/client';
import { uploadAttachments } from '../src/attachments.ts';

test('generic files publish exact Blob bytes and reuse their upload identity', async () => {
  const raw = new Uint8Array([0, 255, 128, 13, 10]);
  const signal = new AbortController().signal;
  const requests: string[] = [];
  const assets = {
    upload: async (
      body: Blob,
      options: { idempotencyKey: string; signal: AbortSignal }
    ) => {
      assert.deepEqual(new Uint8Array(await body.arrayBuffer()), raw);
      assert.equal(options.signal, signal);
      requests.push(options.idempotencyKey);
      return {
        data: {
          content: {
            assetId: 'retained',
            mediaType: 'application/octet-stream',
            kind: 'file',
            role: 'attachment',
          },
        },
      };
    },
  } as unknown as CoreClient['assets'];
  const attachment = {
    kind: 'file' as const,
    source: new Blob([raw]),
    dataUrl: 'blob:preview-only',
    uploadId: 'upload-stable',
    mimeType: 'application/octet-stream',
  };
  const refs = await uploadAttachments(assets, [attachment], {
    idempotencyKey: 'send-one',
    signal,
  });
  await uploadAttachments(assets, [attachment], {
    idempotencyKey: 'send-retry',
    signal,
  });
  assert.deepEqual(requests, ['upload-stable', 'upload-stable']);
  assert.equal(JSON.stringify(refs).includes('blob:'), false);
  assert.equal(JSON.stringify(refs).includes('source'), false);
});

test('base64 media uses raw upload bytes and remote URLs never become authenticated fetches', async () => {
  let calls = 0;
  const assets = {
    upload: async (body: Blob) => {
      calls++;
      assert.deepEqual(
        new Uint8Array(await body.arrayBuffer()),
        new Uint8Array([1, 2, 3])
      );
      return { data: { content: { assetId: 'image' } } };
    },
  } as unknown as CoreClient['assets'];
  const signal = new AbortController().signal;
  await uploadAttachments(
    assets,
    [
      {
        kind: 'image',
        mimeType: 'image/png',
        dataUrl: 'data:image/png;base64,AQID',
      },
    ],
    { idempotencyKey: 'send', signal }
  );
  await assert.rejects(
    uploadAttachments(
      assets,
      [
        {
          kind: 'image',
          mimeType: 'image/png',
          dataUrl: 'https://outside.invalid/image',
        },
      ],
      { idempotencyKey: 'send', signal }
    ),
    /local Blob/
  );
  assert.equal(calls, 1);
});
