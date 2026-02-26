import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  ChatV2Props,
  MediaAttachment,
  MessageActionEvent,
  StateCallback,
  ChatState,
  ChatUserContext,
} from '../../types/chatTypes';
import { defaultChatConfig, mergeConfig } from '../../config/chatConfig';
import { Message } from './Message';
import { Sidebar } from './Sidebar';
import { ChatHeader } from './ChatHeader';
import { ChatInput } from './ChatInput';
import { UserProfile } from './UserProfile';
import { useChatUserContext } from './UserContext';
import { ScrollArea } from '../ui/scroll-area';
import { Skeleton } from '../ui/skeleton';
import { TooltipProvider } from '../ui/tooltip';
import { SidebarProvider, SidebarInset } from '../ui/sidebar';
import { Sparkles, ArrowRight, MessageSquare, Lightbulb, Zap, HelpCircle } from 'lucide-react';

// ChatUI is a purely presentational component
export const ChatUI: React.FC<ChatV2Props> = ({
  messages = [],
  threads = [],
  currentThreadId = null,
  config: userConfig,
  sidebar: _sidebar,
  isGenerating = false,
  isMessagesLoading = false,
  callbacks = {},
  user,
  assistant,
  suggestions = [],
  messageSuggestions = {},
  agentOptions = [],
  selectedAgentId = null,
  onSelectAgent,
  className = '',
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
    if (typeof globalThis.innerWidth === 'number') {
      return globalThis.innerWidth >= 1024; // Open on desktop (lg+)
    }
    return false;
  };

  // Separate input state to avoid full re-renders on every keystroke
  const [inputValue, setInputValue] = useState('');
  const [attachments, setAttachments] = useState<MediaAttachment[]>([]);

  // Internal state for UI only (excluding input to optimize re-renders)
  const [state, setState] = useState<Omit<ChatState, 'input' | 'attachments'>>({
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
      setState(prev => ({ ...prev, selectedThreadId: currentThreadId }));
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Refs for state to avoid recreating callbacks on every state change
  const stateRef = useRef(state);
  const inputValueRef = useRef(inputValue);
  const attachmentsRef = useRef(attachments);

  // Keep refs in sync with state
  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { inputValueRef.current = inputValue; }, [inputValue]);
  useEffect(() => { attachmentsRef.current = attachments; }, [attachments]);

  // Mobile custom overlay mount/unmount for smooth transitions
  const [isCustomMounted, setIsCustomMounted] = useState(false);
  const [isCustomVisible, setIsCustomVisible] = useState(false);

  // Create state callback helpers - uses refs to avoid recreating on every state change
  const createStateCallback = useCallback(
    (setter?: (value: React.SetStateAction<ChatState>) => void): StateCallback<ChatState> => ({
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
    globalThis.addEventListener('resize', checkMobile);
    return () => globalThis.removeEventListener('resize', checkMobile);
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

  // Auto-scroll to bottom
  useEffect(() => {
    if (!state.isAtBottom) return;
    const viewport = scrollAreaRef.current;
    if (!viewport) return;
    const target = viewport.scrollHeight;
    try {
      viewport.scrollTo({ top: target, behavior: 'smooth' });
    } catch {
      viewport.scrollTop = target;
    }
  }, [messages, state.isAtBottom]);

  // Handle scroll position
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    setState(prev => ({ ...prev, isAtBottom }));
  }, []);

  // Message handling
  const handleSendMessage = useCallback((
    content: string,
    messageAttachments: MediaAttachment[] = []
  ) => {
    if (!content.trim() && messageAttachments.length === 0) return;
    
    // Call external callback
    callbacks.onSendMessage?.(content, messageAttachments, createStateCallback());

    // Mark initial input as consumed when message is sent
    if (initialInputApplied.current && !initialInputConsumedRef.current) {
      initialInputConsumedRef.current = true;
      onInitialInputConsumed?.();
    }

    // Clear input (using separate state for performance)
    setInputValue('');
    setAttachments([]);
  }, [callbacks, createStateCallback, onInitialInputConsumed]);

  // Message actions
  const handleMessageAction = useCallback((event: MessageActionEvent) => {
    const { action, messageId, content } = event;

    switch (action) {
      case 'copy':
        callbacks.onCopyMessage?.(messageId, content || '', createStateCallback());
        break;
      case 'edit':
        if (content) {
          callbacks.onEditMessage?.(messageId, content, createStateCallback());
        }
        break;
      case 'regenerate':
        callbacks.onRegenerateMessage?.(messageId, createStateCallback());
        break;
      case 'delete':
        callbacks.onDeleteMessage?.(messageId, createStateCallback());
        break;
    }
  }, [callbacks, createStateCallback]);

  // Thread management
  const handleCreateThread = useCallback((title?: string) => {
    callbacks.onCreateThread?.(title, createStateCallback());
  }, [callbacks, createStateCallback]);

  const handleSelectThread = useCallback((threadId: string) => {
    callbacks.onSelectThread?.(threadId, createStateCallback());
  }, [callbacks, createStateCallback]);

  const handleRenameThread = useCallback((threadId: string, newTitle: string) => {
    callbacks.onRenameThread?.(threadId, newTitle, createStateCallback());
  }, [callbacks, createStateCallback]);

  const handleDeleteThread = useCallback((threadId: string) => {
    callbacks.onDeleteThread?.(threadId, createStateCallback());
  }, [callbacks, createStateCallback]);

  const handleArchiveThread = useCallback((threadId: string) => {
    callbacks.onArchiveThread?.(threadId, createStateCallback());
  }, [callbacks, createStateCallback]);

  // Close sidebar handler
  const closeSidebar = useCallback(() => {
    setState(prev => ({ ...prev, showSidebar: false }));
  }, []);

  // Render custom component with props if it's a function
  const renderCustomComponent = useCallback(() => {
    const component = config?.customComponent?.component;
    if (!component) return null;
    if (typeof component === 'function') {
      return component({ onClose: closeSidebar, isMobile });
    }
    return component;
  }, [config?.customComponent?.component, closeSidebar, isMobile]);

  // Icon components for suggestion cards (cycle through these)
  const SuggestionIconComponents = [MessageSquare, Lightbulb, Zap, HelpCircle];

  // Render suggestions
  const renderSuggestions = () => {
    if (messages.length > 0 || !suggestions.length) return null;

    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] py-8 px-4">
        {/* Hero section */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 mb-4 shadow-sm">
            <Sparkles className="w-7 h-7 text-primary" />
          </div>
          <h2 className="text-xl font-semibold mb-2">{config.branding.title}</h2>
          <p className="text-muted-foreground text-sm max-w-md">{config.branding.subtitle}</p>
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
                const IconComponent = SuggestionIconComponents[index % SuggestionIconComponents.length];
                return (
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 text-primary shrink-0 group-hover:bg-primary/15 transition-colors">
                    <IconComponent className="h-4 w-4" />
                  </div>
                );
              })()}
              <div className="flex-1 min-w-0 pr-6">
                <p className="text-sm font-medium leading-snug line-clamp-2">{suggestion}</p>
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

    return (
      <div className="flex flex-wrap gap-2 mt-2 ml-11">
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
            className={`flex gap-3 ${isUserRow ? 'justify-end' : 'justify-start'}`}
          >
            {!isUserRow && <Skeleton className="h-8 w-8 rounded-full shrink-0" />}
            <div className={`space-y-2 ${isUserRow ? 'w-[70%]' : 'w-[75%]'}`}>
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-[85%]" />
            </div>
            {isUserRow && <Skeleton className="h-8 w-8 rounded-full shrink-0" />}
          </div>
        );
      })}
    </div>
  );

  const renderedMessageList = useMemo(() => {
    if (isMessagesLoading) return renderMessageLoadingSkeleton();

    return (
      <>
        {renderSuggestions()}

        {messages.map((message, index) => {
          // Check if this message is from the same sender as the previous one
          const prevMessage = index > 0 ? messages[index - 1] : null;
          const isGrouped = prevMessage !== null && prevMessage.role === message.role;

          return (
            <div key={message.id} className={isGrouped ? 'space-y-1 -mt-2' : 'space-y-2'}>
              <Message
                message={message}
                userAvatar={user?.avatar}
                userName={user?.name}
                assistantAvatar={assistant?.avatar}
                assistantName={assistant?.name}
                showTimestamp={config.ui.showTimestamps}
                showAvatar={config.ui.showAvatars}
                enableCopy={config.features.enableMessageCopy}
                enableEdit={config.features.enableMessageEditing}
                enableRegenerate={config.features.enableRegeneration}
                enableToolCallsDisplay={config.features.enableToolCallsDisplay}
                compactMode={config.ui.compactMode}
                onAction={handleMessageAction}
                toolUsedLabel={config.labels.toolUsed}
                thinkingLabel={config.labels.thinking}
                isGrouped={isGrouped}
              />
              {message.role === 'assistant' && renderInlineSuggestions(message.id)}
            </div>
          );
        })}
      </>
    );
  }, [
    isMessagesLoading,
    messages,
    handleSendMessage,
    user?.avatar,
    user?.name,
    assistant?.avatar,
    assistant?.name,
    config.branding.title,
    config.branding.subtitle,
    config.ui.showTimestamps,
    config.ui.showAvatars,
    config.ui.compactMode,
    config.features.enableMessageCopy,
    config.features.enableMessageEditing,
    config.features.enableRegeneration,
    config.features.enableToolCallsDisplay,
    config.labels.toolUsed,
    config.labels.thinking,
    handleMessageAction,
    messageSuggestions,
    suggestions,
  ]);

  const shouldShowAgentSelector = Boolean(
    config.agentSelector?.enabled &&
    onSelectAgent &&
    agentOptions.length > 0 &&
    (!config.agentSelector?.hideIfSingle || agentOptions.length > 1)
  );

  return (
    <TooltipProvider>
      <SidebarProvider defaultOpen>
        <div className={`flex h-[100svh] md:h-screen bg-background w-full overflow-hidden ${className}`}>
          
          <Sidebar
            threads={threads}
            currentThreadId={state.selectedThreadId}
            config={config}
            onCreateThread={handleCreateThread}
            onSelectThread={handleSelectThread}
            onRenameThread={handleRenameThread}
            onDeleteThread={handleDeleteThread}
            onArchiveThread={handleArchiveThread}
            // User menu props
            user={user ? {
              id: user.id,
              name: user.name,
              email: user.email,
              avatar: user.avatar,
            } : null}
            userMenuCallbacks={{
              onViewProfile: () => {
                setIsUserProfileOpen(true);
                callbacks.onViewProfile?.();
              },
              onOpenSettings: callbacks.onOpenSettings,
              onThemeChange: callbacks.onThemeChange,
              onLogout: callbacks.onLogout,
            }}
            currentTheme={config.ui.theme === 'auto' ? 'system' : config.ui.theme}
            showThemeOptions={!!callbacks.onThemeChange}
          />

          <SidebarInset>
            <div className="flex flex-col h-full min-h-0">
              {/* Header */}
              <ChatHeader
                config={config}
                currentThreadTitle={threads.find(t => t.id === state.selectedThreadId)?.title}
                // onSidebarToggle is now handled by SidebarTrigger inside ChatHeader
                isMobile={isMobile}
                onCustomComponentToggle={() => setState(prev => ({ ...prev, showSidebar: !prev.showSidebar }))}
                onNewThread={handleCreateThread}
                showCustomComponentButton={!!config?.customComponent?.component}
                showAgentSelector={shouldShowAgentSelector}
                agentOptions={agentOptions}
                selectedAgentId={selectedAgentId}
                onSelectAgent={onSelectAgent}
              />

              <div className="flex flex-1 flex-row min-h-0 overflow-hidden">
                {/* Main Chat Area */}
                <div className="flex-1 flex flex-col min-h-0">
                  {/* Messages */}
                  <ScrollArea
                    ref={scrollAreaRef}
                    className="flex-1 min-h-0"
                    viewportClassName="p-4 overscroll-contain"
                    onScrollCapture={handleScroll}
                  >
                    <div className="max-w-4xl mx-auto space-y-4 pb-4">
                      {renderedMessageList}

                      <div ref={messagesEndRef} />
                    </div>
                  </ScrollArea>

                  {/* Input */}
                  <div className="bg-background pb-[env(safe-area-inset-bottom)]">
                    <ChatInput
                      value={inputValue}
                      onChange={(value) => {
                        setInputValue(value);
                        // Mark initial input as consumed when user modifies it
                        if (initialInputApplied.current && !initialInputConsumedRef.current) {
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
                      enableAudioRecording={config.features.enableAudioRecording}
                      maxAttachments={config.features.maxAttachments}
                      maxFileSize={config.features.maxFileSize}
                      config={config}
                    />
                  </div>
                </div>

                {/* Right sidebar custom component for desktop */}
                {config?.customComponent?.component && !isMobile && (
                  <div
                    className={`h-full transition-all duration-300 ease-in-out overflow-hidden ${
                      state.showSidebar ? 'w-80' : 'w-0'
                    }`}
                  >
                    {state.showSidebar && (
                      <div className="flex flex-col h-full border-l bg-background animate-in slide-in-from-right-4 duration-300 w-80">
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
                  isCustomVisible ? 'opacity-100' : 'opacity-0'
                }`}
                style={{ willChange: 'opacity' }}
                onClick={closeSidebar}
              />
              {/* Panel - slides from right */}
              <div
                className={`absolute top-0 right-0 h-full w-full bg-background transform-gpu transition-transform duration-200 ease-out ${
                  isCustomVisible ? 'translate-x-0' : 'translate-x-full'
                }`}
                style={{ willChange: 'transform' }}
              >
                <div className="h-full flex flex-col">
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
              user={user ? {
                id: user.id,
                name: user.name,
                email: user.email,
                avatar: user.avatar,
              } : null}
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
