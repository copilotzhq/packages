import * as React from 'react';
import React__default, { ReactNode } from 'react';
import * as react_jsx_runtime from 'react/jsx-runtime';
import { ClassValue } from 'clsx';

type MediaAttachment = {
    kind: 'image';
    dataUrl: string;
    mimeType: string;
    fileName?: string;
    size?: number;
} | {
    kind: 'audio';
    dataUrl: string;
    mimeType: string;
    durationMs?: number;
    fileName?: string;
    size?: number;
} | {
    kind: 'video';
    dataUrl: string;
    mimeType: string;
    durationMs?: number;
    fileName?: string;
    size?: number;
    poster?: string;
};
interface ToolCall {
    id: string;
    name: string;
    arguments: Record<string, any>;
    result?: any;
    status: 'pending' | 'running' | 'completed' | 'failed';
    startTime?: number;
    endTime?: number;
}
interface ChatMessage {
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
}
interface ChatThread {
    id: string;
    title: string;
    createdAt: number;
    updatedAt: number;
    messageCount: number;
    isArchived?: boolean;
    metadata?: Record<string, any>;
}
interface ChatConfig {
    branding?: {
        logo?: ReactNode;
        title?: string;
        subtitle?: string;
        avatar?: ReactNode;
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
        recordAudio?: string;
        recordAudioTooltip?: string;
        exportData?: string;
        importData?: string;
        clearAll?: string;
        sidebarToggle?: string;
        customComponentToggle?: string;
        settings?: string;
        toggleDarkMode?: string;
        lightMode?: string;
        darkMode?: string;
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
        maxFileSize?: number;
    };
    ui?: {
        theme?: 'light' | 'dark' | 'auto';
        showTimestamps?: boolean;
        showAvatars?: boolean;
        compactMode?: boolean;
        showWordCount?: boolean;
    };
    customComponent?: {
        label?: string;
        icon?: ReactNode;
        /** Static component or render function receiving panel props */
        component?: ReactNode | ((props: {
            onClose: () => void;
            isMobile: boolean;
        }) => ReactNode);
    };
    /** Additional actions to render in the header */
    headerActions?: ReactNode;
}
interface StateCallback<T = unknown> {
    setState: (state: T | ((prev: T) => T)) => void;
    getState: () => T;
}
interface ChatCallbacks {
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
    onViewProfile?: () => void;
    onOpenSettings?: () => void;
    onThemeChange?: (theme: 'light' | 'dark' | 'system') => void;
    onLogout?: () => void;
}
interface ChatV2Props {
    messages?: ChatMessage[];
    threads?: ChatThread[];
    currentThreadId?: string | null;
    config?: ChatConfig;
    sidebar?: ReactNode;
    isGenerating?: boolean;
    callbacks?: ChatCallbacks;
    user?: {
        id: string;
        name?: string;
        avatar?: string;
        email?: string;
    };
    assistant?: {
        name?: string;
        avatar?: ReactNode;
        description?: string;
    };
    suggestions?: string[];
    enabledFeatures?: string[];
    className?: string;
    onAddMemory?: (content: string, category?: MemoryItem['category']) => void;
    onUpdateMemory?: (memoryId: string, content: string) => void;
    onDeleteMemory?: (memoryId: string) => void;
}
interface ChatState {
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
type MessageAction = 'copy' | 'edit' | 'delete' | 'regenerate' | 'retry';
interface MessageActionEvent {
    action: MessageAction;
    messageId: string;
    content?: string;
}
interface FileUploadProgress {
    fileName: string;
    progress: number;
    status: 'uploading' | 'completed' | 'failed';
}
interface StreamingUpdate {
    messageId: string;
    delta: string;
    isComplete?: boolean;
}
interface UserCustomField {
    key: string;
    label: string;
    value: string | number | boolean | null | undefined;
    type?: 'text' | 'email' | 'phone' | 'url' | 'date' | 'number' | 'boolean';
    icon?: ReactNode;
}
interface MemoryItem {
    id: string;
    content: string;
    category?: 'preference' | 'fact' | 'goal' | 'context' | 'other';
    source: 'agent' | 'user';
    createdAt: string;
    updatedAt?: string;
}
interface ChatUserContext extends Record<string, unknown> {
    /** Custom fields defined by the login component, shown in built-in user profile */
    customFields?: UserCustomField[] | Record<string, unknown>;
    /** Persistent memories about the user */
    memories?: {
        items?: MemoryItem[];
    };
}

declare const ChatUI: React__default.FC<ChatV2Props>;

interface ChatHeaderConfig {
    branding?: {
        logo?: ReactNode;
        title?: string;
        subtitle?: string;
    };
    labels?: {
        newThread?: string;
        exportData?: string;
        importData?: string;
        clearAll?: string;
        sidebarToggle?: string;
        customComponentToggle?: string;
        settings?: string;
        toggleDarkMode?: string;
        lightMode?: string;
        darkMode?: string;
    };
    customComponent?: {
        label?: string;
        icon?: ReactNode;
        onClick?: () => void;
    };
    /** Additional actions to render in the header (before the settings menu) */
    headerActions?: ReactNode;
}
interface ChatHeaderProps {
    config: ChatHeaderConfig;
    currentThreadTitle?: string | null;
    onSidebarToggle?: () => void;
    onCustomComponentToggle?: () => void;
    onNewThread?: () => void;
    onExportData?: () => void;
    onImportData?: (file: File) => void;
    onClearAll?: () => void;
    showCustomComponentButton?: boolean;
    isMobile?: boolean;
    className?: string;
}
declare const ChatHeader: React__default.FC<ChatHeaderProps>;

interface ChatInputProps {
    value: string;
    onChange: (value: string) => void;
    onSubmit: (content: string, attachments: MediaAttachment[]) => void;
    attachments: MediaAttachment[];
    onAttachmentsChange: (attachments: MediaAttachment[]) => void;
    placeholder?: string;
    disabled?: boolean;
    isGenerating?: boolean;
    onStopGeneration?: () => void;
    enableFileUpload?: boolean;
    enableAudioRecording?: boolean;
    maxAttachments?: number;
    maxFileSize?: number;
    acceptedFileTypes?: string[];
    className?: string;
    config?: ChatConfig;
}
declare const ChatInput: React__default.FC<ChatInputProps>;

interface MessageProps {
    message: ChatMessage;
    isUser?: boolean;
    userAvatar?: string;
    userName?: string;
    assistantAvatar?: React__default.ReactNode;
    assistantName?: string;
    showTimestamp?: boolean;
    showAvatar?: boolean;
    enableCopy?: boolean;
    enableEdit?: boolean;
    enableRegenerate?: boolean;
    enableToolCallsDisplay?: boolean;
    compactMode?: boolean;
    onAction?: (event: MessageActionEvent) => void;
    className?: string;
    toolUsedLabel?: string;
    thinkingLabel?: string;
}
declare const Message: React__default.FC<MessageProps>;

declare function Sidebar$1({ side, variant, collapsible, className, children, ...props }: React.ComponentProps<"div"> & {
    side?: "left" | "right";
    variant?: "sidebar" | "floating" | "inset";
    collapsible?: "offcanvas" | "icon" | "none";
}): react_jsx_runtime.JSX.Element;

interface UserMenuConfig {
    labels?: {
        profile?: string;
        settings?: string;
        theme?: string;
        lightMode?: string;
        darkMode?: string;
        systemTheme?: string;
        logout?: string;
        guest?: string;
    };
}
interface UserMenuUser {
    id: string;
    name?: string;
    email?: string;
    avatar?: string;
}
interface UserMenuCallbacks {
    onViewProfile?: () => void;
    onOpenSettings?: () => void;
    onThemeChange?: (theme: 'light' | 'dark' | 'system') => void;
    onLogout?: () => void;
}
interface UserMenuProps {
    user?: UserMenuUser | null;
    config?: UserMenuConfig;
    callbacks?: UserMenuCallbacks;
    currentTheme?: 'light' | 'dark' | 'system';
    /** Show theme options in the menu */
    showThemeOptions?: boolean;
    /** Additional menu items to render */
    additionalItems?: React__default.ReactNode;
}
declare const UserMenu: React__default.FC<UserMenuProps>;

interface SidebarConfig {
    labels?: {
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
        deleteThread?: string;
        today?: string;
        yesterday?: string;
        createNewThread?: string;
        threadNamePlaceholder?: string;
        cancel?: string;
        create?: string;
        daysAgo?: string;
    };
    branding?: {
        logo?: React__default.ReactNode;
        title?: React__default.ReactNode;
        subtitle?: React__default.ReactNode;
    };
    userMenu?: UserMenuConfig;
}
interface SidebarProps extends React__default.ComponentProps<typeof Sidebar$1> {
    threads: ChatThread[];
    currentThreadId?: string | null;
    config: SidebarConfig;
    onCreateThread?: (title?: string) => void;
    onSelectThread?: (threadId: string) => void;
    onRenameThread?: (threadId: string, newTitle: string) => void;
    onDeleteThread?: (threadId: string) => void;
    onArchiveThread?: (threadId: string) => void;
    user?: UserMenuUser | null;
    userMenuCallbacks?: UserMenuCallbacks;
    currentTheme?: 'light' | 'dark' | 'system';
    showThemeOptions?: boolean;
    /** Additional items to render in the user menu */
    userMenuAdditionalItems?: React__default.ReactNode;
}
declare const Sidebar: React__default.FC<SidebarProps>;

interface ThreadManagerProps {
    threads: ChatThread[];
    currentThreadId?: string | null;
    config?: ChatConfig;
    onCreateThread?: (title?: string) => void;
    onSelectThread?: (threadId: string) => void;
    onRenameThread?: (threadId: string, newTitle: string) => void;
    onDeleteThread?: (threadId: string) => void;
    onArchiveThread?: (threadId: string) => void;
    isOpen?: boolean;
    onClose?: () => void;
    className?: string;
}
declare const ThreadManager: React__default.FC<ThreadManagerProps>;

type Setter = (next: Partial<ChatUserContext> | ((prev: ChatUserContext) => Partial<ChatUserContext>)) => void;
interface ChatUserContextValue {
    context: ChatUserContext;
    setContext: Setter;
    resetContext: () => void;
}
declare const ChatUserContextProvider: React__default.FC<{
    children: React__default.ReactNode;
    initial?: Partial<ChatUserContext>;
}>;
declare function useChatUserContext(): ChatUserContextValue;

interface UserProfileConfig {
    labels?: {
        title?: string;
        basicInfo?: string;
        customFields?: string;
        memories?: string;
        addMemory?: string;
        noMemories?: string;
        close?: string;
        noCustomFields?: string;
    };
}
interface UserProfileUser {
    id: string;
    name?: string;
    email?: string;
    avatar?: string;
}
interface CustomField {
    key: string;
    label: string;
    value: string | number | boolean | null | undefined;
    type?: 'text' | 'email' | 'phone' | 'url' | 'date' | 'number' | 'boolean';
    icon?: React__default.ReactNode;
}
interface UserProfileProps {
    isOpen: boolean;
    onClose: () => void;
    user?: UserProfileUser | null;
    /** Custom fields from userContext.customFields */
    customFields?: CustomField[] | Record<string, unknown>;
    /** User memories */
    memories?: MemoryItem[];
    config?: UserProfileConfig;
    /** Called when user wants to edit their profile */
    onEditProfile?: () => void;
    /** Called when user wants to logout */
    onLogout?: () => void;
    /** Called when user adds a memory */
    onAddMemory?: (content: string, category?: MemoryItem['category']) => void;
    /** Called when user updates a memory */
    onUpdateMemory?: (memoryId: string, content: string) => void;
    /** Called when user deletes a memory */
    onDeleteMemory?: (memoryId: string) => void;
    className?: string;
}
declare const UserProfile: React__default.FC<UserProfileProps>;

declare const defaultChatConfig: Required<ChatConfig>;
declare function mergeConfig(_baseConfig: ChatConfig, userConfig?: Partial<ChatConfig>): Required<ChatConfig>;
declare const chatConfigPresets: {
    readonly minimal: Partial<ChatConfig>;
    readonly full: Partial<ChatConfig>;
    readonly developer: Partial<ChatConfig>;
    readonly customer_support: Partial<ChatConfig>;
};
declare function validateConfig(config: ChatConfig): string[];
declare const themeUtils: {
    getSystemTheme: () => "light" | "dark";
    resolveTheme: (theme: "light" | "dark" | "auto") => "light" | "dark";
    applyTheme: (theme: "light" | "dark" | "auto") => void;
};
declare const featureFlags: {
    isEnabled: (config: Required<ChatConfig>, feature: keyof Required<ChatConfig>["features"]) => boolean;
    getEnabledFeatures: (config: Required<ChatConfig>) => string[];
    hasAnyFeature: (config: Required<ChatConfig>, features: (keyof Required<ChatConfig>["features"])[]) => boolean;
};
declare const configUtils: {
    createConfigHook: (config: Required<ChatConfig>) => {
        config: Required<ChatConfig>;
        isFeatureEnabled: (feature: keyof Required<ChatConfig>["features"]) => boolean;
        getLabel: (key: keyof Required<ChatConfig>["labels"]) => string | undefined;
        getBranding: () => {
            logo?: React.ReactNode;
            title?: string;
            subtitle?: string;
            avatar?: React.ReactNode;
        };
        getUI: () => {
            theme?: "light" | "dark" | "auto";
            showTimestamps?: boolean;
            showAvatars?: boolean;
            compactMode?: boolean;
            showWordCount?: boolean;
        };
    };
};

declare function cn(...inputs: ClassValue[]): string;
declare const formatDate: (timestamp: number, labels?: ChatConfig["labels"]) => string;

declare const chatUtils: {
    generateId: () => string;
    generateMessageId: () => string;
    generateThreadId: () => string;
    createMessage: (role: "user" | "assistant" | "system", content: string, attachments?: MediaAttachment[]) => ChatMessage;
    createThread: (title: string) => ChatThread;
    generateThreadTitle: (firstMessage: string) => string;
};

export { type ChatCallbacks, type ChatConfig, ChatHeader, type ChatHeaderConfig, type ChatHeaderProps, ChatInput, type ChatMessage, type ChatState, type ChatThread, ChatUI, type ChatUserContext, ChatUserContextProvider, type ChatV2Props, type CustomField, type FileUploadProgress, type MediaAttachment, type MemoryItem, Message, type MessageAction, type MessageActionEvent, Sidebar, type SidebarConfig, type SidebarProps, type StateCallback, type StreamingUpdate, ThreadManager, type ToolCall, type UserCustomField, UserMenu, type UserMenuCallbacks, type UserMenuConfig, type UserMenuProps, type UserMenuUser, UserProfile, type UserProfileConfig, type UserProfileProps, type UserProfileUser, chatConfigPresets, chatUtils, cn, configUtils, defaultChatConfig, featureFlags, formatDate, mergeConfig, themeUtils, useChatUserContext, validateConfig };
