import { ChatConfig } from '../types/chatTypes';

// Default configuration
export const defaultChatConfig: Required<ChatConfig> = {

  branding: {
    logo: null,
    avatar: null,
    title: 'Chat Assistant',
    subtitle: 'How can I help you today?',
  },

  agentSelector: {
    enabled: false,
    label: 'Select agent',
    hideIfSingle: true,
  },
  
  labels: {
    inputPlaceholder: 'Type your message...',
    sendButton: 'Send',
    sendMessageTooltip: 'Send message',
    newThread: 'New Conversation',
    deleteThread: 'Delete Conversation',
    copyMessage: 'Copy',
    editMessage: 'Edit',
    regenerateMessage: 'Regenerate',
    stopGeneration: 'Stop',
    stopGenerationTooltip: 'Stop generation',
    attachFiles: 'Attach Files',
    attachFileTooltip: 'Attach file',
    voiceEnter: 'Voice input',
    voiceExit: 'Use keyboard',
    voiceTitle: 'Voice',
    voiceIdle: 'Tap the mic to record',
    voicePreparing: 'Preparing microphone...',
    voiceWaiting: 'Waiting for speech...',
    voiceListening: 'Listening...',
    voiceFinishing: 'Finishing capture...',
    voiceReview: 'Ready to send',
    voiceSending: 'Sending...',
    voiceReviewArmedHint: 'Still listening. Speak to add more before it sends.',
    voiceReviewPausedHint: 'Tap the mic to keep adding to this message.',
    voiceStart: 'Start recording',
    voiceStop: 'Stop recording',
    voiceSendNow: 'Send now',
    voiceCancel: 'Cancel',
    voiceDiscard: 'Delete recording',
    voiceRecordAgain: 'Continue recording',
    voiceAutoSendIn: 'Auto-sends in {{seconds}}s',
    voiceTranscriptPending: 'Transcript unavailable',
    voicePermissionDenied: 'Microphone access was denied.',
    voiceCaptureError: 'Unable to capture audio.',
    // Header labels
    exportData: 'Export data',
    importData: 'Import data',
    clearAll: 'Clear all',
    sidebarToggle: 'Menu',
    customComponentToggle: 'Toggle',
    settings: 'Settings',
    toggleDarkMode: 'Toggle Dark Mode',
    lightMode: 'Light Mode',
    darkMode: 'Dark Mode',
    // Sidebar labels
    newChat: 'New Conversation',
    search: 'Search conversations...',
    customComponentLabel: 'Custom',
    showArchived: 'Show Archived',
    hideArchived: 'Hide Archived',
    noThreadsFound: 'No conversations found',
    noThreadsYet: 'No conversations yet',
    deleteConfirmTitle: 'Delete Conversation',
    deleteConfirmDescription: 'Are you sure you want to delete this conversation? This action cannot be undone. All messages will be permanently lost.',
    renameThread: 'Rename',
    archiveThread: 'Archive',
    unarchiveThread: 'Unarchive',
    today: 'Today',
    yesterday: 'Yesterday',
    createNewThread: 'Create New Conversation',
    threadNamePlaceholder: 'Conversation name (optional)',
    cancel: 'Cancel',
    create: 'Create Conversation',
    footerLabel: 'Assistant can make mistakes. Check the AI results.',
    daysAgo: 'days ago',
    inputHelpText: 'Press Enter to send, Shift+Enter to add a new line.',
    activityThinking: 'Thinking...',
    activityWorking: 'Working...',
    activityUsingTools: 'Using tools...',
    activityPreparingAnswer: 'Preparing answer...',
    activityToolRunning: 'Using {{tool}}...',
    activityMultipleTools: 'Using {{count}} tools...',
    activityShowDetails: 'Show details',
    activityHideDetails: 'Hide details',
    defaultThreadName: 'Main Thread',
    loadOlderMessages: 'Load older messages',
    loadingOlderMessages: 'Loading older messages...',
    showMoreMessage: 'Show more',
    showLessMessage: 'Show less',
  },
  
  features: {
    enableThreads: true,
    enableFileUpload: true,
    enableAudioRecording: true,
    enableMessageEditing: true,
    enableMessageCopy: true,
    enableRegeneration: true,
    activityDisplay: 'full',
    maxAttachments: 4,
    maxFileSize: 10 * 1024 * 1024, // 10MB
  },
  
  ui: {
    theme: 'auto' as const,
    showTimestamps: false,
    showAvatars: true,
    compactMode: false,
    showWordCount: false,
    collapseLongMessages: false,
    collapseLongMessagesForUserOnly: false,
    longMessagePreviewChars: 4000,
    longMessageChunkChars: 12000,
    renderUserMarkdown: true,
  },

  markdown: {
    remarkPlugins: [],
    rehypePlugins: [],
    components: {},
  },

  voiceCompose: {
    defaultMode: 'text',
    reviewMode: 'manual',
    autoSendDelayMs: 5000,
    persistComposer: true,
    showTranscriptPreview: true,
    transcriptMode: 'final-only',
    maxRecordingMs: 60000,
    createProvider: undefined,
  },
  
  customComponent: {},
  headerActions: null,
};

// Deep merge function for configurations
export function mergeConfig(_baseConfig: ChatConfig, userConfig?: Partial<ChatConfig>): Required<ChatConfig> {
  if (!userConfig) return defaultChatConfig;

  return {
    branding: {
      ...defaultChatConfig.branding,
      ...userConfig.branding,
    },
    labels: {
      ...defaultChatConfig.labels,
      ...userConfig.labels,
    },
    features: {
      ...defaultChatConfig.features,
      ...userConfig.features,
    },
    ui: {
      ...defaultChatConfig.ui,
      ...userConfig.ui,
    },
    markdown: {
      ...defaultChatConfig.markdown,
      ...userConfig.markdown,
    },
    voiceCompose: {
      ...defaultChatConfig.voiceCompose,
      ...userConfig.voiceCompose,
    },
    agentSelector: {
      ...defaultChatConfig.agentSelector,
      ...userConfig.agentSelector,
    },
    customComponent: userConfig.customComponent || defaultChatConfig.customComponent,
    headerActions: userConfig.headerActions || defaultChatConfig.headerActions,
  };
}
