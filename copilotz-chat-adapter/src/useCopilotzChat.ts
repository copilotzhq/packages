// deno-lint-ignore-file no-explicit-any
import { useState, useCallback, useRef, useEffect } from 'react';
import { runCopilotzStream, fetchThreads, fetchThreadMessagesPage, fetchThreadActivity, updateThread as updateThreadApi, editThreadMessage, deleteThread as deleteThreadApi } from './copilotzService';
import { getAttachmentKindFromMimeType, getMimeTypeFromDataUrl } from '@copilotz/chat-ui';
import type { AgentOption, AssistantActivityBlock, ChatMessage as ChatViewMessage, ChatSender, ChatThread, ChatThreadTag, MediaAttachment, ChatUserContext } from '@copilotz/chat-ui';
import { useUrlState } from './useUrlState';
import type { EventInterceptor, RunErrorInterceptor, SpecialChatState } from './specialState';
import type { RequestHeadersProvider, RestMessage, RestMessagePageInfo, ThreadActivityStatus } from './copilotzService';
import { closeAssistantMessage, hasVisibleAssistantOutput, type InternalChatMessage, toPublicChatMessage } from './activity';
import { resolveAgentSender, resolveAssistantFallbackSender, resolveLiveEventSender, resolveUserSender, type SenderResolutionOptions } from './senders';
import { isInternalMessageMetadata, prepareHydratedMessages } from './messageContract';
import {
  getLlmAttemptId,
  getStreamEventPayload,
  getVisibleLlmResultAnswer,
  isTerminalEmptyLlmResultEvent,
} from './streamEvents';
import { canAttachToStreamingAssistant, extractLiveToolCall, extractLiveToolCallDelta, extractLiveToolResultUpdate, mergePersistedToolResults, matchesToolResultUpdate, prependUniqueMessages, type ToolResultUpdate } from './toolActivity';
import { isSameThreadIdentity } from './threadIdentity';
import { CLIENT_MESSAGE_ID_METADATA_KEY, reconcileThreadMessages } from './messageReconciliation';
import { applyLiveRunOperations, createLiveRunState, getLatestLiveRunMessageId, transitionLiveRun, type LiveRunAction } from './liveRun';
import { ToolCallDraftStore } from './toolCallDraftStore';

const nowTs = () => Date.now();
const generateId = () => (globalThis.crypto?.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`) as string;
const isAbortError = (error: unknown) => (error instanceof DOMException && error.name === 'AbortError') || (typeof error === 'object' && error !== null && 'name' in error && (error as { name?: string }).name === 'AbortError');
const getEventPayload = (event: any): any => getStreamEventPayload(event) as any;
const getEventSenderType = (payload: any): string | undefined => payload?.senderType || payload?.sender?.type;
const getEventTimestamp = (event: any): number => {
  const timestamp = typeof event?.createdAt === 'string'
    ? new Date(event.createdAt).getTime()
    : NaN;
  return Number.isFinite(timestamp) ? timestamp : nowTs();
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

const normalizeThreadTag = (value: unknown): ChatThreadTag | null => {
  if (!isRecord(value)) return null;
  const id = typeof value.id === 'string' ? value.id.trim() : '';
  const name = typeof value.name === 'string' ? value.name.trim() : '';
  const color = typeof value.color === 'string' && value.color.trim() ? value.color.trim() : undefined;
  if (!id || !name) return null;
  return color ? { id, name, color } : { id, name };
};

const getThreadTagsFromMetadata = (metadata: unknown): ChatThreadTag[] => {
  if (!isRecord(metadata) || !isRecord(metadata.public)) return [];
  const tags = metadata.public.tags;
  if (!Array.isArray(tags)) return [];
  return tags.map(normalizeThreadTag).filter((tag): tag is ChatThreadTag => !!tag);
};

const patchMetadataPublicTags = (metadata: Record<string, unknown> | undefined, tags: ChatThreadTag[]): Record<string, unknown> => ({
  ...(metadata ?? {}),
  public: {
    ...(isRecord(metadata?.public) ? metadata.public : {}),
    tags,
  },
});

type ServerThread = Awaited<ReturnType<typeof fetchThreads>>[number];
type ServerMessage = RestMessage;

const THREAD_MESSAGES_PAGE_SIZE = 50;

const createEmptyMessagePageInfo = (): RestMessagePageInfo => ({
  hasMoreBefore: false,
  oldestMessageId: null,
  newestMessageId: null,
});

const createPendingAssistantActivity = (messageId: string): AssistantActivityBlock => ({
  items: [
    {
      id: `${messageId}:pending`,
      kind: 'answering',
      status: 'active',
      startedAt: nowTs(),
    },
  ],
});

const getCurrentUserDisplayName = (explicitName: string | undefined, fallbackId: string): string => explicitName?.trim() || fallbackId;

export interface UseCopilotzOptions {
  userId: string | null;
  userName?: string;
  userAvatar?: string;
  assistantName?: string;
  agentOptions?: AgentOption[];
  initialContext?: ChatUserContext;
  bootstrap?: {
    initialMessage?: string;
    initialToolCalls?: Array<{ name: string; args: Record<string, unknown> }>;
  };
  defaultThreadName?: string;
  onToolOutput?: (output: Record<string, unknown>) => void;
  preferredAgentName?: string | null;
  /** Agent participants in the thread (multi-agent). When set, overrides preferredAgentName for thread.participants. */
  participants?: string[] | null;
  /** Explicit target agent for each message. When set, maps to MessagePayload.target. */
  targetAgentName?: string | null;
  getRequestHeaders?: RequestHeadersProvider;
  eventInterceptor?: EventInterceptor;
  runErrorInterceptor?: RunErrorInterceptor;
}

export function useCopilotz({ userId, userName, userAvatar, assistantName, agentOptions = [], initialContext, bootstrap, defaultThreadName, onToolOutput, preferredAgentName, participants, targetAgentName, getRequestHeaders, eventInterceptor, runErrorInterceptor }: UseCopilotzOptions) {
  // URL state — thread ID is synced to/from URL by default
  const { state: urlState, setThreadId: setUrlThreadId, isEnabled: isUrlSyncEnabled } = useUrlState();

  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [threadMetadataMap, setThreadMetadataMap] = useState<Record<string, Record<string, unknown> | undefined>>({});
  const [threadExternalIdMap, setThreadExternalIdMap] = useState<Record<string, string | null>>({});

  const [currentThreadId, setCurrentThreadId] = useState<string | null>(null);
  const [currentThreadExternalId, setCurrentThreadExternalId] = useState<string | null>(null);

  const [messages, setMessages] = useState<InternalChatMessage[]>([]);
  const [isMessagesLoading, setIsMessagesLoading] = useState(false);
  const [isLoadingOlderMessages, setIsLoadingOlderMessages] = useState(false);
  const [messagePageInfo, setMessagePageInfo] = useState<RestMessagePageInfo>(createEmptyMessagePageInfo);
  const [isStreaming, setIsStreaming] = useState(false);
  const [threadActivityStatus, setThreadActivityStatus] = useState<ThreadActivityStatus>('idle');
  const [isRecoveringStream, setIsRecoveringStream] = useState(false);
  const [specialState, setSpecialState] = useState<SpecialChatState | null>(null);

  const [userContextSeed, setUserContextSeed] = useState<Partial<ChatUserContext>>(initialContext || {});
  const preferredAgentRef = useRef<string | null>(preferredAgentName ?? null);
  const participantsRef = useRef<string[] | null>(participants ?? null);
  const targetAgentNameRef = useRef<string | null>(targetAgentName ?? null);

  // Refs to hold latest state for callbacks to avoid dependency cycles
  // Using direct assignment pattern instead of useEffect for better performance
  const threadsRef = useRef(threads);
  const threadMetadataMapRef = useRef(threadMetadataMap);
  const threadExternalIdMapRef = useRef(threadExternalIdMap);
  const currentThreadIdRef = useRef(currentThreadId);
  const currentThreadExternalIdRef = useRef(currentThreadExternalId);
  const userContextSeedRef = useRef(userContextSeed);
  const messagePageInfoRef = useRef(messagePageInfo);
  const isLoadingOlderMessagesRef = useRef(isLoadingOlderMessages);
  const isStreamingRef = useRef(isStreaming);
  const threadActivityStatusRef = useRef(threadActivityStatus);
  const isRecoveringStreamRef = useRef(isRecoveringStream);
  const senderOptionsRef = useRef<SenderResolutionOptions>({
    agents: agentOptions,
    user: userId ? { id: userId, name: userName, avatarUrl: userAvatar } : null,
    assistantName,
  });
  const persistedToolUpdatesRef = useRef<ToolResultUpdate[]>([]);
  const stopRequestedRef = useRef(false);
  const recoveryPollGenerationRef = useRef(0);
  const toolCallDraftStoreRef = useRef<ToolCallDraftStore | null>(null);
  if (!toolCallDraftStoreRef.current) {
    toolCallDraftStoreRef.current = new ToolCallDraftStore();
  }
  const toolCallDraftStore = toolCallDraftStoreRef.current;

  // Sync refs on every render (more efficient than multiple useEffects)
  threadsRef.current = threads;
  threadMetadataMapRef.current = threadMetadataMap;
  threadExternalIdMapRef.current = threadExternalIdMap;
  currentThreadIdRef.current = currentThreadId;
  currentThreadExternalIdRef.current = currentThreadExternalId;
  userContextSeedRef.current = userContextSeed;
  messagePageInfoRef.current = messagePageInfo;
  isLoadingOlderMessagesRef.current = isLoadingOlderMessages;
  isStreamingRef.current = isStreaming;
  threadActivityStatusRef.current = threadActivityStatus;
  isRecoveringStreamRef.current = isRecoveringStream;
  senderOptionsRef.current = {
    agents: agentOptions,
    user: userId ? { id: userId, name: userName, avatarUrl: userAvatar } : null,
    assistantName,
  };
  preferredAgentRef.current = preferredAgentName ?? null;
  participantsRef.current = participants ?? null;
  targetAgentNameRef.current = targetAgentName ?? null;

  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesRequestRef = useRef<number>(0);
  // Guard to prevent double initialization in StrictMode
  const initializationRef = useRef<{ userId: string | null; started: boolean }>({ userId: null, started: false });

  useEffect(() => {
    if (initialContext) {
      setUserContextSeed((prev) => ({ ...prev, ...initialContext }));
    }
  }, [initialContext]);

  useEffect(() => () => toolCallDraftStore.clear(), [toolCallDraftStore]);

  const processToolOutput = useCallback(
    (output: Record<string, unknown>) => {
      if (!output) return;

      const contextPatch: Partial<ChatUserContext> = {};

      // Generic merge of userContext from output if present
      if (output.userContext && typeof output.userContext === 'object') {
        Object.assign(contextPatch, output.userContext as Partial<ChatUserContext>);
      }

      if (Object.keys(contextPatch).length > 0) {
        setUserContextSeed((prev) => ({ ...prev, ...contextPatch }));
      }

      onToolOutput?.(output);
    },
    [onToolOutput]
  );

  const clearSpecialState = useCallback(() => {
    setSpecialState(null);
  }, []);

  const applyEventInterceptor = useCallback(
    (event: unknown) => {
      if (!eventInterceptor) return undefined;
      try {
        const result = eventInterceptor(event);
        if (result?.specialState) {
          setSpecialState(result.specialState);
        }
        return result;
      } catch (error) {
        console.error('Error in Copilotz event interceptor', error);
        return undefined;
      }
    },
    [eventInterceptor]
  );

  const getSpecialStateFromError = useCallback(
    (error: unknown) => {
      if (!runErrorInterceptor) return null;
      try {
        return runErrorInterceptor(error) ?? null;
      } catch (interceptorError) {
        console.error('Error in Copilotz run error interceptor', interceptorError);
        return null;
      }
    },
    [runErrorInterceptor]
  );

  const handleStreamMessageEvent = useCallback((event: any) => {
    const payload = getEventPayload(event);
    if (!payload) return;
    const liveMetadata = (event?.metadata && typeof event.metadata === 'object' ? event.metadata : payload?.metadata) as Record<string, unknown> | undefined;
    if (isInternalMessageMetadata(liveMetadata)) {
      return;
    }
    const senderType = getEventSenderType(payload);
    if (senderType !== 'agent' || typeof payload.content !== 'string') return;

    // Fallback path for custom/non-contract events that still look like an
    // assistant artifact message.
    const sender = resolveLiveEventSender(event, senderOptionsRef.current);
    const incomingAgentKey = sender.agentId ?? sender.id;

    setMessages((prev) => {
      const next = [...prev];
      for (let i = next.length - 1; i >= 0; i--) {
        const m = next[i];
        if (canAttachToStreamingAssistant(m, incomingAgentKey)) {
          next[i] = {
            ...m,
            content: payload.content,
            isStreaming: false,
            isComplete: true,
            sender,
          };
          return next;
        }
      }

      const trimmedContent = payload.content.trim();
      if (!trimmedContent) {
        return prev;
      }

      return [
        ...next,
        {
          id: generateId(),
          role: 'assistant',
          content: payload.content,
          timestamp: nowTs(),
          isStreaming: false,
          isComplete: true,
          metadata: liveMetadata,
          sender,
        } as InternalChatMessage,
      ];
    });
  }, []);

  const updateThreadsState = useCallback((rawThreads: ServerThread[], preferredExternalId?: string | null) => {
    const metadataMap: Record<string, Record<string, unknown> | undefined> = {};
    const externalMap: Record<string, string | null> = {};

    const normalized = rawThreads.map((thread) => {
      metadataMap[thread.id] = thread.metadata ?? undefined;
      externalMap[thread.id] = thread.externalId ?? null;
      const updatedAt = thread.updatedAt ? new Date(thread.updatedAt).getTime() : nowTs();
      const createdAt = thread.createdAt ? new Date(thread.createdAt).getTime() : updatedAt;
      return {
        id: thread.id,
        title: thread.name || 'Chat',
        createdAt,
        updatedAt,
        messageCount: typeof thread.metadata?.messageCount === 'number' ? (thread.metadata!.messageCount as number) : 0,
        isArchived: thread.status === 'archived',
        tags: getThreadTagsFromMetadata(thread.metadata),
        metadata: thread.metadata ?? undefined,
      } as ChatThread;
    });

    setThreadMetadataMap(metadataMap);
    setThreadExternalIdMap(externalMap);
    setThreads(normalized);

    // Use refs to avoid dependency cycle
    const curExtId = currentThreadExternalIdRef.current;
    const curId = currentThreadIdRef.current;

    let nextThreadId: string | null = null;

    if (preferredExternalId) {
      const preferred = rawThreads.find((thread) => (thread.externalId ?? thread.id) === preferredExternalId);
      if (preferred) nextThreadId = preferred.id;
    }

    if (!nextThreadId && curExtId) {
      const match = rawThreads.find((thread) => (thread.externalId ?? thread.id) === curExtId);
      if (match) nextThreadId = match.id;
    }

    if (!nextThreadId && curId && rawThreads.some((thread) => thread.id === curId)) {
      nextThreadId = curId;
    }

    if (!nextThreadId && normalized.length > 0) {
      nextThreadId = normalized[0].id;
    }

    setCurrentThreadId(nextThreadId ?? null);
    setCurrentThreadExternalId(nextThreadId ? externalMap[nextThreadId] ?? null : null);

    return nextThreadId;
  }, []); // No dependencies needed now as we use refs for reading current state

  const fetchAndSetThreadsState = useCallback(
    async (uid: string, preferredExternalId?: string | null) => {
      try {
        const rawThreads = await fetchThreads(uid, getRequestHeaders);
        return updateThreadsState(rawThreads, preferredExternalId);
      } catch (error) {
        if (isAbortError(error)) return;
        console.error('Error loading threads', error);
        return null;
      }
    },
    [updateThreadsState, getRequestHeaders]
  );

  const prepareThreadMessages = useCallback(
    async (rawMessages: ServerMessage[]) => {
      return prepareHydratedMessages(rawMessages, {
        senderOptions: senderOptionsRef.current,
        createId: generateId,
        now: nowTs,
        onToolOutput: processToolOutput,
        getRequestHeaders,
      });
    },
    [getRequestHeaders, processToolOutput]
  );

  const loadThreadMessages = useCallback(
    async (threadId: string) => {
      const requestId = messagesRequestRef.current + 1;
      messagesRequestRef.current = requestId;
      setIsMessagesLoading(true);
      setIsLoadingOlderMessages(false);
      setMessagePageInfo(createEmptyMessagePageInfo());
      persistedToolUpdatesRef.current = [];
      try {
        const page = await fetchThreadMessagesPage(threadId, { limit: THREAD_MESSAGES_PAGE_SIZE }, getRequestHeaders);
        const { viewMessages, toolResultUpdates } = await prepareThreadMessages(page.data);
        if (messagesRequestRef.current !== requestId) return;

        persistedToolUpdatesRef.current = toolResultUpdates;
        const hydratedMessages = mergePersistedToolResults(viewMessages, persistedToolUpdatesRef.current);
        setMessages(hydratedMessages);
        setMessagePageInfo(page.pageInfo);
      } catch (error) {
        if (isAbortError(error)) return;
        console.error(`Error loading messages for thread ${threadId}`, error);
        persistedToolUpdatesRef.current = [];
        setMessagePageInfo(createEmptyMessagePageInfo());
      } finally {
        if (messagesRequestRef.current === requestId) {
          setIsMessagesLoading(false);
        }
      }
    },
    [getRequestHeaders, prepareThreadMessages]
  );

  const refreshThreadMessages = useCallback(
    async (threadId: string) => {
      const requestId = messagesRequestRef.current;

      try {
        const page = await fetchThreadMessagesPage(threadId, { limit: THREAD_MESSAGES_PAGE_SIZE }, getRequestHeaders);
        const { viewMessages, toolResultUpdates } = await prepareThreadMessages(page.data);
        if (messagesRequestRef.current !== requestId) return;

        persistedToolUpdatesRef.current = [
          ...persistedToolUpdatesRef.current,
          ...toolResultUpdates.filter((update) => (
            !persistedToolUpdatesRef.current.some((current) => matchesToolResultUpdate(current, update))
          )),
        ];

        const hydratedMessages = mergePersistedToolResults(viewMessages, persistedToolUpdatesRef.current);
        setMessages((prev) => {
          const reconciled = reconcileThreadMessages(prev, hydratedMessages);
          return reconciled.changed ? reconciled.messages : prev;
        });
        setMessagePageInfo((prev) => ({
          hasMoreBefore: prev.hasMoreBefore || page.pageInfo.hasMoreBefore,
          oldestMessageId: prev.oldestMessageId ?? page.pageInfo.oldestMessageId,
          newestMessageId: page.pageInfo.newestMessageId ?? prev.newestMessageId,
        }));
      } catch (error) {
        if (isAbortError(error)) return;
        console.error(`Error refreshing messages for thread ${threadId}`, error);
      }
    },
    [getRequestHeaders, prepareThreadMessages]
  );

  const loadOlderMessages = useCallback(async () => {
    const threadId = currentThreadIdRef.current;
    const pageInfo = messagePageInfoRef.current;
    const before = pageInfo.oldestMessageId;

    if (!threadId || !before || !pageInfo.hasMoreBefore || isLoadingOlderMessagesRef.current) {
      return;
    }

    const requestId = messagesRequestRef.current;
    setIsLoadingOlderMessages(true);

    try {
      const page = await fetchThreadMessagesPage(threadId, { limit: THREAD_MESSAGES_PAGE_SIZE, before }, getRequestHeaders);
      const { viewMessages, toolResultUpdates } = await prepareThreadMessages(page.data);
      if (messagesRequestRef.current !== requestId) return;

      persistedToolUpdatesRef.current = [...toolResultUpdates, ...persistedToolUpdatesRef.current];

      setMessages((prev) => mergePersistedToolResults(prependUniqueMessages(viewMessages, prev), persistedToolUpdatesRef.current));
      setMessagePageInfo(page.pageInfo);
    } catch (error) {
      if (isAbortError(error)) return;
      console.error(`Error loading older messages for thread ${threadId}`, error);
    } finally {
      if (messagesRequestRef.current === requestId) {
        setIsLoadingOlderMessages(false);
      }
    }
  }, [getRequestHeaders, prepareThreadMessages]);

  const finalizeStreamingPlaceholders = useCallback((nextActivityStatus: ThreadActivityStatus = 'idle') => {
    setThreadActivityStatus(nextActivityStatus);
    setIsRecoveringStream(false);
    setIsStreaming(false);
    setMessages((prev) => {
      const hasStreaming = prev.some((msg) => msg.isStreaming);
      if (!hasStreaming) return prev;
      return prev.map((msg) => (msg.isStreaming ? closeAssistantMessage(msg) : msg));
    });
  }, []);

  const startThreadActivityRecovery = useCallback(
    (threadId: string) => {
      const generation = ++recoveryPollGenerationRef.current;
      setThreadActivityStatus('running');
      setIsRecoveringStream(true);
      setIsStreaming(true);

      void (async () => {
        let delayMs = 2000;
        let attempts = 0;

        await refreshThreadMessages(threadId);

        while (recoveryPollGenerationRef.current === generation) {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          if (recoveryPollGenerationRef.current !== generation) return;
          if (currentThreadIdRef.current !== threadId) return;

          try {
            const activity = await fetchThreadActivity(threadId, getRequestHeaders);
            setThreadActivityStatus(activity.status);

            if (activity.status === 'running') {
              attempts += 1;
              if (attempts % 3 === 0) {
                await refreshThreadMessages(threadId);
              }
              if (attempts >= 15) {
                delayMs = 5000;
              }
              continue;
            }

            await refreshThreadMessages(threadId);
            finalizeStreamingPlaceholders(activity.status);
            return;
          } catch (error) {
            if (isAbortError(error)) return;
            attempts += 1;
            if (attempts >= 15) {
              delayMs = 5000;
            }
          }
        }
      })();
    },
    [finalizeStreamingPlaceholders, getRequestHeaders, refreshThreadMessages]
  );

  const refreshThreadActivity = useCallback(
    async (threadId: string) => {
      try {
        const activity = await fetchThreadActivity(threadId, getRequestHeaders);
        setThreadActivityStatus(activity.status);

        if (activity.status === 'running') {
          startThreadActivityRecovery(threadId);
          return;
        }

        setIsRecoveringStream(false);
        if (activity.status === 'failed') {
          await refreshThreadMessages(threadId);
        }
      } catch (error) {
        if (isAbortError(error)) return;
        console.warn('Unable to load Copilotz thread activity', error);
      }
    },
    [getRequestHeaders, refreshThreadMessages, startThreadActivityRecovery]
  );

  const handleSelectThread = useCallback(
    async (threadId: string) => {
      recoveryPollGenerationRef.current += 1;
      setThreadActivityStatus('idle');
      setIsRecoveringStream(false);
      setIsStreaming(false);
      setCurrentThreadId(threadId);
      setMessages([]);
      setMessagePageInfo(createEmptyMessagePageInfo());
      persistedToolUpdatesRef.current = [];
      // Use ref for external map to avoid re-creation
      const extMap = threadExternalIdMapRef.current;
      setCurrentThreadExternalId(extMap[threadId] ?? null);
      await loadThreadMessages(threadId);
      await refreshThreadActivity(threadId);
    },
    [loadThreadMessages, refreshThreadActivity]
  );

  const handleCreateThread = useCallback((title?: string) => {
    messagesRequestRef.current += 1;
    setIsMessagesLoading(false);
    setIsLoadingOlderMessages(false);
    recoveryPollGenerationRef.current += 1;
    setThreadActivityStatus('idle');
    setIsRecoveringStream(false);
    setIsStreaming(false);
    const id = generateId();
    const now = nowTs();
    const newThread: ChatThread = {
      id,
      title: title?.trim() || 'New Chat',
      createdAt: now,
      updatedAt: now,
      messageCount: 0,
      metadata: { pendingTitle: title?.trim() || undefined },
    };

    setThreads((prev) => [newThread, ...prev]);
    setThreadMetadataMap((prev) => ({
      ...prev,
      [id]: { pendingTitle: title?.trim() || undefined },
    }));
    setThreadExternalIdMap((prev) => ({ ...prev, [id]: id }));
    setCurrentThreadId(id);
    setCurrentThreadExternalId(id);
    setMessages([]);
    setMessagePageInfo(createEmptyMessagePageInfo());
    persistedToolUpdatesRef.current = [];
  }, []);

  const handleRenameThread = useCallback(
    async (threadId: string, newTitle: string) => {
      const trimmedTitle = newTitle.trim();
      if (!trimmedTitle) return;

      // Update local state immediately
      setThreads((prev) => prev.map((t) => (t.id === threadId ? { ...t, title: trimmedTitle, updatedAt: nowTs() } : t)));

      // Check if this is a placeholder thread (not yet persisted)
      const extMap = threadExternalIdMapRef.current;
      const isPlaceholder = extMap[threadId] === threadId;

      if (isPlaceholder) {
        // Store title in metadata for when thread is created
        setThreadMetadataMap((prev) => ({
          ...prev,
          [threadId]: { ...prev[threadId], pendingTitle: trimmedTitle },
        }));
      } else {
        // Persist to backend
        try {
          await updateThreadApi(threadId, { name: trimmedTitle }, getRequestHeaders);
        } catch (error) {
          console.error('Failed to rename thread:', error);
          // Revert on error - refetch threads
          if (userId) {
            await fetchAndSetThreadsState(userId, currentThreadExternalIdRef.current);
          }
        }
      }
    },
    [userId, fetchAndSetThreadsState, getRequestHeaders]
  );

  const handleArchiveThread = useCallback(
    async (threadId: string) => {
      // Find current archive status
      const thread = threadsRef.current.find((t) => t.id === threadId);
      if (!thread) return;

      const newArchivedStatus = !thread.isArchived;

      // Update local state immediately
      setThreads((prev) => prev.map((t) => (t.id === threadId ? { ...t, isArchived: newArchivedStatus, updatedAt: nowTs() } : t)));

      // Check if this is a placeholder thread
      const extMap = threadExternalIdMapRef.current;
      const isPlaceholder = extMap[threadId] === threadId;

      if (!isPlaceholder) {
        try {
          await updateThreadApi(threadId, { status: newArchivedStatus ? 'archived' : 'active' }, getRequestHeaders);
        } catch (error) {
          console.error('Failed to archive thread:', error);
          // Revert on error
          if (userId) {
            await fetchAndSetThreadsState(userId, currentThreadExternalIdRef.current);
          }
        }
      }
    },
    [userId, fetchAndSetThreadsState, getRequestHeaders]
  );

  const handleUpdateThreadTags = useCallback(
    async (threadId: string, tags: ChatThreadTag[]) => {
      const extMap = threadExternalIdMapRef.current;
      const currentMetadata = threadMetadataMapRef.current[threadId];
      const nextMetadata = patchMetadataPublicTags(currentMetadata, tags);

      setThreads((prev) => prev.map((thread) => (thread.id === threadId ? { ...thread, tags, metadata: nextMetadata, updatedAt: nowTs() } : thread)));
      setThreadMetadataMap((prev) => ({
        ...prev,
        [threadId]: nextMetadata,
      }));

      const isPlaceholder = extMap[threadId] === threadId;
      if (isPlaceholder) return;

      try {
        await updateThreadApi(threadId, { metadata: nextMetadata }, getRequestHeaders);
      } catch (error) {
        console.error('Failed to update thread tags:', error);
        if (userId) {
          await fetchAndSetThreadsState(userId, currentThreadExternalIdRef.current);
        }
      }
    },
    [userId, fetchAndSetThreadsState, getRequestHeaders]
  );

  const handleEditMessage = useCallback(
    async (messageId: string, content: string) => {
      const threadId = currentThreadIdRef.current;
      if (!threadId || !content.trim()) return;

      try {
        await editThreadMessage(
          threadId,
          messageId,
          content,
          getRequestHeaders,
        );
        await loadThreadMessages(threadId);
      } catch (error) {
        console.error('Failed to edit message:', error);
      }
    },
    [getRequestHeaders, loadThreadMessages]
  );

  const handleDeleteThread = useCallback(
    async (threadId: string) => {
      // Check if this is a placeholder thread
      const extMap = threadExternalIdMapRef.current;
      const isPlaceholder = extMap[threadId] === threadId;

      // Remove from local state immediately
      setThreads((prev) => prev.filter((t) => t.id !== threadId));
      setThreadMetadataMap((prev) => {
        const next = { ...prev };
        delete next[threadId];
        return next;
      });
      setThreadExternalIdMap((prev) => {
        const next = { ...prev };
        delete next[threadId];
        return next;
      });

      // If deleting current thread, switch to another
      if (currentThreadIdRef.current === threadId) {
        const remaining = threadsRef.current.filter((t) => t.id !== threadId);
        if (remaining.length > 0) {
          setCurrentThreadId(remaining[0].id);
          setCurrentThreadExternalId(extMap[remaining[0].id] ?? null);
          await loadThreadMessages(remaining[0].id);
        } else {
          setCurrentThreadId(null);
          setCurrentThreadExternalId(null);
          setMessages([]);
          setMessagePageInfo(createEmptyMessagePageInfo());
          persistedToolUpdatesRef.current = [];
        }
      }

      if (!isPlaceholder) {
        try {
          await deleteThreadApi(threadId, getRequestHeaders);
        } catch (error) {
          console.error('Failed to delete thread:', error);
          // Refetch to restore state on error
          if (userId) {
            await fetchAndSetThreadsState(userId, currentThreadExternalIdRef.current);
          }
        }
      }
    },
    [userId, fetchAndSetThreadsState, loadThreadMessages, getRequestHeaders]
  );

  const handleStop = useCallback(() => {
    stopRequestedRef.current = true;
    recoveryPollGenerationRef.current += 1;
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setThreadActivityStatus('idle');
    setIsRecoveringStream(false);
    setIsStreaming(false);
    setMessages((prev) => {
      // Check if any message needs updating before creating new array
      const hasStreaming = prev.some((msg) => msg.isStreaming);
      if (!hasStreaming) return prev;
      return prev.map((msg) => (msg.isStreaming ? closeAssistantMessage(msg) : msg));
    });
  }, []);

  const handleStreamAssetEvent = useCallback((payload: any, assistantMessageId: string) => {
    // Handle ASSET_CREATED event from copilotz
    if (!payload?.dataUrl) return;

    const mimeType = payload.mime || payload.mimeType || getMimeTypeFromDataUrl(payload.dataUrl) || 'application/octet-stream';
    const dataUrl = payload.dataUrl;
    const kind = getAttachmentKindFromMimeType(mimeType);

    const mediaAttachment: MediaAttachment = {
      kind,
      dataUrl,
      mimeType,
      ...(typeof payload.fileName === 'string' ? { fileName: payload.fileName } : {}),
      ...(typeof payload.size === 'number' ? { size: payload.size } : {}),
    };

    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === assistantMessageId
          ? {
              ...msg,
              attachments: [...(msg.attachments || []), mediaAttachment],
            }
          : msg
      )
    );
  }, []);

  const sendCopilotzMessage = useCallback(
    async (params: { threadId?: string | null; threadExternalId?: string | null; content: string; attachments?: MediaAttachment[]; metadata?: Record<string, unknown>; threadMetadata?: Record<string, unknown>; toolCalls?: Array<{ name: string; args: Record<string, unknown> }>; userId: string; userName?: string; userMetadata?: Record<string, unknown>; agentName?: string | null; assistantMessageId?: string; assistantSender?: ChatSender; onBeforeStart?: (assistantMessageId: string) => void; preserveActiveRun?: boolean }) => {
      const initialAssistantMessageId = params.assistantMessageId ?? generateId();
      let liveRunState = createLiveRunState(initialAssistantMessageId);
      const liveDraftIds = new Set<string>();
      const draftIdByToolCallId = new Map<string, string>();
      const streamOwnerThreadId = currentThreadIdRef.current;
      const streamOwnerThreadExternalId = params.threadExternalId ?? currentThreadExternalIdRef.current;
      const streamStillOwnsVisibleThread = () => isSameThreadIdentity(
        { id: streamOwnerThreadId, externalId: streamOwnerThreadExternalId },
        { id: currentThreadIdRef.current, externalId: currentThreadExternalIdRef.current },
      );
      params.onBeforeStart?.(initialAssistantMessageId);

      let hasStreamProgress = false;

      const dispatchLiveRunAction = (action: LiveRunAction) => {
        if (!streamStillOwnsVisibleThread()) return;
        const transition = transitionLiveRun(liveRunState, action, {
          createId: generateId,
        });
        liveRunState = transition.state;
        if (transition.operations.length > 0) {
          setMessages((prev) => applyLiveRunOperations(prev, transition.operations));
        }
      };

      const abortController = new AbortController();
      if (!params.preserveActiveRun) {
        abortControllerRef.current?.abort();
        recoveryPollGenerationRef.current += 1;
        setIsRecoveringStream(false);
      }
      abortControllerRef.current = abortController;
      stopRequestedRef.current = false;
      setThreadActivityStatus('running');
      setIsStreaming(true);

      let streamError: unknown = null;
      const resolveActivityThreadId = async () => {
        if (params.threadId) return params.threadId;

        const curId = currentThreadIdRef.current;
        if (curId && threadExternalIdMapRef.current[curId] !== curId) {
          return curId;
        }

        if (params.threadExternalId) {
          return await fetchAndSetThreadsState(params.userId, params.threadExternalId);
        }

        return null;
      };

      try {
        const normalizedUserMetadata = params.userMetadata ? (JSON.parse(JSON.stringify(params.userMetadata)) as Record<string, unknown>) : undefined;

        const contextSeed = userContextSeedRef.current;
        const contextMetadata = contextSeed ? (JSON.parse(JSON.stringify(contextSeed)) as Record<string, unknown>) : undefined;
        const requestContent = params.content && params.content.length > 0 ? params.content : '';

        const metadataKey = params.threadId ?? params.threadExternalId ?? undefined;
        // Read from ref to avoid dependency on threadMetadataMap
        const currentThreadMetadataMap = threadMetadataMapRef.current;
        const messageMetadata = metadataKey ? (currentThreadMetadataMap[metadataKey]?.userContext as Record<string, unknown> | undefined) : undefined;
        const threadMetadata = metadataKey ? currentThreadMetadataMap[metadataKey] : undefined;

        const mergedMetadata = {
          ...(messageMetadata ?? {}),
          ...(params.metadata ?? {}),
        } as Record<string, unknown>;

        const finalMetadata = Object.keys(mergedMetadata).length > 0 ? mergedMetadata : undefined;

        await runCopilotzStream({
          threadId: params.threadId ?? undefined,
          threadExternalId: params.threadExternalId ?? undefined,
          content: requestContent,
          user: {
            externalId: params.userId,
            name: params.userName ?? params.userId,
            metadata: {
              ...(contextMetadata ? contextMetadata : {}),
              ...(normalizedUserMetadata ?? {}),
            },
          },
          attachments: params.attachments,
          metadata: finalMetadata,
          threadMetadata: params.threadMetadata ?? threadMetadata,
          toolCalls: params.toolCalls,
          selectedAgent: params.agentName ?? preferredAgentRef.current ?? null,
          participants: participantsRef.current,
          targetAgent: targetAgentNameRef.current,
          getRequestHeaders,
          onToken: (token, _isComplete, raw, opts) => {
            const rawAgent = raw?.payload?.agent ?? raw?.agent ?? null;
            const sender = rawAgent
              ? resolveAgentSender(rawAgent, senderOptionsRef.current)
              : params.assistantSender;
            const attemptId = opts?.llmAttemptId ??
              liveRunState.activeAttemptId ??
              liveRunState.lastAttemptId ??
              `stream-attempt:${initialAssistantMessageId}`;
            const isReasoning = opts?.isReasoning ?? false;
            const phaseId = opts?.phaseId ??
              `${attemptId}:${isReasoning ? 'reasoning' : 'answer'}:0`;
            if (token.length > 0) {
              hasStreamProgress = true;
              setIsRecoveringStream(false);
            }
            dispatchLiveRunAction({
              type: 'token',
              attemptId,
              phaseId,
              partial: token,
              isReasoning,
              sender,
              at: getEventTimestamp(raw),
            });
          },
          onMessageEvent: async (event: any) => {
            if (!streamStillOwnsVisibleThread()) return;
            const intercepted = applyEventInterceptor(event);
            if (intercepted?.handled) {
              return;
            }

            const type = (event?.type as string) || '';
            const payload = getEventPayload(event);

            if (type === 'LLM_CALL') {
              const attemptId = getLlmAttemptId(event);
              if (attemptId) {
                dispatchLiveRunAction({
                  type: 'attempt-start',
                  attemptId,
                  sender: resolveLiveEventSender(event, senderOptionsRef.current),
                  at: getEventTimestamp(event),
                });
              }
              return;
            }

            if (type === 'TOOL_RESULT') {
              processToolOutput((payload ?? {}) as Record<string, unknown>);
              dispatchLiveRunAction({
                type: 'tool-result',
                update: extractLiveToolResultUpdate((payload ?? {}) as Record<string, unknown>),
              });
              return;
            }

            if (type === 'TOOL_CALL_DELTA') {
              const delta = extractLiveToolCallDelta((payload ?? {}) as Record<string, unknown>);
              const applied = toolCallDraftStore.apply(delta);
              if (applied === 'created') {
                liveDraftIds.add(delta.draftId);
                dispatchLiveRunAction({
                  type: 'tool-draft-start',
                  attemptId: delta.llmAttemptId,
                  draftId: delta.draftId,
                  toolName: delta.toolName,
                  sender: resolveLiveEventSender(event, senderOptionsRef.current),
                  at: getEventTimestamp(event),
                });
                hasStreamProgress = true;
              } else if (applied === 'completed' && delta.toolCallId) {
                draftIdByToolCallId.set(delta.toolCallId, delta.draftId);
                dispatchLiveRunAction({
                  type: 'tool-draft-complete',
                  draftId: delta.draftId,
                  toolCallId: delta.toolCallId,
                });
              } else if (applied === 'discarded') {
                liveDraftIds.delete(delta.draftId);
                for (const [toolCallId, draftId] of draftIdByToolCallId) {
                  if (draftId === delta.draftId) {
                    draftIdByToolCallId.delete(toolCallId);
                  }
                }
                dispatchLiveRunAction({
                  type: 'tool-draft-discard',
                  draftId: delta.draftId,
                });
              }
              return;
            }

            if (type === 'LLM_RESULT') {
              const finalAnswer = getVisibleLlmResultAnswer(event);
              const attemptId = getLlmAttemptId(event) ??
                liveRunState.activeAttemptId ??
                liveRunState.lastAttemptId;
              if (attemptId) {
                dispatchLiveRunAction({
                  type: 'attempt-result',
                  attemptId,
                  answer: finalAnswer,
                  at: getEventTimestamp(event),
                });
              }
              if (isTerminalEmptyLlmResultEvent(event)) {
                finalizeStreamingPlaceholders();
              }
              return;
            }

            if (type === 'MESSAGE' || type === 'NEW_MESSAGE') {
              return;
            }

            if (type === 'TOOL_CALL') {
              const parsedToolCall = extractLiveToolCall((payload ?? {}) as Record<string, unknown>);
              const eventSender = resolveLiveEventSender(event, senderOptionsRef.current);
              const callId = parsedToolCall.id ?? generateId();
              dispatchLiveRunAction({
                type: 'tool-call',
                attemptId: getLlmAttemptId(event) ??
                  liveRunState.activeAttemptId ??
                  liveRunState.lastAttemptId,
                sender: eventSender,
                at: getEventTimestamp(event),
                toolCall: {
                  id: callId,
                  name: parsedToolCall.name,
                  arguments: parsedToolCall.arguments,
                  status: parsedToolCall.status,
                  ...(parsedToolCall.toolExecutionId
                    ? { toolExecutionId: parsedToolCall.toolExecutionId }
                    : {}),
                  ...(parsedToolCall.result !== undefined
                    ? { result: parsedToolCall.result }
                    : {}),
                },
              });
              const reconciledDraftId = draftIdByToolCallId.get(callId);
              if (reconciledDraftId) {
                liveDraftIds.delete(reconciledDraftId);
                draftIdByToolCallId.delete(callId);
              }
              hasStreamProgress = true;
              return;
            }

            // Fallback for unknown events
            handleStreamMessageEvent(event);
          },
          onAssetEvent: async (payload: any) => {
            if (!streamStillOwnsVisibleThread()) return;
            const intercepted = applyEventInterceptor({
              type: 'ASSET_CREATED',
              payload,
            });
            if (intercepted?.handled) {
              return;
            }

            if (!hasStreamProgress) return;
            handleStreamAssetEvent(payload, getLatestLiveRunMessageId(liveRunState));
          },
          signal: abortController.signal,
        });
      } catch (error) {
        streamError = error;
      }

      for (const draftId of liveDraftIds) {
        const snapshot = toolCallDraftStore.getSnapshot(draftId);
        if (!snapshot) continue;
        toolCallDraftStore.apply({
          ...snapshot,
          phase: 'discarded',
          sequence: snapshot.sequence + 1,
          delta: '',
        });
        dispatchLiveRunAction({ type: 'tool-draft-discard', draftId });
      }
      liveDraftIds.clear();

      const wasStopped = stopRequestedRef.current || abortController.signal.aborted || isAbortError(streamError);
      let recoveryStarted = false;

      if (!wasStopped && streamStillOwnsVisibleThread()) {
        try {
          const activityThreadId = await resolveActivityThreadId();
          if (activityThreadId) {
            const activity = await fetchThreadActivity(activityThreadId, getRequestHeaders);
            setThreadActivityStatus(activity.status);
            if (activity.status === 'running') {
              recoveryStarted = true;
              startThreadActivityRecovery(activityThreadId);
            } else if (streamError || activity.status === 'failed') {
              setIsRecoveringStream(false);
              await refreshThreadMessages(activityThreadId);
            }
          }
        } catch (activityError) {
          if (!streamError) {
            console.warn('Unable to verify Copilotz thread activity after stream close', activityError);
          }
        }
      }

      if (abortControllerRef.current === abortController) {
        abortControllerRef.current = null;
      }

      if (!streamStillOwnsVisibleThread()) {
        return getLatestLiveRunMessageId(liveRunState);
      }

      if (recoveryStarted) {
        return getLatestLiveRunMessageId(liveRunState);
      }

      finalizeStreamingPlaceholders();

      if (streamError) {
        throw streamError;
      }

      return getLatestLiveRunMessageId(liveRunState);
    },
    [applyEventInterceptor, handleStreamMessageEvent, handleStreamAssetEvent, fetchAndSetThreadsState, finalizeStreamingPlaceholders, getRequestHeaders, refreshThreadMessages, startThreadActivityRecovery, toolCallDraftStore]
  );

  const handleSendMessage = useCallback(
    async (content: string, attachments: MediaAttachment[] = []) => {
      if (!content.trim() && attachments.length === 0) return;
      if (!userId) return;

      const timestamp = nowTs();
      const curThreadId = currentThreadIdRef.current;
      const curThreadExtId = currentThreadExternalIdRef.current;
      const sendOwnerThreadId = curThreadId;
      const preserveActiveRun =
        threadActivityStatusRef.current === 'running' ||
        isRecoveringStreamRef.current ||
        isStreamingRef.current;

      const existingThreadId = curThreadId ?? undefined;
      // Use Ref to check without adding dependency
      const extMap = threadExternalIdMapRef.current;
      const isPlaceholderThread = existingThreadId ? extMap[existingThreadId] === existingThreadId : false;

      const threadIdForSend = isPlaceholderThread ? undefined : existingThreadId;

      let effectiveThreadExternalId = curThreadExtId ?? (isPlaceholderThread ? existingThreadId : undefined);

      if (!threadIdForSend) {
        if (!effectiveThreadExternalId) {
          effectiveThreadExternalId = generateId();
        }
        setCurrentThreadExternalId(effectiveThreadExternalId);
      } else if (curThreadExtId !== (effectiveThreadExternalId ?? null)) {
        setCurrentThreadExternalId(effectiveThreadExternalId ?? null);
      }

      const conversationKey = threadIdForSend ?? effectiveThreadExternalId!;
      const sendOwnerThreadExternalId = effectiveThreadExternalId ?? curThreadExtId;
      const stillShowingSendOwnerThread = () => isSameThreadIdentity(
        { id: sendOwnerThreadId, externalId: sendOwnerThreadExternalId },
        { id: currentThreadIdRef.current, externalId: currentThreadExternalIdRef.current },
      );

      // Get pending title for new threads if any
      const currentMetadata = threadMetadataMapRef.current[conversationKey];
      const pendingTitle = currentMetadata?.pendingTitle as string | undefined;

      const userMessageId = generateId();
      const userMessage: ChatViewMessage = {
        id: userMessageId,
        role: 'user',
        content,
        timestamp,
        attachments: attachments.length > 0 ? attachments : undefined,
        isComplete: true,
        metadata: {
          [CLIENT_MESSAGE_ID_METADATA_KEY]: userMessageId,
        },
        sender: resolveUserSender({
          id: userId,
          name: getCurrentUserDisplayName(userName, userId),
        }),
      };
      const assistantSender = targetAgentNameRef.current
        ? resolveAgentSender(
            {
              id: targetAgentNameRef.current,
              name: targetAgentNameRef.current,
            },
            senderOptionsRef.current
          )
        : preferredAgentRef.current
        ? resolveAgentSender({ id: preferredAgentRef.current, name: preferredAgentRef.current }, senderOptionsRef.current)
        : resolveAssistantFallbackSender(senderOptionsRef.current);

      // Create an assistant message placeholder with streaming state for typewriter effect
      const assistantMessageId = generateId();
      const assistantPlaceholder: ChatViewMessage = {
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        timestamp: timestamp + 1,
        isStreaming: true,
        isComplete: false,
        sender: assistantSender,
        activity: createPendingAssistantActivity(assistantMessageId),
      };

      // Add user message and assistant placeholder for typewriter loading effect
      setMessages((prev) => [...prev, userMessage as InternalChatMessage, assistantPlaceholder as InternalChatMessage]);
      setSpecialState(null);

      // Use ref for threads check
      if (!threadsRef.current.some((t) => t.id === conversationKey)) {
        const newThread: ChatThread = {
          id: conversationKey,
          title: content.slice(0, 40) || 'Nova conversa',
          createdAt: timestamp,
          updatedAt: timestamp,
          messageCount: 0,
        };
        setThreads((prev) => [newThread, ...prev]);
        setThreadMetadataMap((prev) => ({ ...prev, [conversationKey]: {} }));
        setThreadExternalIdMap((prev) => ({
          ...prev,
          [conversationKey]: effectiveThreadExternalId ?? null,
        }));
      }

      try {
        await sendCopilotzMessage({
          threadId: threadIdForSend,
          threadExternalId: effectiveThreadExternalId,
          content,
          attachments,
          userId,
          userName: getCurrentUserDisplayName(userName, userId),
          agentName: preferredAgentRef.current,
          metadata: userMessage.metadata,
          assistantMessageId: assistantPlaceholder.id,
          assistantSender,
          preserveActiveRun,
          // Include pending title for new threads
          threadMetadata: pendingTitle ? { name: pendingTitle } : undefined,
        });

        // Wait to ensure the assistant message is persisted before refreshing
        await new Promise((r) => setTimeout(r, 1000));
        // Refresh threads list to update metadata (message count, timestamps, etc.)
        // Don't reload messages since we already have them from streaming
        if (stillShowingSendOwnerThread()) {
          await fetchAndSetThreadsState(userId, effectiveThreadExternalId ?? existingThreadId ?? null);
        }
      } catch (error) {
        if (isAbortError(error)) return;
        console.error('Error sending Copilotz message', error);
        const nextSpecialState = getSpecialStateFromError(error);
        if (nextSpecialState) {
          setSpecialState(nextSpecialState);
          setMessages((prev) => prev.filter((msg) => !msg.isStreaming));
          return;
        }
        setMessages((prev) => {
          const finalized = prev.map((msg) => (msg.isStreaming ? closeAssistantMessage(msg) : msg));

          if (finalized.some(hasVisibleAssistantOutput)) {
            return finalized;
          }

          for (let i = finalized.length - 1; i >= 0; i--) {
            const message = finalized[i];
            if (message.role !== 'assistant') continue;

            const updated = [...finalized];
            updated[i] = {
              ...message,
              content: 'Desculpe, ocorreu um erro ao gerar a resposta. Por favor, tente novamente.',
              isStreaming: false,
              isComplete: true,
              sender: message.sender ?? resolveAssistantFallbackSender(senderOptionsRef.current),
            };
            return updated;
          }

          return [
            ...finalized,
            {
              id: generateId(),
              role: 'assistant',
              content: 'Desculpe, ocorreu um erro ao gerar a resposta. Por favor, tente novamente.',
              timestamp: nowTs(),
              isStreaming: false,
              isComplete: true,
              sender: resolveAssistantFallbackSender(senderOptionsRef.current),
            },
          ];
        });
      }
    },
    [userId, fetchAndSetThreadsState, loadThreadMessages, sendCopilotzMessage, getSpecialStateFromError]
  );

  const bootstrapConversation = useCallback(
    async (uid: string) => {
      if (!bootstrap?.initialToolCalls && !bootstrap?.initialMessage) return;

      const bootstrapThreadExternalId = generateId();
      setCurrentThreadId(bootstrapThreadExternalId);
      setCurrentThreadExternalId(bootstrapThreadExternalId);
      setThreadExternalIdMap((prev) => ({
        ...prev,
        [bootstrapThreadExternalId]: bootstrapThreadExternalId,
      }));
      setThreadMetadataMap((prev) => ({
        ...prev,
        [bootstrapThreadExternalId]: {},
      }));
      const assistantSender = preferredAgentRef.current ? resolveAgentSender({ id: preferredAgentRef.current, name: preferredAgentRef.current }, senderOptionsRef.current) : resolveAssistantFallbackSender(senderOptionsRef.current);
      const assistantMessageId = generateId();
      setMessages([
        {
          id: assistantMessageId,
          role: 'assistant',
          content: '',
          timestamp: nowTs(),
          isStreaming: true,
          isComplete: false,
          sender: assistantSender,
          activity: createPendingAssistantActivity(assistantMessageId),
        } as InternalChatMessage,
      ]);
      setMessagePageInfo(createEmptyMessagePageInfo());
      persistedToolUpdatesRef.current = [];
      setThreadActivityStatus('running');
      setIsRecoveringStream(false);
      setSpecialState(null);

      try {
        await sendCopilotzMessage({
          threadExternalId: bootstrapThreadExternalId,
          content: bootstrap.initialMessage || '',
          toolCalls: bootstrap.initialToolCalls,
          userId: uid,
          userName: getCurrentUserDisplayName(userName, uid),
          agentName: preferredAgentRef.current,
          assistantMessageId,
          assistantSender,
          threadMetadata: {
            name: defaultThreadName || 'Main Thread',
          },
        });

        // Give the backend time to persist tool outputs/messages before refresh
        await new Promise((r) => setTimeout(r, 1000));

        // Refresh threads list to update metadata
        // Don't reload messages since we already have them from streaming
        await fetchAndSetThreadsState(uid, bootstrapThreadExternalId);
      } catch (error) {
        if (isAbortError(error)) return;
        console.error('Error bootstrapping conversation', error);
        const nextSpecialState = getSpecialStateFromError(error);
        if (nextSpecialState) {
          setSpecialState(nextSpecialState);
          setMessages([]);
          return;
        }
        setMessages([
          {
            id: generateId(),
            role: 'assistant',
            content: 'Não foi possível iniciar a conversa. Tente novamente mais tarde.',
            timestamp: nowTs(),
            isStreaming: false,
            isComplete: true,
            sender: resolveAssistantFallbackSender(senderOptionsRef.current),
          },
        ]);
      }
    },
    [fetchAndSetThreadsState, loadThreadMessages, sendCopilotzMessage, bootstrap, defaultThreadName, getSpecialStateFromError]
  );

  const reset = useCallback(() => {
    messagesRequestRef.current += 1;
    setThreads([]);
    setThreadMetadataMap({});
    setThreadExternalIdMap({});
    setCurrentThreadId(null);
    setCurrentThreadExternalId(null);
    setMessages([]);
    setUserContextSeed({});
    setIsMessagesLoading(false);
    setIsLoadingOlderMessages(false);
    setIsStreaming(false);
    setThreadActivityStatus('idle');
    setIsRecoveringStream(false);
    setMessagePageInfo(createEmptyMessagePageInfo());
    persistedToolUpdatesRef.current = [];
    setSpecialState(null);
    abortControllerRef.current?.abort();
  }, []);

  // Initialize when userId changes
  useEffect(() => {
    if (userId) {
      // Guard against double initialization in StrictMode
      if (initializationRef.current.userId === userId && initializationRef.current.started) {
        return;
      }
      initializationRef.current = { userId, started: true };

      const init = async () => {
        // Use URL thread ID as preferred if available
        const urlPreferredThread = isUrlSyncEnabled ? urlState.threadId : undefined;
        const preferredThreadId = await fetchAndSetThreadsState(userId, urlPreferredThread);
        if (preferredThreadId) {
          await loadThreadMessages(preferredThreadId);
          await refreshThreadActivity(preferredThreadId);
        } else if (bootstrap) {
          await bootstrapConversation(userId);
        }
      };
      init();
    } else {
      initializationRef.current = { userId: null, started: false };
      reset();
    }
    // urlState.threadId intentionally excluded: only needed on first init (captured
    // by the lazy initializer in useUrlState). Including it would re-trigger the
    // effect when the thread-sync effect writes back to the URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, fetchAndSetThreadsState, loadThreadMessages, refreshThreadActivity, bootstrapConversation, reset, bootstrap, isUrlSyncEnabled]);

  // Sync currentThreadExternalId to URL when it changes
  useEffect(() => {
    if (!isUrlSyncEnabled) return;
    // Only sync after initial load is complete
    if (!initializationRef.current.started) return;

    setUrlThreadId(currentThreadExternalId);
  }, [currentThreadExternalId, isUrlSyncEnabled, setUrlThreadId]);

  // Sync metadata map effects
  useEffect(() => {
    if (!currentThreadId) return;
    const metadata = threadMetadataMap[currentThreadId];
    if (!metadata) return;

    if (metadata.userContext && typeof metadata.userContext === 'object') {
      setUserContextSeed((prev) => ({
        ...prev,
        ...(metadata.userContext as Partial<ChatUserContext>),
      }));
    }
  }, [currentThreadId, threadMetadataMap]);

  const activityNotice = threadActivityStatus === 'running' && isRecoveringStream
    ? {
      tone: 'info' as const,
      message: 'The agent is still working. Loading updates...',
    }
    : threadActivityStatus === 'failed'
    ? {
      tone: 'error' as const,
      message: 'The last run failed. Refreshing the latest messages...',
    }
    : null;

  return {
    messages: messages.map(toPublicChatMessage),
    isMessagesLoading,
    isLoadingOlderMessages,
    messagePageInfo,
    threads,
    currentThreadId,
    isStreaming,
    threadActivityStatus,
    isRecoveringStream,
    activityNotice,
    toolCallDraftSource: toolCallDraftStore,
    specialState,
    clearSpecialState,
    userContextSeed,
    sendMessage: handleSendMessage,
    createThread: handleCreateThread,
    selectThread: handleSelectThread,
    renameThread: handleRenameThread,
    archiveThread: handleArchiveThread,
    updateThreadTags: handleUpdateThreadTags,
    editMessage: handleEditMessage,
    deleteThread: handleDeleteThread,
    stopGeneration: handleStop,
    fetchAndSetThreadsState,
    loadThreadMessages,
    loadOlderMessages,
    reset,
  };
}
