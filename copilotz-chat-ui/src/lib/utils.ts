import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { ChatConfig } from '../types/chatTypes';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const formatDate = (
  timestamp: number,
  labels?: ChatConfig['labels']
) => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return labels?.today || 'Today';
  } else if (diffDays === 1) {
    return labels?.yesterday || 'Yesterday';
  } else if (diffDays < 7) {
    return `${diffDays} ${labels?.daysAgo || 'days ago'}`;
  } else {
    return date.toLocaleDateString('en-US', {
      day: '2-digit',
      month: 'short'
    });
  }
};

export const createObjectUrlFromDataUrl = (dataUrl: string): string | null => {
  const match = dataUrl.match(/^data:(.+?);base64,(.+)$/s);
  if (!match) {
    return null;
  }

  try {
    const [, mimeType, base64] = match;
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);

    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }

    const blob = new Blob([bytes], {
      type: mimeType || 'application/octet-stream'
    });
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
};

export const formatFileSize = (bytes?: number): string => {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes < 0)
    return '';
  if (bytes < 1024) return `${bytes} B`;

  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)} ${
    units[unitIndex]
  }`;
};

export {
  getAttachmentKindFromMimeType,
  getMimeTypeFromDataUrl
} from '../model';
