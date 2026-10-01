import test from 'node:test';
import assert from 'node:assert/strict';
import type { CoreClient } from '@copilotz/copilotz/core/client';
import { uploadAttachments } from '../src/attachments.ts';

test('generic files publish exact Blob bytes and reuse their upload identity', async () => {
  const raw = new Uint8Array([0, 255, 128, 13, 10]);
  const signal = new AbortController().signal;
  const requests: Array<{
    body: Blob;
    idempotencyKey: string;
    mediaType?: string;
    filename?: string;
    signal?: AbortSignal;
  }> = [];
  const source = new Blob([raw], { type: 'text/x-tex' });
  const assets = {
    upload: async (
      body: Blob,
      options: {
        idempotencyKey: string;
        signal: AbortSignal;
        mediaType?: string;
        filename?: string;
      }
    ) => {
      assert.deepEqual(new Uint8Array(await body.arrayBuffer()), raw);
      requests.push({ body, ...options });
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
    source,
    dataUrl: 'blob:preview-only',
    uploadId: 'upload-stable',
    mimeType: 'text/x-tex',
    fileName: 'notes.tex',
  };
  const refs = await uploadAttachments(assets, [attachment], {
    idempotencyKey: 'send-one',
    signal,
  });
  await uploadAttachments(assets, [attachment], {
    idempotencyKey: 'send-retry',
    signal,
  });
  assert.deepEqual(
    requests.map(({ idempotencyKey, mediaType, filename, signal: requestSignal }) => ({
      idempotencyKey,
      mediaType,
      filename,
      signal: requestSignal,
    })),
    [
      { idempotencyKey: 'upload-stable', mediaType: 'text/x-tex', filename: 'notes.tex', signal },
      { idempotencyKey: 'upload-stable', mediaType: 'text/x-tex', filename: 'notes.tex', signal },
    ]
  );
  assert.notEqual(requests[0].body, source);
  assert.notEqual(requests[1].body, source);
  assert.notEqual(requests[0].body, requests[1].body);
  assert.equal(requests[0].body.type, 'text/x-tex');
  assert.equal(JSON.stringify(refs).includes('blob:'), false);
  assert.equal(JSON.stringify(refs).includes('source'), false);
});

test('unreadable local files give a filename-aware recovery message without uploading', async () => {
  const source = new Blob(['placeholder']);
  const readError = new DOMException('The I/O read operation failed.', 'NotReadableError');
  Object.defineProperty(source, 'arrayBuffer', {
    value: async () => {
      throw readError;
    },
  });
  let uploads = 0;
  const assets = {
    upload: async () => {
      uploads++;
      return { data: { content: { assetId: 'unexpected' } } };
    },
  } as unknown as CoreClient['assets'];

  await assert.rejects(
    uploadAttachments(
      assets,
      [{
        kind: 'file',
        source,
        dataUrl: 'blob:preview-only',
        fileName: 'drive-not-synced.tex',
        mimeType: 'text/x-tex',
      }],
      { idempotencyKey: 'send', signal: new AbortController().signal }
    ),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /drive-not-synced\.tex/);
      assert.match(error.message, /download.*available offline.*attach it again/i);
      assert.equal(error.cause, readError);
      return true;
    }
  );
  assert.equal(uploads, 0);
});

test('abort during local file materialization preserves the abort reason and skips upload', async () => {
  let resolveRead!: (bytes: ArrayBuffer) => void;
  let signalReadStarted!: () => void;
  const readStarted = new Promise<void>((resolve) => {
    signalReadStarted = resolve;
  });
  const source = new Blob(['placeholder']);
  Object.defineProperty(source, 'arrayBuffer', {
    value: () => {
      signalReadStarted();
      return new Promise<ArrayBuffer>((resolve) => {
        resolveRead = resolve;
      });
    },
  });
  const controller = new AbortController();
  const abortReason = new Error('stop requested');
  let uploads = 0;
  const assets = {
    upload: async () => {
      uploads++;
      return { data: { content: { assetId: 'unexpected' } } };
    },
  } as unknown as CoreClient['assets'];
  const uploading = uploadAttachments(
    assets,
    [{
      kind: 'file',
      source,
      dataUrl: 'blob:preview-only',
      fileName: 'pending.tex',
      mimeType: 'text/x-tex',
    }],
    { idempotencyKey: 'send', signal: controller.signal }
  );

  await readStarted;
  controller.abort(abortReason);
  resolveRead(new ArrayBuffer(10));
  await assert.rejects(uploading, (error: unknown) => error === abortReason);
  assert.equal(uploads, 0);
});

test('asset transport failures are propagated without local-file recovery wording', async () => {
  const transportError = new TypeError('Network connection lost');
  const assets = {
    upload: async () => {
      throw transportError;
    },
  } as unknown as CoreClient['assets'];

  await assert.rejects(
    uploadAttachments(
      assets,
      [{
        kind: 'file',
        source: new Blob(['available bytes']),
        dataUrl: 'blob:preview-only',
        fileName: 'available.tex',
        mimeType: 'text/x-tex',
      }],
      { idempotencyKey: 'send', signal: new AbortController().signal }
    ),
    (error: unknown) => {
      assert.equal(error, transportError);
      assert.doesNotMatch(String(error), /download|available offline/i);
      return true;
    }
  );
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
  assert.equal(calls, 0);
});

test('supported image is sent inline without asset upload', async () => {
  const assets = { upload: async () => { throw new Error('unexpected upload'); } } as unknown as CoreClient['assets'];
  const content = await uploadAttachments(assets, [{ kind: 'image', mimeType: 'image/jpeg', fileName: 'photo.jpg', dataUrl: 'data:image/jpeg;base64,AQID' }], { idempotencyKey: 'image', signal: new AbortController().signal });
  assert.deepEqual(content, [{ type: 'image', bytes: new Uint8Array([1, 2, 3]), mediaType: 'image/jpeg', role: 'attachment', disposition: 'inline', name: 'photo.jpg' }]);
});
