import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  ChatMessage,
  ChatState,
  ChatThread,
  ChatUserContext,
  ChatV2Props,
  MediaAttachment,
  MessageActionEvent,
  StateCallback,
} from "../../types/chatTypes";
import { defaultChatConfig, mergeConfig } from "../../config/chatConfig";
import { Message } from "./Message";
import { Sidebar } from "./Sidebar";
import { ChatHeader } from "./ChatHeader";
import { ChatInput } from "./ChatInput";
import { UserProfile } from "./UserProfile";
import { useChatUserContext } from "./UserContext";
import { groupMessagesForRender } from "../../lib/messageGrouping";
import { ScrollArea } from "../ui/scroll-area";
import { Skeleton } from "../ui/skeleton";
import { TooltipProvider } from "../ui/tooltip";
import { SidebarInset, SidebarProvider } from "../ui/sidebar";
import {
  ArrowRight,
  HelpCircle,
  Lightbulb,
  MessageSquare,
  Sparkles,
  Zap,
} from "lucide-react";

// ChatUI is a purely presentational component
export const ChatUI: React.FC<ChatV2Props> = ({
  messages = [],
  threads = [],
  currentThreadId = null,
  config: userConfig,
  sidebar: _sidebar,
  userMenuSections,
  userMenuAdditionalItems,
  isGenerating = false,
  isMessagesLoading = false,
  isLoadingOlderMessages = false,
  hasMoreMessagesBefore = false,
  activityNotice = null,
  isBackgroundRefreshingMessages = false,
  callbacks = {},
  onLoadOlderMessages,
  user,
  assistant,
  suggestions = [],
  messageSuggestions = {},
  agentOptions = [],
  selectedAgentId = null,
  onSelectAgent,
  participantIds,
  onParticipantsChange,
  targetAgentId = null,
  onTargetAgentChange,
  className = "",
  onAddMemory,
  onUpdateMemory,
  onDeleteMemory,
  initialInput,
  onInitialInputConsumed,
}) => {
  // Merge configuration with defaults
  const config = useMemo(
    () => mergeConfig(defaultChatConfig, userConfig),
    [userConfig]
  );

  // Mobile detection
  const [isMobile, setIsMobile] = useState(false);

  // Built-in user profile panel state
  const [isUserProfileOpen, setIsUserProfileOpen] = useState(false);

  // Try to get user context for custom fields (may not be available if used outside provider)
  let userContext: ChatUserContext | undefined;
  try {
    const contextValue = useChatUserContext();
    userContext = contextValue?.context;
  } catch {
    // ChatUI used outside of ChatUserContextProvider, that's okay
    userContext = undefined;
  }

  // Check if desktop on initial render
  const getInitialSidebarState = () => {
    if (typeof globalThis.innerWidth === "number") {
      return globalThis.innerWidth >= 1024; // Open on desktop (lg+)
    }
    return false;
  };

  // Separate input state to avoid full re-renders on every keystroke
  const [inputValue, setInputValue] = useState("");
  const [attachments, setAttachments] = useState<MediaAttachment[]>([]);
  const [expandedMessageIds, setExpandedMessageIds] = useState<
    Record<string, boolean>
  >({});

  // Internal state for UI only (excluding input to optimize re-renders)
  const [state, setState] = useState<Omit<ChatState, "input" | "attachments">>({
    isRecording: false,
    selectedThreadId: currentThreadId,
    isAtBottom: true,
    showSidebar: getInitialSidebarState(), // Open by default on desktop
    showThreads: false, // No longer used for main sidebar
    editingMessageId: null,
    isSidebarCollapsed: false, // No longer used for main sidebar
  });

  // Update internal selected thread if prop changes
  useEffect(() => {
    if (currentThreadId !== state.selectedThreadId) {
      setState((prev) => ({ ...prev, selectedThreadId: currentThreadId }));
    }
  }, [currentThreadId]);

  // Track if initialInput has been applied
  const initialInputApplied = useRef(false);
  const initialInputConsumedRef = useRef(false);

  // Apply initialInput when provided
  useEffect(() => {
    if (initialInput && !initialInputApplied.current) {
      setInputValue(initialInput);
      initialInputApplied.current = true;
    }
  }, [initialInput]);

  // Refs
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const prependSnapshotRef = useRef<{
    scrollHeight: number;
    scrollTop: number;
    firstMessageId: string | null;
    messageCount: number;
  } | null>(null);

  // Refs for state to avoid recreating callbacks on every state change
  const stateRef = useRef(state);
  const inputValueRef = useRef(inputValue);
  const attachmentsRef = useRef(attachments);

  // Keep refs in sync with state
  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  useEffect(() => {
    inputValueRef.current = inputValue;
  }, [inputValue]);
  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);

  // Mobile custom overlay mount/unmount for smooth transitions
  const [isCustomMounted, setIsCustomMounted] = useState(false);
  const [isCustomVisible, setIsCustomVisible] = useState(false);
  const groupedMessages = useMemo(
    () => groupMessagesForRender(messages),
    [messages]
  );

  // Virtualizer — only renders messages visible in the viewport + overscan buffer
  const virtualizer = useVirtualizer({
    count: groupedMessages.length,
    getScrollElement: () => scrollAreaRef.current,
    getItemKey: (index) => groupedMessages[index]?.id ?? index,
    estimateSize: () => 100,
    overscan: 5,
  });

  // Create state callback helpers - uses refs to avoid recreating on every state change
  const createStateCallback = useCallback(
    (
      setter?: (value: React.SetStateAction<ChatState>) => void
    ): StateCallback<ChatState> => ({
      setState: (newState) => setter?.(newState),
      getState: () => ({
        ...stateRef.current,
        input: inputValueRef.current,
        attachments: attachmentsRef.current,
      }),
    }),
    [] // No dependencies - uses refs for latest state
  );

  // Mobile detection effect
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(globalThis.innerWidth < 1024); // lg breakpoint
    };

    checkMobile();
    globalThis.addEventListener("resize", checkMobile);
    return () => globalThis.removeEventListener("resize", checkMobile);
  }, []);

  // Animate mobile custom component overlay
  useEffect(() => {
    if (!isMobile || !config.customComponent?.component) return;
    if (state.showSidebar) {
      setIsCustomMounted(true);
      requestAnimationFrame(() => setIsCustomVisible(true));
    } else {
      setIsCustomVisible(false);
      const t = setTimeout(() => setIsCustomMounted(false), 200);
      return () => clearTimeout(t);
    }
  }, [state.showSidebar, isMobile, config.customComponent]);

  // Track previous message count to detect initial load vs incremental updates
  const prevMessageCountRef = useRef(0);

  // Auto-scroll to bottom on message changes
  useEffect(() => {
    if (groupedMessages.length === 0) {
      prevMessageCountRef.current = 0;
      return;
    }

    if (prependSnapshotRef.current) {
      prevMessageCountRef.current = groupedMessages.length;
      return;
    }

    const previousMessageCount = prevMessageCountRef.current;
    const wasEmpty = previousMessageCount === 0;
    const didAppendMessages = groupedMessages.length > previousMessageCount;
    prevMessageCountRef.current = groupedMessages.length;

    if (wasEmpty) {
      // Initial load (thread switch) — jump instantly to the bottom
      // Double RAF ensures the virtualizer has committed its layout
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          virtualizer.scrollToIndex(groupedMessages.length - 1, {
            align: "end",
          });
        });
      });
      return;
    }

    if (isBackgroundRefreshingMessages && !didAppendMessages) {
      return;
    }

    // Incremental update (new message, streaming) — smooth-scroll if at bottom
    if (!state.isAtBottom) return;
    requestAnimationFrame(() => {
      const viewport = scrollAreaRef.current;
      if (!viewport) return;
      try {
        viewport.scrollTo({ top: viewport.scrollHeight, behavior: "smooth" });
      } catch {
        viewport.scrollTop = viewport.scrollHeight;
      }
    });
  }, [groupedMessages, isBackgroundRefreshingMessages, state.isAtBottom, virtualizer]);

  // Re-measure visible items when the scroll container is resized (sidebar
  // toggle, devtools, window resize).  We do NOT call virtualizer.measure()
  // because that nukes the entire itemSizeCache, making every item fall back
  // to the 100px estimate and causing overlaps.  Instead we poke each mounted
  // element through the virtualizer's own ResizeObserver, which updates sizes
  // one-by-one without wiping the cache.
  useEffect(() => {
    const viewport = scrollAreaRef.current;
    if (!viewport) return;

    let rafId: number;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        // Access the virtualizer's internal element cache so we can
        // force a size re-read for every currently-mounted item.
        const elements = (virtualizer as any).elementsCache as
          | Map<string, HTMLElement>
          | undefined;
        if (elements) {
          elements.forEach((node) => {
            if (node.isConnected) {
              // Re-observe triggers a fresh size read in the next
              // ResizeObserver cycle. Disconnect+observe is the
              // cheapest way to force this without clearing the cache.
              (virtualizer as any).observer?.unobserve(node);
              (virtualizer as any).observer?.observe(node);
            }
          });
        }
      });
    });
    ro.observe(viewport);
    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
    };
  }, [virtualizer]);

  useEffect(() => {
    prependSnapshotRef.current = null;
  }, [currentThreadId]);

  useEffect(() => {
    const snapshot = prependSnapshotRef.current;
    if (!snapshot) return;

    if (groupedMessages.length <= snapshot.messageCount) {
      if (!isLoadingOlderMessages) {
        prependSnapshotRef.current = null;
      }
      return;
    }

    if ((groupedMessages[0]?.id ?? null) === snapshot.firstMessageId) {
      if (!isLoadingOlderMessages) {
        prependSnapshotRef.current = null;
      }
      return;
    }

    requestAnimationFrame(() => {
      virtualizer.measure();
      requestAnimationFrame(() => {
        const viewport = scrollAreaRef.current;
        if (!viewport) return;
        const heightDelta = viewport.scrollHeight - snapshot.scrollHeight;
        viewport.scrollTop = snapshot.scrollTop + heightDelta;
        prependSnapshotRef.current = null;
      });
    });
  }, [groupedMessages, isLoadingOlderMessages, virtualizer]);

  const requestOlderMessages = useCallback(() => {
    if (
      !onLoadOlderMessages ||
      !hasMoreMessagesBefore ||
      isLoadingOlderMessages
    )
      return;

    const viewport = scrollAreaRef.current;
    prependSnapshotRef.current = viewport
      ? {
          scrollHeight: viewport.scrollHeight,
          scrollTop: viewport.scrollTop,
          firstMessageId: groupedMessages[0]?.id ?? null,
          messageCount: groupedMessages.length,
        }
      : null;

    onLoadOlderMessages();
  }, [
    groupedMessages,
    hasMoreMessagesBefore,
    isLoadingOlderMessages,
    onLoadOlderMessages,
  ]);

  useEffect(() => {
    const validMessageIds = new Set(groupedMessages.map((group) => group.id));

    setExpandedMessageIds((prev) => {
      const activeIds = Object.keys(prev);
      const staleIds = activeIds.filter(
        (messageId) => !validMessageIds.has(messageId)
      );

      if (staleIds.length === 0) {
        return prev;
      }

      const next = { ...prev };
      staleIds.forEach((messageId) => {
        delete next[messageId];
      });
      return next;
    });
  }, [groupedMessages]);

  // Handle scroll position — only update state when the value actually changes
  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
      const isNearTop = scrollTop < 120;

      if (isNearTop && hasMoreMessagesBefore && !isLoadingOlderMessages) {
        requestOlderMessages();
      }

      setState((prev) => {
        if (prev.isAtBottom === isAtBottom) return prev;
        return { ...prev, isAtBottom };
      });
    },
    [hasMoreMessagesBefore, isLoadingOlderMessages, requestOlderMessages]
  );

  // Message handling
  const handleSendMessage = useCallback(
    (content: string, messageAttachments: MediaAttachment[] = []) => {
      if (!content.trim() && messageAttachments.length === 0) return;

      // Call external callback
      callbacks.onSendMessage?.(
        content,
        messageAttachments,
        createStateCallback()
      );

      // Mark initial input as consumed when message is sent
      if (initialInputApplied.current && !initialInputConsumedRef.current) {
        initialInputConsumedRef.current = true;
        onInitialInputConsumed?.();
      }

      // Clear input (using separate state for performance)
      setInputValue("");
      setAttachments([]);
    },
    [callbacks, createStateCallback, onInitialInputConsumed]
  );

  // Message actions
  const handleMessageAction = useCallback(
    (event: MessageActionEvent) => {
      const { action, messageId, content } = event;

      switch (action) {
        case "copy":
          callbacks.onCopyMessage?.(
            messageId,
            content || "",
            createStateCallback()
          );
          break;
        case "edit":
          if (content) {
            callbacks.onEditMessage?.(
              messageId,
              content,
              createStateCallback()
            );
          }
          break;
        case "regenerate":
          callbacks.onRegenerateMessage?.(messageId, createStateCallback());
          break;
        case "delete":
          callbacks.onDeleteMessage?.(messageId, createStateCallback());
          break;
      }
    },
    [callbacks, createStateCallback]
  );

  const handleToggleMessageExpansion = useCallback((messageId: string) => {
    setExpandedMessageIds((prev) => {
      if (prev[messageId]) {
        const next = { ...prev };
        delete next[messageId];
        return next;
      }

      return {
        ...prev,
        [messageId]: true,
      };
    });
  }, []);

  // Thread management
  const handleCreateThread = useCallback(
    (title?: string) => {
      callbacks.onCreateThread?.(title, createStateCallback());
    },
    [callbacks, createStateCallback]
  );

  const handleSelectThread = useCallback(
    (threadId: string) => {
      callbacks.onSelectThread?.(threadId, createStateCallback());
    },
    [callbacks, createStateCallback]
  );

  const handleRenameThread = useCallback(
    (threadId: string, newTitle: string) => {
      callbacks.onRenameThread?.(threadId, newTitle, createStateCallback());
    },
    [callbacks, createStateCallback]
  );

  const handleDeleteThread = useCallback(
    (threadId: string) => {
      callbacks.onDeleteThread?.(threadId, createStateCallback());
    },
    [callbacks, createStateCallback]
  );

  const handleArchiveThread = useCallback(
    (threadId: string) => {
      callbacks.onArchiveThread?.(threadId, createStateCallback());
    },
    [callbacks, createStateCallback]
  );

  const handleUpdateThreadTags = useCallback(
    (threadId: string, tags: ChatThread["tags"]) => {
      callbacks.onUpdateThreadTags?.(
        threadId,
        tags ?? [],
        createStateCallback()
      );
    },
    [callbacks, createStateCallback]
  );

  // Close sidebar handler
  const closeSidebar = useCallback(() => {
    setState((prev) => ({ ...prev, showSidebar: false }));
  }, []);

  const handleCustomComponentToggle = useCallback(() => {
    setState((prev) => ({ ...prev, showSidebar: !prev.showSidebar }));
  }, []);

  const sidebarUser = useMemo(
    () =>
      user
        ? {
            id: user.id,
            name: user.name,
            email: user.email,
            avatar: user.avatar,
          }
        : null,
    [user?.id, user?.name, user?.email, user?.avatar]
  );

  const handleViewProfile = useCallback(() => {
    setIsUserProfileOpen(true);
    callbacks.onViewProfile?.();
  }, [callbacks.onViewProfile]);

  const sidebarUserMenuCallbacks = useMemo(
    () => ({
      onViewProfile: handleViewProfile,
      onOpenSettings: callbacks.onOpenSettings,
      onThemeChange: callbacks.onThemeChange,
      onLogout: callbacks.onLogout,
    }),
    [
      handleViewProfile,
      callbacks.onOpenSettings,
      callbacks.onThemeChange,
      callbacks.onLogout,
    ]
  );

  // Render custom component with props if it's a function
  const renderCustomComponent = useCallback(() => {
    const component = config?.customComponent?.component;
    if (!component) return null;
    if (typeof component === "function") {
      return component({ onClose: closeSidebar, isMobile });
    }
    return component;
  }, [config?.customComponent?.component, closeSidebar, isMobile]);

  // Icon components for suggestion cards (cycle through these)
  const SuggestionIconComponents = [MessageSquare, Lightbulb, Zap, HelpCircle];

  // Render suggestions
  const renderSuggestions = () => {
    if (groupedMessages.length > 0 || !suggestions.length) return null;

    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] py-8 px-4">
        {/* Hero section */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 mb-4 shadow-sm">
            {config.branding.avatar ?? (
              <Sparkles className="w-7 h-7 text-primary" />
            )}
          </div>
          <h2 className="text-xl font-semibold mb-2">
            {config.branding.title}
          </h2>
          <p className="text-muted-foreground text-sm max-w-md">
            {config.branding.subtitle}
          </p>
        </div>

        {/* Suggestion cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-2xl">
          {suggestions.map((suggestion, index) => (
            <button
              key={index}
              type="button"
              onClick={() => handleSendMessage(suggestion)}
              className="group relative flex items-start gap-3 p-4 text-left rounded-xl border bg-card hover:bg-accent/50 hover:border-accent transition-all duration-200 hover:shadow-sm"
            >
              {(() => {
                const IconComponent =
                  SuggestionIconComponents[
                    index % SuggestionIconComponents.length
                  ];
                return (
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 text-primary shrink-0 group-hover:bg-primary/15 transition-colors">
                    <IconComponent className="h-4 w-4" />
                  </div>
                );
              })()}
              <div className="flex-1 min-w-0 pr-6">
                <p className="text-sm font-medium leading-snug line-clamp-2">
                  {suggestion}
                </p>
              </div>
              <ArrowRight className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          ))}
        </div>
      </div>
    );
  };

  const renderInlineSuggestions = (messageId: string) => {
    const items = messageSuggestions?.[messageId];
    if (!items || items.length === 0) return null;
    const inlineSuggestionOffsetClass = config.ui.showAvatars
      ? config.ui.compactMode
        ? "ml-9"
        : "ml-11"
      : "";

    return (
      <div
        className={`flex flex-wrap gap-2 mt-2 ${inlineSuggestionOffsetClass}`}
      >
        {items.map((suggestion, index) => (
          <button
            key={`${messageId}-suggestion-${index}`}
            type="button"
            onClick={() => handleSendMessage(suggestion)}
            className="group inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-full border border-border bg-background hover:bg-accent hover:border-accent-foreground/20 transition-all duration-150 text-foreground/80 hover:text-foreground"
          >
            <Sparkles className="h-3 w-3 text-primary opacity-70 group-hover:opacity-100" />
            <span className="max-w-[200px] truncate">{suggestion}</span>
          </button>
        ))}
      </div>
    );
  };

  const renderMessageLoadingSkeleton = () => (
    <div className="space-y-6 py-2">
      {[0, 1, 2, 3].map((index) => {
        const isUserRow = index % 2 === 1;
        return (
          <div
            key={`message-skeleton-${index}`}
            className={`flex gap-3 ${
              isUserRow ? "justify-end" : "justify-start"
            }`}
          >
            {!isUserRow && (
              <Skeleton className="h-8 w-8 rounded-full shrink-0" />
            )}
            <div className={`space-y-2 ${isUserRow ? "w-[70%]" : "w-[75%]"}`}>
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-[85%]" />
            </div>
            {isUserRow && (
              <Skeleton className="h-8 w-8 rounded-full shrink-0" />
            )}
          </div>
        );
      })}
    </div>
  );

  const isMultiAgentMode = config.agentSelector?.mode === "multi";
  const customPanelWidth = config.customComponent?.panelWidth ?? 320;
  const customPanelMinWidth = Math.min(customPanelWidth, 320);
  const customPanelResponsiveWidth = `clamp(${customPanelMinWidth}px, 30vw, ${customPanelWidth}px)`;

  // Stable props object for Message components — prevents unnecessary re-renders
  // when the virtualizer re-evaluates which items to show
  const messageProps = useMemo(
    () => ({
      userAvatar: user?.avatar,
      userName: user?.name,
      assistantAvatar: assistant?.avatar,
      assistantName: assistant?.name,
      showTimestamp: config.ui.showTimestamps,
      showAvatar: config.ui.showAvatars,
      enableCopy: config.features.enableMessageCopy,
      enableEdit: config.features.enableMessageEditing,
      enableRegenerate: config.features.enableRegeneration,
      showActivity: config.features.showActivity,
      showActivityDetails: config.features.showActivityDetails,
      compactMode: config.ui.compactMode,
      onAction: handleMessageAction,
      labels: config.labels,
      showMoreLabel: config.labels.showMoreMessage,
      showLessLabel: config.labels.showLessMessage,
      collapseLongMessages: config.ui.collapseLongMessages,
      collapseLongMessagesForUserOnly:
        config.ui.collapseLongMessagesForUserOnly,
      longMessagePreviewChars: config.ui.longMessagePreviewChars,
      longMessageChunkChars: config.ui.longMessageChunkChars,
      renderUserMarkdown: config.ui.renderUserMarkdown,
      markdown: config.markdown,
      onToggleExpanded: handleToggleMessageExpansion,
    }),
    [
      user?.avatar,
      user?.name,
      assistant?.avatar,
      assistant?.name,
      config.ui.showTimestamps,
      config.ui.showAvatars,
      config.ui.compactMode,
      config.features.enableMessageCopy,
      config.features.enableMessageEditing,
      config.features.enableRegeneration,
      config.features.showActivity,
      config.features.showActivityDetails,
      config.labels,
      config.labels.showMoreMessage,
      config.labels.showLessMessage,
      config.ui.collapseLongMessages,
      config.ui.collapseLongMessagesForUserOnly,
      config.ui.longMessagePreviewChars,
      config.ui.longMessageChunkChars,
      config.ui.renderUserMarkdown,
      config.markdown,
      handleMessageAction,
      handleToggleMessageExpansion,
    ]
  );

  const shouldShowAgentSelector = Boolean(
    config.agentSelector?.enabled &&
      agentOptions.length > 0 &&
      (!config.agentSelector?.hideIfSingle || agentOptions.length > 1) &&
      (isMultiAgentMode ? onParticipantsChange : onSelectAgent)
  );

  return (
    <TooltipProvider>
      <SidebarProvider defaultOpen>
        <div
          className={`flex h-[100dvh] bg-background w-full overflow-hidden ${className}`}
        >
          <Sidebar
            threads={threads}
            currentThreadId={state.selectedThreadId}
            config={config}
            onCreateThread={handleCreateThread}
            onSelectThread={handleSelectThread}
            onRenameThread={handleRenameThread}
            onDeleteThread={handleDeleteThread}
            onArchiveThread={handleArchiveThread}
            onUpdateThreadTags={handleUpdateThreadTags}
            // User menu props
            user={sidebarUser}
            userMenuCallbacks={sidebarUserMenuCallbacks}
            currentTheme={
              config.ui.theme === "auto" ? "system" : config.ui.theme
            }
            showThemeOptions={!!callbacks.onThemeChange}
            userMenuSections={userMenuSections}
            userMenuAdditionalItems={userMenuAdditionalItems}
          />

          <SidebarInset className="min-w-0 overflow-hidden">
            <div className="flex flex-col h-full min-h-0 min-w-0">
              {/* Header */}
              <ChatHeader
                config={config}
                currentThreadTitle={
                  threads.find((t) => t.id === state.selectedThreadId)?.title
                }
                // onSidebarToggle is now handled by SidebarTrigger inside ChatHeader
                isMobile={isMobile}
                onCustomComponentToggle={handleCustomComponentToggle}
                onNewThread={handleCreateThread}
                showCustomComponentButton={!!config?.customComponent?.component}
                showAgentSelector={shouldShowAgentSelector}
                isMultiAgentMode={isMultiAgentMode}
                agentOptions={agentOptions}
                selectedAgentId={selectedAgentId}
                onSelectAgent={onSelectAgent}
                participantIds={participantIds}
                onParticipantsChange={onParticipantsChange}
              />

              <div className="flex flex-1 flex-row min-h-0 min-w-0 overflow-hidden">
                {/* Main Chat Area */}
                <div className="flex-1 flex flex-col min-h-0 min-w-0">
                  {/* Messages — contain: strict prevents reflow from propagating to/from the input */}
                  <ScrollArea
                    ref={scrollAreaRef}
                    className="flex-1 min-h-0"
                    viewportClassName="p-4 overscroll-contain"
                    onScrollCapture={handleScroll}
                    style={{ contain: "content" }}
                  >
                    <div className="max-w-4xl mx-auto pb-4">
                      {groupedMessages.length > 0 && (
                        <div className="flex justify-center py-2">
                          {isLoadingOlderMessages ? (
                            <span className="text-xs text-muted-foreground">
                              {config.labels.loadingOlderMessages}
                            </span>
                          ) : hasMoreMessagesBefore ? (
                            <button
                              type="button"
                              onClick={requestOlderMessages}
                              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
                            >
                              {config.labels.loadOlderMessages}
                            </button>
                          ) : null}
                        </div>
                      )}
                      {isMessagesLoading ? (
                        renderMessageLoadingSkeleton()
                      ) : groupedMessages.length === 0 ? (
                        renderSuggestions()
                      ) : (
                        <div
                          style={{
                            height: `${virtualizer.getTotalSize()}px`,
                            width: "100%",
                            position: "relative",
                          }}
                        >
                          {virtualizer.getVirtualItems().map((virtualRow) => {
                            const group = groupedMessages[virtualRow.index];
                            const message = group.primaryMessage;

                            return (
                              <div
                                key={group.id}
                                data-index={virtualRow.index}
                                ref={virtualizer.measureElement}
                                style={{
                                  position: "absolute",
                                  top: 0,
                                  left: 0,
                                  width: "100%",
                                  transform: `translateY(${virtualRow.start}px)`,
                                }}
                              >
                                <div
                                  className={
                                    virtualRow.index === 0 ? "" : "pt-4"
                                  }
                                >
                                  <Message
                                    message={message}
                                    fragments={group.messages}
                                    {...messageProps}
                                    isExpanded={Boolean(
                                      expandedMessageIds[message.id]
                                    )}
                                  />
                                  {message.role === "assistant" &&
                                    renderInlineSuggestions(
                                      group.suggestionMessageId
                                    )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </ScrollArea>

                  {/* Input */}
                  <div className="-mt-8 bg-gradient-to-t from-background via-background/95 to-transparent px-0 pb-[env(safe-area-inset-bottom)] pt-10">
                    {activityNotice && (
                      <div className="mx-auto mb-2 w-full max-w-3xl px-3 md:px-2">
                        <div
                          className={
                            activityNotice.tone === "error"
                              ? "rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                              : "rounded-md border border-border bg-muted/70 px-3 py-2 text-sm text-muted-foreground"
                          }
                        >
                          {activityNotice.message}
                        </div>
                      </div>
                    )}
                    <ChatInput
                      value={inputValue}
                      onChange={(value) => {
                        inputValueRef.current = value;
                        // Mark initial input as consumed when user modifies it
                        if (
                          initialInputApplied.current &&
                          !initialInputConsumedRef.current
                        ) {
                          initialInputConsumedRef.current = true;
                          onInitialInputConsumed?.();
                        }
                      }}
                      onSubmit={handleSendMessage}
                      attachments={attachments}
                      onAttachmentsChange={setAttachments}
                      placeholder={config.labels.inputPlaceholder}
                      disabled={false}
                      isGenerating={isGenerating}
                      onStopGeneration={callbacks.onStopGeneration}
                      enableFileUpload={config.features.enableFileUpload}
                      enableAudioRecording={
                        config.features.enableAudioRecording
                      }
                      maxAttachments={config.features.maxAttachments}
                      maxFileSize={config.features.maxFileSize}
                      acceptedFileTypes={config.features.acceptedFileTypes}
                      config={config}
                      mentionAgents={
                        participantIds && participantIds.length > 0
                          ? agentOptions.filter((a) =>
                              participantIds.includes(a.id)
                            )
                          : agentOptions
                      }
                      targetAgentId={targetAgentId}
                      showTargetAgentSelector={Boolean(
                        isMultiAgentMode &&
                          shouldShowAgentSelector &&
                          onTargetAgentChange
                      )}
                      targetAgentSelectorPlaceholder={
                        config.agentSelector?.label || "Select agent"
                      }
                      onTargetAgentChange={onTargetAgentChange}
                    />
                  </div>
                </div>

                {/* Right sidebar custom component for desktop */}
                {config?.customComponent?.component && !isMobile && (
                  <div
                    className="h-full shrink-0 transition-all duration-300 ease-in-out overflow-hidden"
                    style={{
                      width: state.showSidebar
                        ? customPanelResponsiveWidth
                        : 0,
                    }}
                  >
                    {state.showSidebar && (
                      <div
                        className="h-full overflow-hidden border-l bg-background animate-in slide-in-from-right-4 duration-300"
                      >
                        {renderCustomComponent()}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </SidebarInset>

          {/* Mobile custom sidebar overlay with smooth transitions (slides from right) */}
          {isCustomMounted && config.customComponent?.component && isMobile && (
            <div className="fixed inset-0 z-50">
              {/* Backdrop */}
              <div
                className={`absolute inset-0 bg-background/80 backdrop-blur-sm transition-opacity duration-200 ease-out ${
                  isCustomVisible ? "opacity-100" : "opacity-0"
                }`}
                style={{ willChange: "opacity" }}
                onClick={closeSidebar}
              />
              {/* Panel - slides from right */}
              <div
                className={`absolute top-0 right-0 h-full w-full bg-background transform-gpu transition-transform duration-200 ease-out ${
                  isCustomVisible ? "translate-x-0" : "translate-x-full"
                }`}
                style={{ willChange: "transform" }}
              >
                <div className="h-full overflow-hidden">
                  {renderCustomComponent()}
                </div>
              </div>
            </div>
          )}

          {/* Built-in User Profile Panel - only render when open to avoid Radix focus conflicts */}
          {isUserProfileOpen && (
            <UserProfile
              isOpen={isUserProfileOpen}
              onClose={() => setIsUserProfileOpen(false)}
              user={
                user
                  ? {
                      id: user.id,
                      name: user.name,
                      email: user.email,
                      avatar: user.avatar,
                    }
                  : null
              }
              customFields={userContext?.customFields}
              memories={userContext?.memories?.items}
              onLogout={callbacks.onLogout}
              onAddMemory={onAddMemory}
              onUpdateMemory={onUpdateMemory}
              onDeleteMemory={onDeleteMemory}
            />
          )}
        </div>
      </SidebarProvider>
    </TooltipProvider>
  );
};
