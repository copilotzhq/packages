import React from 'react';
import { ChatUserContext, ChatConfig, ChatCallbacks, MemoryItem, ChatMessage, ChatThread, MediaAttachment } from '@copilotz/chat-ui';
export { ChatCallbacks, ChatConfig, ChatMessage, ChatThread, ChatUserContext, MediaAttachment, MemoryItem } from '@copilotz/chat-ui';

interface CopilotzChatProps {
    userId: string;
    userName?: string;
    userAvatar?: string;
    userEmail?: string;
    initialContext?: ChatUserContext;
    bootstrap?: {
        initialMessage?: string;
        initialToolCalls?: Array<{
            name: string;
            args: Record<string, unknown>;
        }>;
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
    customComponent?: React.ReactNode | ((context: ChatUserContext) => React.ReactNode) | ((props: {
        onClose: () => void;
        isMobile: boolean;
    }) => React.ReactNode);
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
declare const CopilotzChat: React.FC<CopilotzChatProps>;

interface UseCopilotzOptions {
    userId: string | null;
    initialContext?: ChatUserContext;
    bootstrap?: {
        initialMessage?: string;
        initialToolCalls?: Array<{
            name: string;
            args: Record<string, unknown>;
        }>;
    };
    defaultThreadName?: string;
    onToolOutput?: (output: Record<string, unknown>) => void;
}
declare function useCopilotz({ userId, initialContext, bootstrap, defaultThreadName, onToolOutput }: UseCopilotzOptions): {
    messages: ChatMessage[];
    threads: ChatThread[];
    currentThreadId: string | null;
    isStreaming: boolean;
    userContextSeed: Partial<ChatUserContext>;
    sendMessage: (content: string, attachments?: MediaAttachment[]) => Promise<void>;
    createThread: (title?: string) => void;
    selectThread: (threadId: string) => Promise<void>;
    renameThread: (threadId: string, newTitle: string) => Promise<void>;
    archiveThread: (threadId: string) => Promise<void>;
    deleteThread: (threadId: string) => Promise<void>;
    stopGeneration: () => void;
    fetchAndSetThreadsState: (uid: string, preferredExternalId?: string | null) => Promise<string | null | undefined>;
    loadThreadMessages: (threadId: string) => Promise<void>;
    reset: () => void;
};

type RestThread = {
    id: string;
    name?: string | null;
    externalId?: string | null;
    description?: string | null;
    participants?: string[] | null;
    status?: string | null;
    metadata?: Record<string, unknown> | null;
    createdAt?: string;
    updatedAt?: string;
};
type RestMessage = {
    id: string;
    threadId: string;
    senderId?: string | null;
    senderType: string;
    senderUserId?: string | null;
    content?: string | null;
    metadata?: Record<string, unknown> | null;
    toolCalls?: Array<Record<string, unknown>> | null;
    createdAt?: string;
    updatedAt?: string;
};
type StreamCallbacks = {
    onToken?: (token: string, isComplete: boolean, raw?: any) => void;
    onMessageEvent?: (payload: any) => void;
    onAssetEvent?: (payload: any) => void;
    signal?: AbortSignal;
};
type RunOptions = {
    threadId?: string;
    threadExternalId?: string;
    content: string;
    user: {
        externalId: string;
        name?: string;
        email?: string;
        metadata?: Record<string, unknown>;
    };
    attachments?: MediaAttachment[];
    metadata?: Record<string, unknown>;
    threadMetadata?: Record<string, unknown>;
    toolCalls?: Array<{
        name: string;
        args: Record<string, unknown>;
        id?: string;
    }>;
} & StreamCallbacks;
type CopilotzStreamResult = {
    text: string;
    messages: any[];
    media: Record<string, string> | null;
};
declare function runCopilotzStream(options: RunOptions): Promise<CopilotzStreamResult>;
declare function fetchThreads(userId: string): Promise<RestThread[]>;
declare function fetchThreadMessages(threadId: string): Promise<RestMessage[]>;
declare function updateThread(threadId: string, updates: Partial<RestThread>): Promise<any>;
declare function deleteMessagesByThreadId(threadId: string): Promise<void>;
declare function deleteThread(threadId: string): Promise<boolean>;
declare const copilotzService: {
    runCopilotzStream: typeof runCopilotzStream;
    fetchThreads: typeof fetchThreads;
    fetchThreadMessages: typeof fetchThreadMessages;
    updateThread: typeof updateThread;
    deleteThread: typeof deleteThread;
};

declare function getAssetDataUrl(refOrId: string): Promise<{
    dataUrl: string;
    mime?: string;
    assetId: string;
}>;
type WithMetadata = {
    metadata?: Record<string, unknown> | null;
};
declare function resolveAssetsInMessages<T extends WithMetadata>(messages: T[]): Promise<T[]>;

export { CopilotzChat, type CopilotzStreamResult, copilotzService, deleteMessagesByThreadId, deleteThread, fetchThreadMessages, fetchThreads, getAssetDataUrl, resolveAssetsInMessages, runCopilotzStream, updateThread, useCopilotz };
