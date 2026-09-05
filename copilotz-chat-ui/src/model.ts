import type { MediaAttachmentKind } from './types/chatTypes';
export type * from './types/chatTypes';

export const getAttachmentKindFromMimeType = (
  mimeType?: string | null
): MediaAttachmentKind => {
  const normalized = (mimeType || '').toLowerCase();
  if (normalized.startsWith('image/')) return 'image';
  if (normalized.startsWith('audio/')) return 'audio';
  if (normalized.startsWith('video/')) return 'video';
  return 'file';
};

export const getMimeTypeFromDataUrl = (dataUrl: string): string | null => {
  const match = dataUrl.match(/^data:([^;,]+)[;,]/);
  return match?.[1] || null;
};
