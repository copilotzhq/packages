import type { CoreClient } from '@copilotz/copilotz/core/client';
import type { ContentInput } from '@copilotz/copilotz/content';
import type { MediaAttachment } from '@copilotz/chat-ui';

/** Publishes browser-local bodies; executable input contains only canonical references. */
export async function uploadAttachments(
  assets: CoreClient['assets'],
  attachments: readonly MediaAttachment[],
  options: { idempotencyKey: string; signal: AbortSignal }
): Promise<ContentInput[]> {
  const refs: ContentInput[] = [];
  for (const [index, attachment] of attachments.entries()) {
    let body: Blob;
    if (attachment.kind === 'file' && attachment.source instanceof Blob) {
      body = attachment.source;
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
