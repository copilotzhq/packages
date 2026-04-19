import { ReactNode } from 'react';
import type { Components, Options as ReactMarkdownOptions } from 'react-markdown';

// Enhanced Media Attachments
export type MediaAttachment =
  | {
      kind: 'image';
      dataUrl: string;
      mimeType: string;
      fileName?: string;
      size?: number;
    }
  | {
      kind: 'audio';
      dataUrl: string;
      mimeType: string;
      durationMs?: number;
      fileName?: string;
      size?: number;
    }
  | {
      kind: 'video';
      dataUrl: string;
      mimeType: string;
      durationMs?: number;
      fileName?: string;
      size?: number;
      poster?: string;
    };

export type AudioAttachment = Extract<MediaAttachment, { kind: 'audio' }>;

export type VoiceComposerState =
  | 'idle'
  | 'preparing'
  | 'waiting_for_speech'
  | 'listening'
  | 'finishing'
  | 'review'
  | 'sending'
  | 'error';

export type VoiceReviewMode = 'manual' | 'armed';

export type VoiceTranscriptMode = 'none' | 'final-only' | 'partial-and-final';

export interface VoiceTranscript {
  partial?: string;
  final?: string;
}

export interface VoiceSegment {
  attachment: AudioAttachment;
  transcript?: VoiceTranscript;
  metadata?: Record<string, unknown>;
}

export interface VoiceProviderHandlers {
  onStateChange?: (state: VoiceComposerState) => void;
  onAudioLevelChange?: (level: number) => void;
  onDurationChange?: (durationMs: number) => void;
  onTranscriptChange?: (transcript: VoiceTranscript) => void;
  onSegmentReady?: (segment: VoiceSegment) => void;
  onError?: (error: Error) => void;
}

export interface VoiceProviderOptions {
  maxRecordingMs?: number;
}

export interface VoiceProvider {
  start: () => Promise<void>;
  stop: () => Promise<void>;
  cancel: () => Promise<void> | void;
  destroy: () => Promise<void> | void;
}

export type CreateVoiceProvider = (
  handlers: VoiceProviderHandlers,
  options?: VoiceProviderOptions,
) => VoiceProvider | Promise<VoiceProvider>;

// Tool Calls for Agent Actions
export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
  result?: any;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime?: number;
  endTime?: number;
}

// Enhanced Chat Message
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  attachments?: MediaAttachment[];
  isStreaming?: boolean;
  isComplete?: boolean;
  isEdited?: boolean;
  originalContent?: string;
  editedAt?: number;
  toolCalls?: ToolCall[];
  metadata?: Record<string, any>;
  /** Model reasoning/thinking content (displayed in a collapsible block) */
  reasoning?: string;
  /** Whether reasoning tokens are still being streamed */
  isReasoningStreaming?: boolean;
  /** Agent/sender identity for multi-agent conversations */
  senderName?: string;
  /** Agent ID of the sender (for multi-agent conversations) */
  senderAgentId?: string;
}

// Thread Management
export interface ChatThread {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
  isArchived?: boolean;
  metadata?: Record<string, any>;
}

export interface ChatMarkdownConfig {
  remarkPlugins?: ReactMarkdownOptions['remarkPlugins'];
  rehypePlugins?: ReactMarkdownOptions['rehypePlugins'];
  components?: Components;
}

// Configuration for Chat Customization
export interface ChatConfig {
  branding?: {
    logo?: ReactNode;
    title?: string;
    subtitle?: string;
    avatar?: ReactNode;
  };
  agentSelector?: {
    enabled?: boolean;
    label?: string;
    hideIfSingle?: boolean;
    /** 'single' = classic single-agent dropdown (default). 'multi' = participants + target selectors. */
    mode?: 'single' | 'multi';
  };
  labels?: {
    inputPlaceholder?: string;
    sendButton?: string;
    sendMessageTooltip?: string;
    newThread?: string;
    deleteThread?: string;
    copyMessage?: string;
    editMessage?: string;
    regenerateMessage?: string;
    stopGeneration?: string;
    stopGenerationTooltip?: string;
    attachFiles?: string;
    attachFileTooltip?: string;
    voiceEnter?: string;
    voiceExit?: string;
    voiceTitle?: string;
    voiceIdle?: string;
    voicePreparing?: string;
    voiceWaiting?: string;
    voiceListening?: string;
    voiceFinishing?: string;
    voiceReview?: string;
    voiceSending?: string;
    voiceReviewArmedHint?: string;
    voiceReviewPausedHint?: string;
    voiceStart?: string;
    voiceStop?: string;
    voiceSendNow?: string;
    voiceCancel?: string;
    voiceDiscard?: string;
    voiceRecordAgain?: string;
    voiceAutoSendIn?: string;
    voiceTranscriptPending?: string;
    voicePermissionDenied?: string;
    voiceCaptureError?: string;
    // Header labels
    exportData?: string;
    importData?: string;
    clearAll?: string;
    sidebarToggle?: string;
    customComponentToggle?: string;
    settings?: string;
    toggleDarkMode?: string;
    lightMode?: string;
    darkMode?: string;
    // Sidebar labels
    newChat?: string;
    search?: string;
    customComponentLabel?: string;
    showArchived?: string;
    hideArchived?: string;
    noThreadsFound?: string;
    noThreadsYet?: string;
    deleteConfirmTitle?: string;
    deleteConfirmDescription?: string;
    renameThread?: string;
    archiveThread?: string;
    unarchiveThread?: string;
    today?: string;
    yesterday?: string;
    createNewThread?: string;
    threadNamePlaceholder?: string;
    cancel?: string;
    create?: string;
    footerLabel?: string;
    toolUsed?: string;
    daysAgo?: string;
    inputHelpText?: string;
    thinking?: string;
    defaultThreadName?: string;
    loadOlderMessages?: string;
    loadingOlderMessages?: string;
    showMoreMessage?: string;
    showLessMessage?: string;
  };
  features?: {
    enableThreads?: boolean;
    enableFileUpload?: boolean;
    enableAudioRecording?: boolean;
    enableMessageEditing?: boolean;
    enableMessageCopy?: boolean;
    enableRegeneration?: boolean;
    enableToolCallsDisplay?: boolean;
    maxAttachments?: number;
    maxFileSize?: number; // in bytes
  };
  ui?: {
    theme?: 'light' | 'dark' | 'auto';
    showTimestamps?: boolean;
    showAvatars?: boolean;
    compactMode?: boolean;
    showWordCount?: boolean;
    collapseLongMessages?: boolean;
    collapseLongMessagesForUserOnly?: boolean;
    longMessagePreviewChars?: number;
    longMessageChunkChars?: number;
    renderUserMarkdown?: boolean;
  };
  markdown?: ChatMarkdownConfig;
  voiceCompose?: {
    defaultMode?: 'text' | 'voice';
    reviewMode?: VoiceReviewMode;
    autoSendDelayMs?: number;
    persistComposer?: boolean;
    showTranscriptPreview?: boolean;
    transcriptMode?: VoiceTranscriptMode;
    maxRecordingMs?: number;
    createProvider?: CreateVoiceProvider;
  };
  customComponent?: {
    label?: string;
    icon?: ReactNode;
    /** Static component or render function receiving panel props */
    component?: ReactNode | ((props: { onClose: () => void; isMobile: boolean }) => ReactNode);
    /** Desktop panel width in pixels (default: 320) */
    panelWidth?: number;
  };
  /** Additional actions to render in the header */
  headerActions?: ReactNode;
}

// Callback Types with State Setters
export interface StateCallback<T = unknown> {
  setState: (state: T | ((prev: T) => T)) => void;
  getState: () => T;
}

export interface ChatCallbacks {
  onSendMessage?: (content: string, attachments?: MediaAttachment[], callback?: StateCallback<ChatState>) => void;
  onEditMessage?: (messageId: string, newContent: string, callback?: StateCallback<ChatState>) => void;
  onDeleteMessage?: (messageId: string, callback?: StateCallback<ChatState>) => void;
  onRegenerateMessage?: (messageId: string, callback?: StateCallback<ChatState>) => void;
  onStopGeneration?: (callback?: StateCallback<ChatState>) => void;
  onCreateThread?: (title?: string, callback?: StateCallback<ChatState>) => void;
  onSelectThread?: (threadId: string, callback?: StateCallback<ChatState>) => void;
  onRenameThread?: (threadId: string, newTitle: string, callback?: StateCallback<ChatState>) => void;
  onDeleteThread?: (threadId: string, callback?: StateCallback<ChatState>) => void;
  onArchiveThread?: (threadId: string, callback?: StateCallback<ChatState>) => void;
  onCopyMessage?: (messageId: string, content: string, callback?: StateCallback<ChatState>) => void;
  onAttachmentRemove?: (attachmentIndex: number, callback?: StateCallback<ChatState>) => void;
  // User menu callbacks
  onViewProfile?: () => void;
  onOpenSettings?: () => void;
  onThemeChange?: (theme: 'light' | 'dark' | 'system') => void;
  onLogout?: () => void;
}

// Main Chat Props
export interface ChatV2Props {
  // Core Data
  messages?: ChatMessage[];
  threads?: ChatThread[];
  currentThreadId?: string | null;
  
  // Customization
  config?: ChatConfig;
  sidebar?: ReactNode;
  
  // State Management
  isGenerating?: boolean;
  isMessagesLoading?: boolean;
  isLoadingOlderMessages?: boolean;
  hasMoreMessagesBefore?: boolean;
  
  // Callbacks
  callbacks?: ChatCallbacks;
  onLoadOlderMessages?: () => void;
  
  // User Info
  user?: {
    id: string;
    name?: string;
    avatar?: string;
    email?: string;
  };
  
  // Assistant Info
  assistant?: {
    name?: string;
    avatar?: ReactNode;
    description?: string;
  };

  // Agent selector (built-in)
  agentOptions?: AgentOption[];
  selectedAgentId?: string | null;
  onSelectAgent?: (agentId: string) => void;

  // Multi-agent selectors
  /** IDs of agents participating in this conversation */
  participantIds?: string[];
  onParticipantsChange?: (ids: string[]) => void;
  /** ID of the agent this message is directed at */
  targetAgentId?: string | null;
  onTargetAgentChange?: (agentId: string | null) => void;

  // Advanced Features
  suggestions?: string[];
  messageSuggestions?: Record<string, string[]>;
  enabledFeatures?: string[];
  className?: string;
  
  // Memory callbacks (for UserProfile)
  onAddMemory?: (content: string, category?: MemoryItem['category']) => void;
  onUpdateMemory?: (memoryId: string, content: string) => void;
  onDeleteMemory?: (memoryId: string) => void;

  /**
   * Initial value for the input field.
   * Useful for pre-filling the input from URL parameters or other sources.
   * The value is only used once on mount or when it changes.
   */
  initialInput?: string;

  /**
   * Callback when the initial input has been consumed (user started typing or sent).
   * Call this to clear the source (e.g., URL parameter) to prevent re-prefilling.
   */
  onInitialInputConsumed?: () => void;
}

// Component State Types
export interface ChatState {
  input: string;
  attachments: MediaAttachment[];
  isRecording: boolean;
  selectedThreadId: string | null;
  isAtBottom: boolean;
  showSidebar: boolean;
  showThreads: boolean;
  editingMessageId: string | null;
  isSidebarCollapsed: boolean;
}

export interface AgentOption {
  id: string;
  name: string;
  description?: string;
  avatarUrl?: string;
  /** Custom color for multi-agent display. Auto-assigned if not provided. */
  color?: string;
}

// Message Actions
export type MessageAction = 
  | 'copy'
  | 'edit' 
  | 'delete'
  | 'regenerate'
  | 'retry';

export interface MessageActionEvent {
  action: MessageAction;
  messageId: string;
  content?: string;
}

// File Upload Types
export interface FileUploadProgress {
  fileName: string;
  progress: number;
  status: 'uploading' | 'completed' | 'failed';
}

// Streaming Types
export interface StreamingUpdate {
  messageId: string;
  delta: string;
  isComplete?: boolean;
}

// Custom field definition for user profile
export interface UserCustomField {
  key: string;
  label: string;
  value: string | number | boolean | null | undefined;
  type?: 'text' | 'email' | 'phone' | 'url' | 'date' | 'number' | 'boolean';
  icon?: ReactNode;
}

// Memory item - persistent information about the user
export interface MemoryItem {
  id: string;
  content: string;
  category?: 'preference' | 'fact' | 'goal' | 'context' | 'other';
  source: 'agent' | 'user';
  createdAt: string;
  updatedAt?: string;
}

// Shared user context stored by chat and tools
export interface ChatUserContext extends Record<string, unknown> {
  /** Custom fields defined by the login component, shown in built-in user profile */
  customFields?: UserCustomField[] | Record<string, unknown>;
  /** Persistent memories about the user */
  memories?: {
    items?: MemoryItem[];
  };
}
