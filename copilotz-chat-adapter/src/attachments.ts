import type { CoreClient } from '@copilotz/copilotz/core/client';
import type { ContentInput } from '@copilotz/copilotz/content';
import type { MediaAttachment } from '@copilotz/chat-ui';

function unreadableAttachmentError(
  attachment: MediaAttachment,
  cause: unknown
): Error {
  const label = attachment.fileName
    ? `“${attachment.fileName}”`
    : 'the attached file';
  return new Error(
    `Could not read ${label} from local storage. Download it or make it available offline, then attach it again.`,
    { cause }
  );
}

async function materializeLocalBlob(
  body: Blob,
  attachment: MediaAttachment,
  signal: AbortSignal
): Promise<Blob> {
  signal.throwIfAborted();
  let bytes: ArrayBuffer;
  try {
    bytes = await body.arrayBuffer();
    signal.throwIfAborted();
  } catch (error) {
    signal.throwIfAborted();
    if (
      typeof error === 'object' &&
      error !== null &&
      'name' in error &&
      error.name === 'AbortError'
    ) {
      throw error;
    }
    throw unreadableAttachmentError(attachment, error);
  }
  return new Blob([bytes], { type: attachment.mimeType || body.type });
}

/** Sends supported images inline; uploads other browser-local bodies as references. */
export async function uploadAttachments(
  assets: CoreClient['assets'],
  attachments: readonly MediaAttachment[],
  options: { idempotencyKey: string; signal: AbortSignal }
): Promise<ContentInput[]> {
  const refs: ContentInput[] = [];
  for (const [index, attachment] of attachments.entries()) {
    options.signal.throwIfAborted();
    let body: Blob;
    let localFileBody = false;
    if (attachment.kind === 'file' && attachment.source instanceof Blob) {
      body = attachment.source;
      localFileBody = true;
    } else {
      const comma = attachment.dataUrl.indexOf(',');
      if (
        comma < 0 ||
        !attachment.dataUrl.slice(0, comma).startsWith('data:') ||
        !attachment.dataUrl.slice(0, comma).endsWith(';base64')
      ) {
        throw new Error('Attachment requires a local Blob or base64 data.');
      }
      const bytes = Uint8Array.from(
        atob(attachment.dataUrl.slice(comma + 1)),
        (value) => value.charCodeAt(0)
      );
      body = new Blob([bytes], { type: attachment.mimeType });
    }
    if (attachment.kind === 'image' && /^image\/(?:png|jpeg|webp|gif)$/.test(attachment.mimeType)) {
      options.signal.throwIfAborted();
      refs.push({
        type: 'image',
        bytes: new Uint8Array(await body.arrayBuffer()),
        mediaType: attachment.mimeType,
        role: 'attachment',
        disposition: 'inline',
        ...(attachment.fileName ? { name: attachment.fileName } : {})
      });
      options.signal.throwIfAborted();
      continue;
    }
    // Snapshot picker-backed Files before fetch so the request owns replayable
    // bytes even when the browser's file provider only offers an on-demand stream.
    if (localFileBody) {
      body = await materializeLocalBlob(body, attachment, options.signal);
    }
    options.signal.throwIfAborted();
    const uploaded = (await assets.upload(body, {
      mediaType: attachment.mimeType,
      filename: attachment.fileName,
      signal: options.signal,
      idempotencyKey:
        attachment.kind === 'file' && attachment.uploadId
          ? attachment.uploadId
          : `${options.idempotencyKey}:asset:${index}`
    })) as { data: { content: ContentInput } };
    refs.push(uploaded.data.content);
  }
  return refs;
}
