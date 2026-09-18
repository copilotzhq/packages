import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChatUI, ChatUserContextProvider } from '@copilotz/chat-ui';
import type {
  AgentOption,
  ChatCallbacks,
  ChatConfig,
  ChatSpaceManagementRequest,
  ChatUserContext,
  ChatUserMenuSection,
  MemoryItem,
  ToolRendererMap
} from '@copilotz/chat-ui';
import type { CoreClient } from '@copilotz/copilotz/core/client';
import type { ObservationFrame } from '@copilotz/copilotz/client';
import { User } from 'lucide-react';
import { useCopilotzChat } from './useCopilotzChat';
import type {
  EventInterceptor,
  RenderSpecialState,
  RunErrorInterceptor
} from './specialState';
import type { RequestHeadersProvider } from './useCopilotzChat';
import type { ChatSpaceService } from './controller';
import { invokeSpaceManagement } from './spaceManagement';

type ChatRenderBoundaryProps = {
  children: React.ReactNode;
  onRetry: () => void | Promise<boolean | undefined>;
};
type ChatRenderBoundaryState = { error: Error | null; retrying: boolean };

/** Keeps a custom renderer failure local so the controller can recover its last valid state. */
class ChatRenderBoundary extends React.Component<
  ChatRenderBoundaryProps,
  ChatRenderBoundaryState
> {
  state: ChatRenderBoundaryState = { error: null, retrying: false };

  static getDerivedStateFromError(error: unknown): ChatRenderBoundaryState {
    return {
      retrying: false,
      error:
        error instanceof Error
          ? error
          : new Error('The conversation could not be rendered.')
    };
  }

  private retry = async () => {
    if (this.state.retrying) return;
    this.setState({ retrying: true });
    let recovered: boolean | undefined | void;
    try {
      recovered = await this.props.onRetry();
    } catch {
      this.setState({ retrying: false });
      return;
    }
    if (recovered === false) {
      this.setState({ retrying: false });
      return;
    }
    this.setState({ error: null, retrying: false });
  };

  render() {
    if (this.state.error) {
      return (
        <div
          role="alert"
          className="flex h-full items-center justify-center p-6 text-sm text-muted-foreground"
        >
          <div className="flex items-center gap-3 rounded-md border border-border bg-muted/70 px-3 py-2">
            <span>{this.state.error.message}</span>
            <button
              type="button"
              className="shrink-0 underline underline-offset-2"
              onClick={() => void this.retry()}
              disabled={this.state.retrying}
            >
              {this.state.retrying ? 'Retrying…' : 'Retry'}
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export interface CopilotzChatProps {
  userId: string;
  userName?: string;
  userAvatar?: string;
  userEmail?: string;
  initialContext?: ChatUserContext;
  bootstrap?: {
    initialMessage?: string;
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
  /**
   * Fired whenever the adapter’s selected thread id changes (initial load,
   * thread list refresh, create/select/delete, etc.). Use to keep side panels
   * in sync; user-driven `onSelectThread` alone does not cover bootstrap paths.
   */
  onCurrentThreadIdChange?: (threadId: string | null) => void;
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
  /** Structured custom menu sections rendered natively by the sidebar user menu */
  userMenuSections?: ChatUserMenuSection[];
  /** Additional native items to render inside the sidebar user menu */
  userMenuAdditionalItems?: React.ReactNode;
  /** Called for each observation frame for the active thread. */
  onObservationFrame?: (threadId: string, frame: ObservationFrame) => void;
  /** Called before attachment processing and Core submission. */
  onSendStart?: (idempotencyKey: string) => void;
  /** Called after the send promise settles. */
  onSendSettled?: (idempotencyKey: string) => void;
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
  /** Host-owned Space API; its server must enforce actor and membership. */
  spaceService?: ChatSpaceService;
  /** Optional host-owned Core client. The adapter creates one when omitted. */
  coreClient?: CoreClient;
  baseUrl?: string;
  getRequestHeaders?: RequestHeadersProvider;
  className?: string;
  eventInterceptor?: EventInterceptor;
  runErrorInterceptor?: RunErrorInterceptor;
  renderSpecialState?: RenderSpecialState;
  /** Client-owned tool detail renderers keyed by exact tool name. */
  toolRenderers?: ToolRendererMap;
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
  onCurrentThreadIdChange,
  onLogout,
  onViewProfile,
  onAddMemory,
  onUpdateMemory,
  onDeleteMemory,
  userMenuSections,
  userMenuAdditionalItems,
  onObservationFrame,
  onSendStart,
  onSendSettled,
  suggestions,
  agentOptions = [],
  selectedAgentId = null,
  onSelectAgent,
  participantIds,
  onParticipantsChange,
  targetAgentId = null,
  onTargetAgentChange,
  spaceService,
  coreClient,
  baseUrl,
  getRequestHeaders,
  className,
  eventInterceptor,
  runErrorInterceptor,
  renderSpecialState,
  toolRenderers
}) => {
  const selectedAgent =
    agentOptions.find((agent) => agent.id === selectedAgentId) || null;

  // Keep backend routing identities stable. Display names are for UI only;
  // thread participants and targets must use agent IDs so server-side history
  // lookup can match the target agent.
  const participantAgentIds = useMemo(() => {
    if (!participantIds || participantIds.length === 0) return null;
    return participantIds.filter(
      (id) => typeof id === 'string' && id.length > 0
    );
  }, [participantIds]);

  const selectedAgentRunId = selectedAgent?.id ?? selectedAgentId ?? null;

  const targetAgentRunId = useMemo(() => {
    if (!targetAgentId) return null;
    return targetAgentId;
  }, [targetAgentId]);

  const {
    messages,
    isMessagesLoading,
    isLoadingOlderMessages,
    messagePageInfo,
    threads,
    spaces,
    currentThreadId,
    isStreaming,
    isStopping,
    isRecoveringStream,
    activityNotice,
    toolCallDraftSource,
    specialState,
    clearSpecialState,
    userContextSeed,
    sendMessage,
    createThread,
    selectThread,
    renameThread,
    archiveThread,
    createSpace,
    refreshSpaces,
    moveThreadToSpace,
    editMessage,
    deleteThread,
    stopGeneration,
    recoverConversation,
    loadOlderMessages
  } = useCopilotzChat({
    userId,
    userName,
    userAvatar,
    assistantName: userConfig?.branding?.title,
    agentOptions,
    initialContext,
    bootstrap,
    defaultThreadName: userConfig?.labels?.defaultThreadName,
    onToolOutput,
    onObservationFrame,
    onSendStart,
    onSendSettled,
    preferredAgentName: selectedAgentRunId,
    participants: participantAgentIds,
    targetAgentName: targetAgentRunId,
    spaceService,
    coreClient,
    baseUrl,
    getRequestHeaders,
    eventInterceptor,
    runErrorInterceptor
  });

  useEffect(() => {
    onCurrentThreadIdChange?.(currentThreadId);
  }, [currentThreadId, onCurrentThreadIdChange]);

  const chatCallbacks: ChatCallbacks = useMemo(() => {
    const {
      onSendMessage: _1,
      onStopGeneration: _2,
      onCreateThread: _3,
      onSelectThread: _4,
      onRenameThread: _5,
      onArchiveThread: _6,
      onDeleteThread: _7,
      onCreateSpace: _8,
      onManageSpace: _9,
      onMoveThreadToSpace: _10,
      onCopyMessage: _11,
      onEditMessage: _12,
      ...restUserCallbacks
    } = userCallbacks || {};

    return {
      ...restUserCallbacks,
      onSendMessage: (content: string, attachments?: any[]) => {
        void sendMessage(content, attachments);
        userCallbacks?.onSendMessage?.(content, attachments);
      },
      onStopGeneration: () => {
        void stopGeneration();
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
      ...(spaceService
        ? {
            onCreateSpace: async (name: string) => {
              const space = await createSpace(name);
              if (space) userCallbacks?.onCreateSpace?.(name);
              return space;
            },
            onMoveThreadToSpace: async (
              threadId: string,
              spaceId: string | null
            ) => {
              const moved = await moveThreadToSpace(threadId, spaceId);
              if (moved === true) {
                userCallbacks?.onMoveThreadToSpace?.(threadId, spaceId);
              }
              return moved ?? false;
            }
          }
        : {}),
      ...(userCallbacks?.onManageSpace
        ? {
            onManageSpace: async (
              request: ChatSpaceManagementRequest,
              callback?: Parameters<NonNullable<ChatCallbacks['onManageSpace']>>[1]
            ) => {
              return invokeSpaceManagement(
                userCallbacks.onManageSpace!,
                request,
                callback,
                spaceService ? refreshSpaces : undefined
              );
            }
          }
        : {}),
      onDeleteThread: (threadId: string) => {
        void deleteThread(threadId);
        userCallbacks?.onDeleteThread?.(threadId);
      },
      onCopyMessage: async (messageId: string, content: string) => {
        userCallbacks?.onCopyMessage?.(messageId, content);
      },
      onEditMessage: (messageId: string, content: string) => {
        void editMessage(messageId, content);
        userCallbacks?.onEditMessage?.(messageId, content);
      },
      onLogout,
      onViewProfile
    };
  }, [
    sendMessage,
    stopGeneration,
    createThread,
    selectThread,
    renameThread,
    archiveThread,
    createSpace,
    refreshSpaces,
    moveThreadToSpace,
    editMessage,
    deleteThread,
    userCallbacks,
    onLogout,
    onViewProfile,
    spaceService
  ]);

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
        icon: base.customComponent?.icon || <User className="h-6 w-6" />
      }
    };
  }, [userConfig, customComponent]);

  const effectiveUserName = userName || userId;
  const effectiveUserAvatar = userAvatar;

  const userProp = useMemo(
    () => ({
      id: userId,
      name: effectiveUserName,
      email: userEmail,
      avatar: effectiveUserAvatar
    }),
    [userId, effectiveUserName, userEmail, effectiveUserAvatar]
  );

  const assistantProp = useMemo(
    () => ({
      name: userConfig?.branding?.title,
      avatar: userConfig?.branding?.avatar,
      description: userConfig?.branding?.subtitle
    }),
    [
      userConfig?.branding?.title,
      userConfig?.branding?.avatar,
      userConfig?.branding?.subtitle
    ]
  );

  const specialStateContent = specialState
    ? renderSpecialState?.(specialState, { clear: clearSpecialState })
    : null;

  return (
    <ChatUserContextProvider initial={userContextSeed}>
      {specialStateContent ?? (
        <ChatRenderBoundary
          key={currentThreadId ?? 'new'}
          onRetry={() => recoverConversation?.()}
        >
          <ChatUI
            messages={messages}
            isMessagesLoading={isMessagesLoading}
            isLoadingOlderMessages={isLoadingOlderMessages}
            hasMoreMessagesBefore={messagePageInfo.hasMore}
            activityNotice={activityNotice}
            isBackgroundRefreshingMessages={isRecoveringStream}
            onLoadOlderMessages={loadOlderMessages}
            threads={threads}
            spaces={spaces}
            currentThreadId={currentThreadId}
            config={mergedConfig}
            callbacks={chatCallbacks}
            isGenerating={isStreaming}
            isStoppingGeneration={isStopping}
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
            userMenuSections={userMenuSections}
            userMenuAdditionalItems={userMenuAdditionalItems}
            toolRenderers={toolRenderers}
            toolCallDraftSource={toolCallDraftSource}
            className={className}
          />
        </ChatRenderBoundary>
      )}
    </ChatUserContextProvider>
  );
};
