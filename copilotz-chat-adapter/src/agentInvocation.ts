import type { ChatMessage } from '@copilotz/chat-ui';
import { finalizeAssistantMessage } from './activity.ts';
import { getCanonicalLlmAttemptId } from './messageReconciliation.ts';

/** Model preparation belongs to one invocation, never to its whole operation. */
export function projectAgentInvocation(
  messages: ChatMessage[],
  type: string,
  operationId: string,
  data: Record<string, unknown>,
  at: number
): ChatMessage[] {
  const run = data.actionRunId;
  if (typeof run !== 'string') return messages;
  const matches = (message: ChatMessage) =>
    (getCanonicalLlmAttemptId(message) ?? message.metadata?.llmAttemptId) ===
    run;
  if (type === 'llm.call.completed') {
    return messages.flatMap((message) => {
      if (!matches(message)) return [message];
      const completed = finalizeAssistantMessage(message, undefined, at);
      return !completed.content &&
        !completed.attachments?.length &&
        !completed.activity?.items.length
        ? []
        : [completed];
    });
  }
  if (type !== 'llm.call.invoked' || messages.some(matches)) return messages;
  const metadata = data.metadata as Record<string, unknown> | undefined;
  if (
    metadata?.schema !== 'copilotz.core.llm-call.v1' ||
    typeof metadata.agentId !== 'string'
  )
    return messages;
  return [
    ...messages,
    {
      id: `live:${operationId}:${run}`,
      role: 'assistant',
      content: '',
      timestamp: at,
      isStreaming: true,
      sender: {
        type: 'agent',
        id: metadata.agentId,
        agentId: metadata.agentId,
        name: metadata.agentId
      },
      metadata: { operationId, llmAttemptId: run },
      activity: {
        items: [
          {
            id: `${run}:preparing`,
            kind: 'answering',
            status: 'active',
            startedAt: at
          }
        ]
      }
    }
  ];
}
