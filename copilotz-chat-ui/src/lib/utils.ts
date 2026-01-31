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
