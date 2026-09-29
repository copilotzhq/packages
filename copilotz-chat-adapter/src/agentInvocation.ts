import type { ChatMessage } from '@copilotz/chat-ui';
import { finalizeAssistantMessage } from './activity.ts';
import { getCanonicalLlmAttemptId } from './messageReconciliation.ts';
import { resolveAgentSender, type SenderResolutionOptions } from './senders.ts';

/** Model preparation belongs to one invocation, never to its whole operation. */
export function projectAgentInvocation(
  messages: ChatMessage[],
  type: string,
  operationId: string,
  data: Record<string, unknown>,
  at: number,
  senderOptions: SenderResolutionOptions = {}
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
  const agentId = metadata.agentId;

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
            // The agent's configured presentation (name, avatar, color) wins,
            // exactly as it does for the finished message.
            sender: resolveAgentSender(
              {
                id: agentId,
                name:
                  message.sender?.agentId === agentId && message.sender.name
                    ? message.sender.name
                    : agentId
              },
              senderOptions
            ),
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
      sender: resolveAgentSender({ id: agentId, name: agentId }, senderOptions),
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
