import { ChatMessage, ChatThread, MediaAttachment } from '../types/chatTypes';

export const chatUtils = {
  generateId: (): string => 
    (globalThis.crypto?.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`),

  generateMessageId: (): string => chatUtils.generateId(),
  generateThreadId: (): string => chatUtils.generateId(),
  
  createMessage: (
    role: 'user' | 'assistant' | 'system',
    content: string,
    attachments?: MediaAttachment[]
  ): ChatMessage => ({
    id: chatUtils.generateMessageId(),
    role,
    content,
    timestamp: Date.now(),
    attachments,
    isComplete: true,
  }),

  createThread: (title: string): ChatThread => ({
    id: chatUtils.generateThreadId(),
    title,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messageCount: 0,
  }),

  generateThreadTitle: (firstMessage: string): string => {
    const cleaned = firstMessage.replace(/[^\w\s]/g, '').trim();
    const words = cleaned.split(/\s+/).slice(0, 6);
    return words.join(' ') || 'Nova Conversa';
  },
};

