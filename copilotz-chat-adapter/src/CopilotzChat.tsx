import React, { useMemo, useState, useCallback } from 'react';
import { ChatUI, ChatUserContextProvider } from '@copilotz/chat-ui';
import type { AgentOption, ChatConfig, ChatCallbacks, ChatUserContext, MemoryItem } from '@copilotz/chat-ui';
import { User } from 'lucide-react';
import { useCopilotz } from './useCopilotzChat';
import type { EventInterceptor, RenderSpecialState, RunErrorInterceptor } from './specialState';
import type { RequestHeadersProvider } from './copilotzService';

export interface CopilotzChatProps {
  userId: string;
  userName?: string;
  userAvatar?: string;
  userEmail?: string;
  initialContext?: ChatUserContext;
  bootstrap?: {
    initialMessage?: string;
    initialToolCalls?: Array<{ name: string; args: Record<string, unknown> }>;
  };
  config?: ChatConfig;
  callbacks?: Partial<ChatCallbacks>;
  /**
   * Custom component to render in the right sidebar panel (e.g. Profile info).
   * Can be:
   * - A React node (static)
   * - A function receiving context: `(context) => ReactNode`
   * - A render function receiving panel props: `(props: { onClose, isMobile }) => ReactNode`
   * Toggle visibility via the header button.
   */
  customComponent?: 
    | React.ReactNode 
    | ((context: ChatUserContext) => React.ReactNode)
    | ((props: { onClose: () => void; isMobile: boolean }) => React.ReactNode);
  onToolOutput?: (output: Record<string, unknown>) => void;
  /** Called when user clicks logout in the user menu */
  onLogout?: () => void;
  /** Called when user clicks "View Profile" in the user menu */
  onViewProfile?: () => void;
  /** Called when user adds a memory */
  onAddMemory?: (content: string, category?: MemoryItem['category']) => void;
  /** Called when user updates a memory */
  onUpdateMemory?: (memoryId: string, content: string) => void;
  /** Called when user deletes a memory */
  onDeleteMemory?: (memoryId: string) => void;
  /** Empty-state suggestions */
  suggestions?: string[];
  /** Agent selector data (built-in ChatUI) */
  agentOptions?: AgentOption[];
  selectedAgentId?: string | null;
  onSelectAgent?: (agentId: string) => void;
  /** Multi-agent: IDs of agents participating in the conversation */
  participantIds?: string[];
  onParticipantsChange?: (ids: string[]) => void;
  /** Multi-agent: ID of the agent this message is directed at */
  targetAgentId?: string | null;
  onTargetAgentChange?: (agentId: string | null) => void;
  getRequestHeaders?: RequestHeadersProvider;
  className?: string;
  eventInterceptor?: EventInterceptor;
  runErrorInterceptor?: RunErrorInterceptor;
  renderSpecialState?: RenderSpecialState;
}

export const CopilotzChat: React.FC<CopilotzChatProps> = ({
  userId,
  userName,
  userAvatar,
  userEmail,
  initialContext,
  bootstrap,
  config: userConfig,
  callbacks: userCallbacks,
  customComponent,
  onToolOutput,
  onLogout,
  onViewProfile,
  onAddMemory,
  onUpdateMemory,
  onDeleteMemory,
  suggestions,
  agentOptions = [],
  selectedAgentId = null,
  onSelectAgent,
  participantIds,
  onParticipantsChange,
  targetAgentId = null,
  onTargetAgentChange,
  getRequestHeaders,
  className,
  eventInterceptor,
  runErrorInterceptor,
  renderSpecialState,
}) => {
  const selectedAgent = agentOptions.find((agent) => agent.id === selectedAgentId) || null;

  // Resolve participant names from IDs for the adapter layer
  const participantNames = useMemo(() => {
    if (!participantIds || participantIds.length === 0) return null;
    return participantIds
      .map(id => agentOptions.find(a => a.id === id)?.name)
      .filter((name): name is string => Boolean(name));
  }, [participantIds, agentOptions]);

  // Resolve target agent name from ID
  const targetAgentName = useMemo(() => {
    if (!targetAgentId) return null;
    return agentOptions.find(a => a.id === targetAgentId)?.name ?? null;
  }, [targetAgentId, agentOptions]);

  const {
    messages,
    isMessagesLoading,
    isLoadingOlderMessages,
    messagePageInfo,
    threads,
    currentThreadId,
    isStreaming,
    specialState,
    clearSpecialState,
    userContextSeed,
    sendMessage,
    createThread,
    selectThread,
    renameThread,
    archiveThread,
    deleteThread,
    stopGeneration,
    loadOlderMessages,
  } = useCopilotz({
    userId,
    initialContext,
    bootstrap,
    defaultThreadName: userConfig?.labels?.defaultThreadName,
    onToolOutput,
    preferredAgentName: selectedAgent?.name ?? null,
    participants: participantNames,
    targetAgentName,
    getRequestHeaders,
    eventInterceptor,
    runErrorInterceptor,
  });

  const chatCallbacks: ChatCallbacks = useMemo(() => {
    const {
      onSendMessage: _1, onStopGeneration: _2, onCreateThread: _3,
      onSelectThread: _4, onRenameThread: _5, onArchiveThread: _6,
      onDeleteThread: _7, onCopyMessage: _8,
      ...restUserCallbacks
    } = userCallbacks || {};

    return {
      ...restUserCallbacks,
      onSendMessage: (content: string, attachments?: any[]) => {
        void sendMessage(content, attachments);
        userCallbacks?.onSendMessage?.(content, attachments);
      },
      onStopGeneration: () => {
        stopGeneration();
        userCallbacks?.onStopGeneration?.();
      },
      onCreateThread: (title?: string) => {
        createThread(title);
        userCallbacks?.onCreateThread?.(title);
      },
      onSelectThread: (threadId: string) => {
        void selectThread(threadId);
        userCallbacks?.onSelectThread?.(threadId);
      },
      onRenameThread: (threadId: string, newTitle: string) => {
        void renameThread(threadId, newTitle);
        userCallbacks?.onRenameThread?.(threadId, newTitle);
      },
      onArchiveThread: (threadId: string) => {
        void archiveThread(threadId);
        userCallbacks?.onArchiveThread?.(threadId);
      },
      onDeleteThread: (threadId: string) => {
        void deleteThread(threadId);
        userCallbacks?.onDeleteThread?.(threadId);
      },
      onCopyMessage: async (messageId: string, content: string) => {
        try {
          await navigator.clipboard.writeText(content);
          userCallbacks?.onCopyMessage?.(messageId, content);
        } catch (error) {
          console.error('Failed to copy message', error);
        }
      },
      onLogout,
      onViewProfile,
    };
  }, [sendMessage, stopGeneration, createThread, selectThread, renameThread, archiveThread, deleteThread, userCallbacks, onLogout, onViewProfile]);

  const mergedConfig: ChatConfig = useMemo(() => {
    const base = userConfig || {};
    if (!customComponent) {
      return base;
    }
    return {
      ...base,
      customComponent: {
        ...base.customComponent,
        component: customComponent,
        icon: base.customComponent?.icon || <User className="h-6 w-6" />,
      },
    };
  }, [userConfig, customComponent]);

  const effectiveUserName = userName || userId;
  const effectiveUserAvatar = userAvatar;

  const userProp = useMemo(() => ({
    id: userId,
    name: effectiveUserName,
    email: userEmail,
    avatar: effectiveUserAvatar,
  }), [userId, effectiveUserName, userEmail, effectiveUserAvatar]);

  const assistantProp = useMemo(() => ({
    name: userConfig?.branding?.title,
    avatar: userConfig?.branding?.avatar,
    description: userConfig?.branding?.subtitle,
  }), [userConfig?.branding?.title, userConfig?.branding?.avatar, userConfig?.branding?.subtitle]);

  const specialStateContent = specialState ? renderSpecialState?.(specialState, { clear: clearSpecialState }) : null;

  return (
    <ChatUserContextProvider initial={userContextSeed}>
      {specialStateContent ?? (
        <ChatUI
          messages={messages}
          isMessagesLoading={isMessagesLoading}
          isLoadingOlderMessages={isLoadingOlderMessages}
          hasMoreMessagesBefore={messagePageInfo.hasMoreBefore}
          onLoadOlderMessages={loadOlderMessages}
          threads={threads}
          currentThreadId={currentThreadId}
          config={mergedConfig}
          callbacks={chatCallbacks}
          isGenerating={isStreaming}
          suggestions={suggestions}
          agentOptions={agentOptions}
          selectedAgentId={selectedAgentId}
          onSelectAgent={onSelectAgent}
          participantIds={participantIds}
          onParticipantsChange={onParticipantsChange}
          targetAgentId={targetAgentId}
          onTargetAgentChange={onTargetAgentChange}
          user={userProp}
          assistant={assistantProp}
          onAddMemory={onAddMemory}
          onUpdateMemory={onUpdateMemory}
          onDeleteMemory={onDeleteMemory}
          className={className}
        />
      )}
    </ChatUserContextProvider>
  );
};
