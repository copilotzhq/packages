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
    recordAudio: 'Record Audio',
    recordAudioTooltip: 'Record audio',
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
    toolUsed: 'Tool Used',
    daysAgo: 'days ago',
    inputHelpText: 'Press Enter to send, Shift+Enter to add a new line.',
    thinking: 'Thinking...',
    defaultThreadName: 'Main Thread',
  },
  
  features: {
    enableThreads: true,
    enableFileUpload: true,
    enableAudioRecording: true,
    enableMessageEditing: true,
    enableMessageCopy: true,
    enableRegeneration: true,
    enableToolCallsDisplay: true,
    maxAttachments: 4,
    maxFileSize: 10 * 1024 * 1024, // 10MB
  },
  
  ui: {
    theme: 'auto' as const,
    showTimestamps: false,
    showAvatars: true,
    compactMode: false,
    showWordCount: false,
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
    agentSelector: {
      ...defaultChatConfig.agentSelector,
      ...userConfig.agentSelector,
    },
    customComponent: userConfig.customComponent || defaultChatConfig.customComponent,
    headerActions: userConfig.headerActions || defaultChatConfig.headerActions,
  };
}

// Predefined configuration presets
export const chatConfigPresets = {
  minimal: {
    features: {
      enableThreads: false,
      enableFileUpload: false,
      enableAudioRecording: false,
      enableMessageEditing: false,
      enableMessageCopy: true,
      enableRegeneration: true,
      enableToolCallsDisplay: false,
    },
    ui: {
      compactMode: true,
      showTimestamps: false,
      showAvatars: false,
    },
  } as Partial<ChatConfig>,

  full: {
    features: {
      enableThreads: true,
      enableFileUpload: true,
      enableAudioRecording: true,
      enableMessageEditing: true,
      enableMessageCopy: true,
      enableRegeneration: true,
      enableToolCallsDisplay: true,
    },
    ui: {
      showTimestamps: true,
      showAvatars: true,
      compactMode: false,
      showWordCount: true,
    },
  } as Partial<ChatConfig>,

  developer: {
    features: {
      enableThreads: true,
      enableFileUpload: true,
      enableAudioRecording: false,
      enableMessageEditing: true,
      enableMessageCopy: true,
      enableRegeneration: true,
      enableToolCallsDisplay: true,
    },
    ui: {
      showTimestamps: true,
      showAvatars: true,
      compactMode: false,
      showWordCount: true,
    },
  } as Partial<ChatConfig>,

  customer_support: {
    branding: {
      title: 'Customer Support',
      subtitle: 'How can I help you today?',
    },
    features: {
      enableThreads: true,
      enableFileUpload: true,
      enableAudioRecording: false,
      enableMessageEditing: false,
      enableMessageCopy: true,
      enableRegeneration: false,
      enableToolCallsDisplay: false,
    },
    ui: {
      showTimestamps: true,
      showAvatars: true,
      compactMode: false,
    },
  } as Partial<ChatConfig>,
} as const;

// Configuration validation
export function validateConfig(config: ChatConfig): string[] {
  const errors: string[] = [];

  // Validate features
  if (config.features?.maxAttachments && config.features.maxAttachments < 1) {
    errors.push('maxAttachments must be at least 1');
  }

  if (config.features?.maxFileSize && config.features.maxFileSize < 1024) {
    errors.push('maxFileSize must be at least 1024 bytes (1KB)');
  }

  // Validate branding
  if (config.branding?.title && typeof config.branding.title !== 'string') {
    errors.push('branding.title must be a string');
  }

  return errors;
}

// Theme utilities
export const themeUtils = {
  getSystemTheme: (): 'light' | 'dark' => {
    if (typeof globalThis.matchMedia === 'undefined') return 'light';
    return globalThis.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  },

  resolveTheme: (theme: 'light' | 'dark' | 'auto'): 'light' | 'dark' => {
    return theme === 'auto' ? themeUtils.getSystemTheme() : theme;
  },

  applyTheme: (theme: 'light' | 'dark' | 'auto') => {
    if (typeof document === 'undefined') return;
    
    const resolvedTheme = themeUtils.resolveTheme(theme);
    document.documentElement.classList.toggle('dark', resolvedTheme === 'dark');
  },
};

// Feature flags utility
export const featureFlags = {
  isEnabled: (config: Required<ChatConfig>, feature: keyof Required<ChatConfig>['features']): boolean => {
    return config.features[feature] === true;
  },

  getEnabledFeatures: (config: Required<ChatConfig>): string[] => {
    return Object.entries(config.features)
      .filter(([_, enabled]) => enabled === true)
      .map(([feature]) => feature);
  },

  hasAnyFeature: (config: Required<ChatConfig>, features: (keyof Required<ChatConfig>['features'])[]): boolean => {
    return features.some(feature => featureFlags.isEnabled(config, feature));
  },
};

// Configuration hooks for React components
export const configUtils = {
  createConfigHook: (config: Required<ChatConfig>) => {
    return {
      config,
      isFeatureEnabled: (feature: keyof Required<ChatConfig>['features']) => 
        featureFlags.isEnabled(config, feature),
      getLabel: (key: keyof Required<ChatConfig>['labels']) => 
        config.labels[key],
      getBranding: () => config.branding,
      getUI: () => config.ui,
    };
  },
};
