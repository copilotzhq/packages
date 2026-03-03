import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import type { ChatConfig } from "../types/chatTypes"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const formatDate = (timestamp: number, labels?: ChatConfig['labels']) => {
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
      month: 'short',
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

    const blob = new Blob([bytes], { type: mimeType || 'application/octet-stream' });
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
};
