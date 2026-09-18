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

  // A send may have already rendered a preparation entry before the
  // operation receipt arrived. Keep that entry as the presentation identity
  // for the whole attempt and enrich it in place when invocation is observed.
  const preparationIndex = messages.findIndex(
    (message) =>
      message.role === 'assistant' &&
      message.isStreaming === true &&
      message.metadata?.operationId === operationId &&
      !getCanonicalLlmAttemptId(message) &&
      typeof message.metadata?.llmAttemptId !== 'string' &&
      typeof message.metadata?.contextCompactionRunId !== 'string'
  );
  if (preparationIndex !== -1) {
    return messages.map((message, index) =>
      index === preparationIndex
        ? {
            ...message,
            sender: {
              type: 'agent',
              id: metadata.agentId as string,
              agentId: metadata.agentId as string,
              name:
                message.sender?.agentId === metadata.agentId &&
                  message.sender.name
                  ? message.sender.name
                  : metadata.agentId as string
            },
            metadata: {
              ...(message.metadata ?? {}),
              operationId,
              llmAttemptId: run
            }
          }
        : message
    );
  }

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
