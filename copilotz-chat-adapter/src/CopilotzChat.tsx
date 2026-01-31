import React, { useMemo } from 'react';
import { ChatUI, ChatUserContextProvider } from '@copilotz/chat-ui';
import type { ChatConfig, ChatCallbacks, ChatUserContext, MemoryItem } from '@copilotz/chat-ui';
import { User } from 'lucide-react';
import { useCopilotz } from './useCopilotzChat';

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
  className?: string;
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
  className,
}) => {
  const {
    messages,
    threads,
    currentThreadId,
    isStreaming,
    userContextSeed,
    sendMessage,
    createThread,
    selectThread,
    renameThread,
    archiveThread,
    deleteThread,
    stopGeneration,
  } = useCopilotz({ 
    userId, 
    initialContext, 
    bootstrap, 
    defaultThreadName: userConfig?.labels?.defaultThreadName,
    onToolOutput 
  });

  const chatCallbacks: ChatCallbacks = useMemo(() => ({
    onSendMessage: (content, attachments) => {
      void sendMessage(content, attachments);
      userCallbacks?.onSendMessage?.(content, attachments);
    },
    onStopGeneration: () => {
      stopGeneration();
      userCallbacks?.onStopGeneration?.();
    },
    onCreateThread: (title) => {
      createThread(title);
      userCallbacks?.onCreateThread?.(title);
    },
    onSelectThread: (threadId) => {
      void selectThread(threadId);
      userCallbacks?.onSelectThread?.(threadId);
    },
    onRenameThread: (threadId, newTitle) => {
      void renameThread(threadId, newTitle);
      userCallbacks?.onRenameThread?.(threadId, newTitle);
    },
    onArchiveThread: (threadId) => {
      void archiveThread(threadId);
      userCallbacks?.onArchiveThread?.(threadId);
    },
    onDeleteThread: (threadId) => {
      void deleteThread(threadId);
      userCallbacks?.onDeleteThread?.(threadId);
    },
    onCopyMessage: async (messageId, content) => {
      try {
        await navigator.clipboard.writeText(content);
        userCallbacks?.onCopyMessage?.(messageId, content);
      } catch (error) {
        console.error('Failed to copy message', error);
      }
    },
    // User menu callbacks
    onLogout,
    onViewProfile,
    ...userCallbacks,
  }), [sendMessage, stopGeneration, createThread, selectThread, renameThread, archiveThread, deleteThread, userCallbacks, onLogout, onViewProfile]);

  // Merge user config with dynamic values
  // customComponent is passed through - it will be resolved in ChatUI
  // which can provide onClose and isMobile props
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
  // Don't try to extract avatar from profile automatically unless it's in context
  const effectiveUserAvatar = userAvatar;

  return (
    <ChatUserContextProvider initial={userContextSeed}>
      <ChatUI
        messages={messages}
        threads={threads}
        currentThreadId={currentThreadId}
        config={mergedConfig}
        callbacks={chatCallbacks}
        isGenerating={isStreaming}
        user={{
          id: userId,
          name: effectiveUserName,
          email: userEmail,
          avatar: effectiveUserAvatar,
        }}
        assistant={{
          name: userConfig?.branding?.title,
          avatar: userConfig?.branding?.avatar,
          description: userConfig?.branding?.subtitle,
        }}
        onAddMemory={onAddMemory}
        onUpdateMemory={onUpdateMemory}
        onDeleteMemory={onDeleteMemory}
        className={className}
      />
    </ChatUserContextProvider>
  );
};
