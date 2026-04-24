import type { ChatMessage, ToolCall } from '@copilotz/chat-ui';

export interface InternalChatMessage extends ChatMessage {
  _activityReasoning?: string;
  _activityReasoningStreaming?: boolean;
  _activityToolCalls?: ToolCall[];
}

type MessageActivity = NonNullable<ChatMessage['activity']>;

const isToolCallActive = (toolCall: ToolCall): boolean => (
  toolCall.status === 'pending' || toolCall.status === 'running'
);

export const hasVisibleAssistantOutput = (message: InternalChatMessage): boolean => {
  if (message.role !== 'assistant') return false;
  if (typeof message.content === 'string' && message.content.trim().length > 0) return true;
  if (Array.isArray(message.attachments) && message.attachments.length > 0) return true;
  if (Array.isArray(message._activityToolCalls) && message._activityToolCalls.length > 0) return true;
  return false;
};

export const buildAssistantActivity = (
  message: Pick<InternalChatMessage, 'content' | 'isStreaming' | '_activityReasoning' | '_activityReasoningStreaming' | '_activityToolCalls'>,
): MessageActivity | undefined => {
  const toolCalls = Array.isArray(message._activityToolCalls) ? message._activityToolCalls : [];
  const hasReasoning = typeof message._activityReasoning === 'string' && message._activityReasoning.length > 0;
  const hasToolCalls = toolCalls.length > 0;
  const runningTools = toolCalls.filter(isToolCallActive);
  const hasRunningTools = runningTools.length > 0;
  const isStreaming = message.isStreaming === true;
  const isReasoningStreaming = message._activityReasoningStreaming === true;
  const hasContent = typeof message.content === 'string' && message.content.trim().length > 0;

  if (!hasReasoning && !hasToolCalls && !isStreaming && !isReasoningStreaming) {
    return undefined;
  }

  const isActive = isStreaming || isReasoningStreaming || hasRunningTools;
  const summary = hasRunningTools
    ? {
        kind: 'using_tools' as const,
        ...(runningTools.length === 1 ? { toolName: runningTools[0].name } : {}),
        ...(runningTools.length > 1 ? { toolCount: runningTools.length } : {}),
      }
    : isStreaming && hasToolCalls && !hasContent
      ? {
          kind: 'using_tools' as const,
          ...(toolCalls.length === 1 ? { toolName: toolCalls[0].name } : {}),
          ...(toolCalls.length > 1 ? { toolCount: toolCalls.length } : {}),
        }
      : isReasoningStreaming || (!hasContent && hasReasoning)
        ? { kind: 'thinking' as const }
        : isStreaming && hasContent
          ? { kind: 'preparing_answer' as const }
          : isStreaming
            ? { kind: 'working' as const }
            : hasToolCalls
              ? {
                  kind: 'using_tools' as const,
                  ...(toolCalls.length === 1 ? { toolName: toolCalls[0].name } : {}),
                  ...(toolCalls.length > 1 ? { toolCount: toolCalls.length } : {}),
                }
              : { kind: 'thinking' as const };

  return {
    isActive,
    ...(isActive ? {} : { isComplete: true }),
    summary,
    ...(hasReasoning ? { reasoning: message._activityReasoning } : {}),
    ...(hasToolCalls ? { toolCalls } : {}),
  };
};

export const syncAssistantActivity = <T extends InternalChatMessage>(message: T): T => {
  if (message.role !== 'assistant') {
    const { _activityReasoning, _activityReasoningStreaming, _activityToolCalls, ...rest } = message;
    return rest as T;
  }

  return {
    ...message,
    activity: buildAssistantActivity(message),
  };
};

export const toPublicChatMessage = (message: InternalChatMessage): ChatMessage => {
  const { _activityReasoning, _activityReasoningStreaming, _activityToolCalls, ...rest } = syncAssistantActivity(message);
  return rest;
};

export const updateAssistantMessageToken = (
  message: InternalChatMessage,
  params: {
    partial: string;
    isReasoning?: boolean;
    agentIdentity?: { senderAgentId?: string; senderName?: string };
  },
): InternalChatMessage => {
  if (message.role !== 'assistant') return message;
  const next = params.isReasoning
    ? {
        ...message,
        ...params.agentIdentity,
        _activityReasoning: params.partial,
        _activityReasoningStreaming: true,
        isStreaming: true,
        isComplete: false,
      }
    : {
        ...message,
        ...params.agentIdentity,
        content: params.partial,
        _activityReasoningStreaming: false,
        isStreaming: true,
        isComplete: false,
      };

  return syncAssistantActivity(next);
};

export const appendAssistantToolCall = (
  message: InternalChatMessage,
  toolCall: ToolCall,
): InternalChatMessage => {
  if (message.role !== 'assistant') return message;
  return syncAssistantActivity({
    ...message,
    _activityToolCalls: [
      ...(Array.isArray(message._activityToolCalls) ? message._activityToolCalls : []),
      toolCall,
    ],
    isStreaming: true,
    isComplete: false,
  });
};

export const applyAssistantToolResult = (
  message: InternalChatMessage,
  update: Partial<ToolCall> & Pick<ToolCall, 'name' | 'status'> & { id?: string },
): InternalChatMessage => {
  if (message.role !== 'assistant') return message;
  const toolCalls = Array.isArray(message._activityToolCalls) ? message._activityToolCalls : [];
  const nextToolCalls = toolCalls.map((toolCall) => {
    const matchesById = update.id && toolCall.id === update.id;
    const matchesByName = !update.id && toolCall.name === update.name;
    if (!matchesById && !matchesByName) return toolCall;

    return {
      ...toolCall,
      ...update,
    };
  });

  return syncAssistantActivity({
    ...message,
    _activityToolCalls: nextToolCalls,
  });
};

export const finalizeAssistantMessage = (
  message: InternalChatMessage,
  finalAnswer?: string,
): InternalChatMessage => {
  if (message.role !== 'assistant') return message;
  return syncAssistantActivity({
    ...message,
    ...(typeof finalAnswer === 'string' && finalAnswer.length > 0 ? { content: finalAnswer } : {}),
    isStreaming: false,
    isComplete: true,
    _activityReasoningStreaming: false,
  });
};

export const closeAssistantMessage = (
  message: InternalChatMessage,
): InternalChatMessage => {
  if (message.role !== 'assistant') return message;
  return syncAssistantActivity({
    ...message,
    isStreaming: false,
    isComplete: true,
    _activityReasoningStreaming: false,
  });
};
