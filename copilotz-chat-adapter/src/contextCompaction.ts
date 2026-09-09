import type { ChatMessage } from '@copilotz/chat-ui';

/** Only the foreground wait is public activity; maintenance turns stay private. */
export function projectContextCompaction(
  messages: ChatMessage[],
  type: string,
  operationId: string,
  data: Record<string, unknown>,
  at: number
): ChatMessage[] {
  if (!type.startsWith('copilotz.core.context.compact.')) return messages;
  const metadata = data.metadata as Record<string, unknown> | undefined;
  const run = data.actionRunId;
  if (metadata?.schema !== 'copilotz.core.context-compaction.v1' ||
      typeof metadata.agentId !== 'string' || typeof run !== 'string') return messages;
  const id = `activity:${operationId}:${run}`;
  if (type.endsWith('.completed') || type.endsWith('.cancelled')) {
    return messages.filter(message => message.id !== id);
  }
  if (type.endsWith('.failed')) {
    return messages.map(message => message.id !== id ? message : {
      ...message,
      isStreaming: false,
      isComplete: true,
      content: 'Conversation memory could not be consolidated. Please try again.',
      activity: undefined
    });
  }
  if (!type.endsWith('.invoked') || messages.some(message => message.id === id)) return messages;
  return [...messages, {
    id, role: 'assistant', content: '', timestamp: at, isStreaming: true,
    sender: { type: 'agent', id: metadata.agentId, agentId: metadata.agentId,
      name: typeof metadata.agentName === 'string' ? metadata.agentName : metadata.agentId },
    metadata: { operationId, contextCompactionRunId: run },
    activity: { items: [{ id: `${run}:compacting`, kind: 'compacting', status: 'active', startedAt: at }] }
  }];
}
