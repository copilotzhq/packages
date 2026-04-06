import { ChatMessage, ChatThread, MediaAttachment, AgentOption } from '../types/chatTypes';

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

// ============================================================================
// Multi-agent color/display utilities
// ============================================================================

const AGENT_COLORS = [
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#f59e0b', // amber
  '#10b981', // emerald
  '#3b82f6', // blue
  '#ef4444', // red
  '#14b8a6', // teal
  '#f97316', // orange
  '#84cc16', // lime
];

/** Deterministic color for an agent based on its ID. */
export function getAgentColor(agentId: string): string {
  let hash = 0;
  for (let i = 0; i < agentId.length; i++) {
    hash = ((hash << 5) - hash + agentId.charCodeAt(i)) | 0;
  }
  return AGENT_COLORS[Math.abs(hash) % AGENT_COLORS.length];
}

/** Up to 2-letter initials from an agent name. */
export function getAgentInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

/** Assign colors to agents that don't have a custom color. Returns a new array. */
export function assignAgentColors(agents: AgentOption[]): (AgentOption & { color: string })[] {
  return agents.map((agent) => ({
    ...agent,
    color: agent.color || getAgentColor(agent.id),
  }));
}

