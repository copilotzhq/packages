// deno-lint-ignore-file no-explicit-any
import { useState, useCallback, useRef, useEffect } from 'react';
import { cancelCopilotzOperation, CopilotzRequestError, fetchThreads, fetchThreadMessagesPage, isRetryableCanonicalHistoryError, observeThreadFeed, startCopilotzRun, updateThread as updateThreadApi, editThreadMessage, deleteThread as deleteThreadApi } from './copilotzService';
import { getAttachmentKindFromMimeType, getMimeTypeFromDataUrl } from '@copilotz/chat-ui';
import type { AgentOption, AssistantActivityBlock, ChatMessage as ChatViewMessage, ChatSender, ChatThread, ChatThreadTag, MediaAttachment, ChatUserContext } from '@copilotz/chat-ui';
import { useUrlState } from './useUrlState';
import type { EventInterceptor, RunErrorInterceptor, SpecialChatState } from './specialState';
import type { RequestHeadersProvider, ThreadActivityStatus, ThreadFeedEvent } from './copilotzService';
import type { CanonicalMessagePage, CanonicalMessagePageInfo } from './canonicalHistory';
import { closeAssistantMessage, hasVisibleAssistantOutput, type InternalChatMessage, toPublicChatMessage } from './activity';
import { resolveAgentSender, resolveAssistantFallbackSender, resolveLiveEventSender, resolveUserSender, type SenderResolutionOptions } from './senders';
import { isInternalMessageMetadata, projectCanonicalMessageHistory } from './messageContract';
import {
  getLlmAttemptId,
  getStreamEventPayload,
  isAgentOutputMessageEvent,
} from './streamEvents';
import { canAttachToStreamingAssistant, extractLiveToolCallDelta, extractToolExecutionLifecycle, extractToolOutputDelta, mergePersistedToolResults, matchesToolResultUpdate, parseCompletedToolCallDraft, prependUniqueMessages, type ToolResultUpdate } from './toolActivity';
import { CLIENT_MESSAGE_ID_METADATA_KEY, reconcileThreadMessages } from './messageReconciliation';
import { applyLiveRunOperations, createLiveRunState, getLatestLiveRunMessageId, selectLiveRunSender, transitionLiveRun, type LiveRunAction, type LiveRunState } from './liveRun';
import {
  createToolCallDraftStore,
  type ToolCallDraftStore,
} from './toolCallDraftStore';
import { selectAcceptedOperationFeedCursor } from './feedBootstrap';
import { isCurrentInitializationRun, type InitializationRunState } from './initializationRun';

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
const THREAD_MESSAGES_PAGE_SIZE = 50;

type FeedConnectionStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'failed';
type ActiveOperationStatus = 'running' | 'stopping';
type CanonicalLoadStatus = 'idle' | 'retrying' | 'failed';

const CANONICAL_HISTORY_MAX_RETRIES = 5;

type LiveOperationProjection = {
  state: LiveRunState;
  assistantSender?: ChatSender;
  liveDraftIds: Set<string>;
  draftIdByToolCallId: Map<string, string>;
  accumulated: Map<string, string>;
  messageOrdinal: number;
  hasProgress: boolean;
};

const feedOperationId = (event: Record<string, unknown>): string | null => {
  const payload = isRecord(event.payload) ? event.payload : undefined;
  const candidates = [event.operationId, payload?.operationId, event.correlationId];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
  }
  return null;
};

const feedStreamOffsetKey = (operationId: string, streamId: string): string =>
  `${operationId}\u0000${streamId}`;

const feedRetryDelay = (
  attempt: number,
  serverRetry: number | undefined,
  random = Math.random,
): number => {
  const ceiling = Math.min(10_000, serverRetry ?? 250 * (2 ** Math.min(attempt, 6)));
  return Math.max(0, Math.floor(random() * ceiling));
};

const abortableDelay = (
  milliseconds: number,
  signal: AbortSignal,
): Promise<void> => new Promise<void>((resolve, reject) => {
  if (signal.aborted) {
    reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
    return;
  }
  const done = () => {
    clearTimeout(timeout);
    signal.removeEventListener('abort', aborted);
    resolve();
  };
  const aborted = () => {
    clearTimeout(timeout);
    signal.removeEventListener('abort', aborted);
    reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
  };
  const timeout = setTimeout(done, milliseconds);
  signal.addEventListener('abort', aborted, { once: true });
});

const createEmptyMessagePageInfo = (): CanonicalMessagePageInfo => ({
  hasMore: false,
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
  const [messagePageInfo, setMessagePageInfo] = useState<CanonicalMessagePageInfo>(createEmptyMessagePageInfo);
  const [isStreaming, setIsStreaming] = useState(false);
  const [threadActivityStatus, setThreadActivityStatus] = useState<ThreadActivityStatus>('idle');
  const [isRecoveringStream, setIsRecoveringStream] = useState(false);
  const [feedConnectionStatus, setFeedConnectionStatus] = useState<FeedConnectionStatus>('idle');
  const [canonicalLoadStatus, setCanonicalLoadStatus] = useState<CanonicalLoadStatus>('idle');
  const [isStopping, setIsStopping] = useState(false);
  const [feedBootstrap, setFeedBootstrap] = useState<{
    threadId: string;
    cursor: string | null;
    generation: number;
  } | null>(null);
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
  const threadActivityStatusRef = useRef(threadActivityStatus);
  const senderOptionsRef = useRef<SenderResolutionOptions>({
    agents: agentOptions,
    user: userId ? { id: userId, name: userName, avatarUrl: userAvatar } : null,
    assistantName,
  });
  const persistedToolUpdatesRef = useRef<ToolResultUpdate[]>([]);
  const feedBootstrapGenerationRef = useRef(0);
  const activeOperationsRef = useRef<Map<string, ActiveOperationStatus>>(new Map());
  const liveOperationsRef = useRef<Map<string, LiveOperationProjection>>(new Map());
  const streamOffsetsRef = useRef<Map<string, number>>(new Map());
  const threadTransportGenerationRef = useRef(0);
  const currentFeedCursorRef = useRef<string | null>(null);
  const feedAbortControllerRef = useRef<AbortController | null>(null);
  const historyAbortControllerRef = useRef<AbortController | null>(null);
  const initializationAbortControllerRef = useRef<AbortController | null>(null);
  const canonicalRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toolCallDraftStoreRef = useRef<ToolCallDraftStore | null>(null);
  if (!toolCallDraftStoreRef.current) {
    toolCallDraftStoreRef.current = createToolCallDraftStore();
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
  threadActivityStatusRef.current = threadActivityStatus;
  senderOptionsRef.current = {
    agents: agentOptions,
    user: userId ? { id: userId, name: userName, avatarUrl: userAvatar } : null,
    assistantName,
  };
  preferredAgentRef.current = preferredAgentName ?? null;
  participantsRef.current = participants ?? null;
  targetAgentNameRef.current = targetAgentName ?? null;

  const messagesRequestRef = useRef<number>(0);
  // Guard to prevent double initialization in StrictMode
  const initializationRef = useRef<InitializationRunState>({
    userId: null,
    started: false,
    generation: 0,
  });

  useEffect(() => {
    if (initialContext) {
      setUserContextSeed((prev) => ({ ...prev, ...initialContext }));
    }
  }, [initialContext]);

  useEffect(() => () => {
    toolCallDraftStore.clear();
    feedAbortControllerRef.current?.abort();
    historyAbortControllerRef.current?.abort();
    initializationAbortControllerRef.current?.abort();
    if (canonicalRefreshTimerRef.current) {
      clearTimeout(canonicalRefreshTimerRef.current);
    }
  }, [toolCallDraftStore]);

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
    currentThreadIdRef.current = nextThreadId ?? null;
    currentThreadExternalIdRef.current = nextThreadId
      ? externalMap[nextThreadId] ?? null
      : null;

    return nextThreadId;
  }, []); // No dependencies needed now as we use refs for reading current state

  const fetchAndSetThreadsState = useCallback(
    async (
      uid: string,
      preferredExternalId?: string | null,
      options: Readonly<{
        signal?: AbortSignal;
        isCurrent?: () => boolean;
      }> = {},
    ) => {
      try {
        const rawThreads = await fetchThreads(
          uid,
          getRequestHeaders,
          options.signal,
        );
        if (options.signal?.aborted || options.isCurrent?.() === false) {
          return null;
        }
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
    (page: CanonicalMessagePage) => {
      return projectCanonicalMessageHistory(page, {
        senderOptions: senderOptionsRef.current,
        now: nowTs,
        onToolOutput: processToolOutput,
      });
    },
    [processToolOutput]
  );

  const loadThreadMessages = useCallback(
    async (threadId: string, options: Readonly<{ rethrow?: boolean }> = {}) => {
      if (currentThreadIdRef.current !== threadId) return;
      historyAbortControllerRef.current?.abort();
      const controller = new AbortController();
      historyAbortControllerRef.current = controller;
      const transportGeneration = threadTransportGenerationRef.current;
      const requestId = messagesRequestRef.current + 1;
      messagesRequestRef.current = requestId;
      setIsMessagesLoading(true);
      setIsLoadingOlderMessages(false);
      if (!options.rethrow) {
        setMessagePageInfo(createEmptyMessagePageInfo());
        persistedToolUpdatesRef.current = [];
        setCanonicalLoadStatus('idle');
      }
      try {
        let retries = 0;
        let page: CanonicalMessagePage;
        while (true) {
          if (
            controller.signal.aborted ||
            messagesRequestRef.current !== requestId ||
            threadTransportGenerationRef.current !== transportGeneration ||
            currentThreadIdRef.current !== threadId
          ) return;
          try {
            page = await fetchThreadMessagesPage(threadId, {
              limit: THREAD_MESSAGES_PAGE_SIZE,
              signal: controller.signal,
            }, getRequestHeaders);
            break;
          } catch (error) {
            if (isAbortError(error)) return;
            if (options.rethrow) throw error;
            if (
              messagesRequestRef.current !== requestId ||
              threadTransportGenerationRef.current !== transportGeneration ||
              currentThreadIdRef.current !== threadId
            ) return;
            if (
              !isRetryableCanonicalHistoryError(error) ||
              retries >= CANONICAL_HISTORY_MAX_RETRIES
            ) throw error;
            retries += 1;
            setCanonicalLoadStatus('retrying');
            await abortableDelay(
              feedRetryDelay(retries - 1, undefined),
              controller.signal,
            );
          }
        }
        if (
          controller.signal.aborted ||
          messagesRequestRef.current !== requestId ||
          threadTransportGenerationRef.current !== transportGeneration ||
          currentThreadIdRef.current !== threadId
        ) return;
        const { viewMessages, toolResultUpdates } = prepareThreadMessages(page);

        persistedToolUpdatesRef.current = toolResultUpdates;
        const hydratedMessages = mergePersistedToolResults(viewMessages, persistedToolUpdatesRef.current);
        setMessages(hydratedMessages);
        setMessagePageInfo(page.pageInfo);
        streamOffsetsRef.current.clear();
        currentFeedCursorRef.current = page.pageInfo.replayCursor ?? null;
        liveOperationsRef.current.clear();
        activeOperationsRef.current.clear();
        for (const operationId of page.pageInfo.activeOperationIds ?? []) {
          activeOperationsRef.current.set(operationId, 'running');
        }
        setIsStreaming(activeOperationsRef.current.size > 0);
        setThreadActivityStatus(activeOperationsRef.current.size > 0 ? 'running' : 'idle');
        setIsStopping(false);
        setCanonicalLoadStatus('idle');
        setFeedBootstrap({
          threadId,
          cursor: page.pageInfo.replayCursor ?? null,
          generation: ++feedBootstrapGenerationRef.current,
        });
      } catch (error) {
        if (isAbortError(error)) return;
        if (options.rethrow) throw error;
        console.error(`Error loading messages for thread ${threadId}`, error);
        persistedToolUpdatesRef.current = [];
        setMessagePageInfo(createEmptyMessagePageInfo());
        setCanonicalLoadStatus('failed');
      } finally {
        if (
          messagesRequestRef.current === requestId &&
          threadTransportGenerationRef.current === transportGeneration &&
          currentThreadIdRef.current === threadId
        ) {
          setIsMessagesLoading(false);
        }
        if (historyAbortControllerRef.current === controller) {
          historyAbortControllerRef.current = null;
        }
      }
    },
    [getRequestHeaders, prepareThreadMessages]
  );

  const refreshThreadMessages = useCallback(
    async (threadId: string) => {
      const transportGeneration = threadTransportGenerationRef.current;
      if (currentThreadIdRef.current !== threadId) return;
      const requestId = messagesRequestRef.current;

      try {
        const page = await fetchThreadMessagesPage(threadId, { limit: THREAD_MESSAGES_PAGE_SIZE }, getRequestHeaders);
        const { viewMessages, toolResultUpdates } = prepareThreadMessages(page);
        if (
          messagesRequestRef.current !== requestId ||
          threadTransportGenerationRef.current !== transportGeneration ||
          currentThreadIdRef.current !== threadId
        ) return;

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
          hasMore: prev.hasMore || page.pageInfo.hasMore,
          ...(prev.next ? { next: prev.next } : page.pageInfo.next ? { next: page.pageInfo.next } : {}),
        }));
        setCanonicalLoadStatus('idle');
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
    const before = pageInfo.next;

    if (!threadId || !before || !pageInfo.hasMore || isLoadingOlderMessagesRef.current) {
      return;
    }

    const requestId = messagesRequestRef.current;
    setIsLoadingOlderMessages(true);

    try {
      const page = await fetchThreadMessagesPage(threadId, { limit: THREAD_MESSAGES_PAGE_SIZE, before }, getRequestHeaders);
      const { viewMessages, toolResultUpdates } = prepareThreadMessages(page);
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

  const resetThreadTransport = useCallback(() => {
    threadTransportGenerationRef.current += 1;
    messagesRequestRef.current += 1;
    if (canonicalRefreshTimerRef.current) {
      clearTimeout(canonicalRefreshTimerRef.current);
      canonicalRefreshTimerRef.current = null;
    }
    feedAbortControllerRef.current?.abort();
    feedAbortControllerRef.current = null;
    historyAbortControllerRef.current?.abort();
    historyAbortControllerRef.current = null;
    activeOperationsRef.current.clear();
    liveOperationsRef.current.clear();
    streamOffsetsRef.current.clear();
    currentFeedCursorRef.current = null;
    setFeedBootstrap(null);
    setFeedConnectionStatus('idle');
    setCanonicalLoadStatus('idle');
    setThreadActivityStatus('idle');
    setIsRecoveringStream(false);
    setIsStreaming(false);
    setIsStopping(false);
  }, []);

  const handleSelectThread = useCallback(
    async (threadId: string) => {
      resetThreadTransport();
      currentThreadIdRef.current = threadId;
      setCurrentThreadId(threadId);
      setMessages([]);
      setMessagePageInfo(createEmptyMessagePageInfo());
      persistedToolUpdatesRef.current = [];
      // Use ref for external map to avoid re-creation
      const extMap = threadExternalIdMapRef.current;
      currentThreadExternalIdRef.current = extMap[threadId] ?? null;
      setCurrentThreadExternalId(currentThreadExternalIdRef.current);
      await loadThreadMessages(threadId);
    },
    [loadThreadMessages, resetThreadTransport]
  );

  const handleCreateThread = useCallback((title?: string) => {
    resetThreadTransport();
    messagesRequestRef.current += 1;
    setIsMessagesLoading(false);
    setIsLoadingOlderMessages(false);
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
    currentThreadIdRef.current = id;
    currentThreadExternalIdRef.current = id;
    setCurrentThreadId(id);
    setCurrentThreadExternalId(id);
    setMessages([]);
    setMessagePageInfo(createEmptyMessagePageInfo());
    persistedToolUpdatesRef.current = [];
  }, [resetThreadTransport]);

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
        resetThreadTransport();
        const remaining = threadsRef.current.filter((t) => t.id !== threadId);
        if (remaining.length > 0) {
          currentThreadIdRef.current = remaining[0].id;
          currentThreadExternalIdRef.current = extMap[remaining[0].id] ?? null;
          setCurrentThreadId(remaining[0].id);
          setCurrentThreadExternalId(currentThreadExternalIdRef.current);
          await loadThreadMessages(remaining[0].id);
        } else {
          currentThreadIdRef.current = null;
          currentThreadExternalIdRef.current = null;
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
    [userId, fetchAndSetThreadsState, loadThreadMessages, getRequestHeaders, resetThreadTransport]
  );

  const handleStop = useCallback(async () => {
    const operationId = [...activeOperationsRef.current.entries()]
      .reverse()
      .find(([, status]) => status === 'running')?.[0];
    if (!operationId || isStopping) return;
    activeOperationsRef.current.set(operationId, 'stopping');
    setIsStopping(true);
    try {
      const result = await cancelCopilotzOperation(
        operationId,
        getRequestHeaders,
      );
      if (
        result.status === 'cancelled' || result.status === 'completed' ||
        result.status === 'failed'
      ) {
        activeOperationsRef.current.delete(operationId);
        liveOperationsRef.current.delete(operationId);
        setIsStopping(false);
        if (activeOperationsRef.current.size === 0) {
          feedAbortControllerRef.current?.abort();
          setFeedConnectionStatus('idle');
          const threadId = currentThreadIdRef.current;
          if (threadId) await refreshThreadMessages(threadId);
          finalizeStreamingPlaceholders(
            result.status === 'failed' ? 'failed' : 'idle',
          );
        }
      }
      // For an accepted cancellation, the feed owns final settlement.
    } catch (error) {
      activeOperationsRef.current.set(operationId, 'running');
      setIsStopping(false);
      console.error('Failed to stop Copilotz operation', error);
    }
  }, [finalizeStreamingPlaceholders, getRequestHeaders, isStopping, refreshThreadMessages]);

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

  const queueCanonicalRefresh = useCallback((threadId: string) => {
    if (canonicalRefreshTimerRef.current) {
      clearTimeout(canonicalRefreshTimerRef.current);
    }
    const transportGeneration = threadTransportGenerationRef.current;
    canonicalRefreshTimerRef.current = setTimeout(() => {
      canonicalRefreshTimerRef.current = null;
      if (
        threadTransportGenerationRef.current !== transportGeneration ||
        currentThreadIdRef.current !== threadId
      ) return;
      void refreshThreadMessages(threadId).then(() => {
        if (
          threadTransportGenerationRef.current !== transportGeneration ||
          currentThreadIdRef.current !== threadId
        ) return;
        if (activeOperationsRef.current.size === 0) {
          finalizeStreamingPlaceholders(
            threadActivityStatusRef.current === 'failed' ? 'failed' : 'idle',
          );
        }
      });
    }, 50);
  }, [finalizeStreamingPlaceholders, refreshThreadMessages]);

  const processThreadFeedEvent = useCallback(async (frame: ThreadFeedEvent) => {
    const event = frame.data as any;
    const type = frame.type;
    const operationId = feedOperationId(event);
    const threadId = typeof event.threadId === 'string' && event.threadId.trim()
      ? event.threadId.trim()
      : currentThreadIdRef.current;
    if (!operationId || !threadId || currentThreadIdRef.current !== threadId) return;

    if (type === 'replay.capacity') {
      const error = new Error('Thread feed replay capacity was exceeded.');
      error.name = 'FeedReplayCapacityError';
      throw error;
    }

    const terminalStatus = type === 'operation.completed'
      ? 'idle'
      : type === 'operation.failed'
      ? 'failed'
      : type === 'operation.cancelled'
      ? 'idle'
      : null;
    if (terminalStatus) {
      // Interceptors may replace presentation, but transport lifecycle remains
      // authoritative: a handled terminal frame must still retire the operation.
      applyEventInterceptor(event);
      activeOperationsRef.current.delete(operationId);
      const projection = liveOperationsRef.current.get(operationId);
      if (projection) {
        for (const draftId of projection.liveDraftIds) {
          const snapshot = toolCallDraftStore.getSnapshot(draftId);
          if (!snapshot) continue;
          toolCallDraftStore.apply({
            ...snapshot,
            phase: 'discarded',
            sequence: snapshot.sequence + 1,
            delta: '',
          });
          const transition = transitionLiveRun(projection.state, {
            type: 'tool-draft-discard',
            draftId,
          }, { createId: () => `${operationId}:message:${projection.messageOrdinal++}` });
          projection.state = transition.state;
          if (transition.operations.length) {
            setMessages((current) => applyLiveRunOperations(current, transition.operations));
          }
        }
      }
      liveOperationsRef.current.delete(operationId);
      const hasActive = activeOperationsRef.current.size > 0;
      setIsStreaming(hasActive);
      setIsStopping([...activeOperationsRef.current.values()].some((status) => status === 'stopping'));
      setThreadActivityStatus(hasActive ? 'running' : terminalStatus);
      if (!hasActive) {
        setFeedConnectionStatus('idle');
        setIsRecoveringStream(false);
        // The parser still has to commit this frame's cursor. Let the server
        // close the completed feed instead of aborting it from this callback.
      }
      queueCanonicalRefresh(threadId);
      return;
    }

    activeOperationsRef.current.set(
      operationId,
      activeOperationsRef.current.get(operationId) ?? 'running',
    );
    setThreadActivityStatus('running');
    setIsStreaming(true);

    let projection = liveOperationsRef.current.get(operationId);
    if (!projection) {
      projection = {
        state: createLiveRunState(`${operationId}:assistant:0`),
        assistantSender: resolveAssistantFallbackSender(senderOptionsRef.current),
        liveDraftIds: new Set(),
        draftIdByToolCallId: new Map(),
        accumulated: new Map(),
        messageOrdinal: 1,
        hasProgress: false,
      };
      liveOperationsRef.current.set(operationId, projection);
    }

    const payload = getEventPayload(event);
    const streamId = typeof event.streamId === 'string'
      ? event.streamId
      : typeof payload?.streamId === 'string'
      ? payload.streamId
      : null;
    const fromOffset = typeof event.fromOffset === 'number'
      ? event.fromOffset
      : typeof payload?.fromOffset === 'number'
      ? payload.fromOffset
      : null;
    const toOffset = typeof event.toOffset === 'number'
      ? event.toOffset
      : typeof payload?.toOffset === 'number'
      ? payload.toOffset
      : null;
    if (streamId && fromOffset !== null && toOffset !== null) {
      const applied = streamOffsetsRef.current.get(
        feedStreamOffsetKey(operationId, streamId),
      ) ?? 0;
      if (toOffset <= applied) return;
      if (fromOffset !== applied || toOffset < fromOffset) {
        const error = new Error(`Thread feed stream '${streamId}' has an offset gap.`);
        error.name = 'FeedOffsetGapError';
        throw error;
      }
    }

    const commitOffset = () => {
      if (streamId && toOffset !== null) {
        streamOffsetsRef.current.set(
          feedStreamOffsetKey(operationId, streamId),
          toOffset,
        );
      }
    };
    const intercepted = applyEventInterceptor(event);
    if (intercepted?.handled) {
      // The SSE cursor advances after this callback returns. Advance the matching
      // lane cursor as well so a handled progressive frame cannot create a false
      // offset gap on the next frame or after reconnect.
      commitOffset();
      return;
    }
    const dispatch = (action: LiveRunAction) => {
      const transition = transitionLiveRun(projection!.state, action, {
        createId: () => `${operationId}:message:${projection!.messageOrdinal++}`,
      });
      projection!.state = transition.state;
      if (transition.operations.length) {
        setMessages((current) => applyLiveRunOperations(current, transition.operations));
      }
    };

    if (type === 'text.delta' || type === 'reasoning.delta') {
      const isReasoning = type === 'reasoning.delta';
      const attemptId = getLlmAttemptId(event) ?? `${operationId}:attempt:0`;
      const chunk = typeof payload?.text === 'string' ? payload.text : '';
      const laneKey = streamId ?? `${attemptId}:${isReasoning ? 'reasoning' : 'answer'}`;
      const partial = `${projection.accumulated.get(laneKey) ?? ''}${chunk}`;
      projection.accumulated.set(laneKey, partial);
      const rawAgent = payload?.agent ?? event.agent;
      const incomingSender = rawAgent
        ? resolveAgentSender(rawAgent, senderOptionsRef.current)
        : undefined;
      const sender = selectLiveRunSender(
        projection.state,
        attemptId,
        incomingSender,
        projection.assistantSender,
      );
      dispatch({
        type: 'token',
        attemptId,
        phaseId: typeof payload?.phaseId === 'string'
          ? payload.phaseId
          : `${attemptId}:${isReasoning ? 'reasoning' : 'answer'}:0`,
        partial,
        isReasoning,
        sender,
        at: getEventTimestamp(event),
      });
      projection.hasProgress ||= chunk.length > 0;
      setIsRecoveringStream(false);
      commitOffset();
      return;
    }

    if (type === 'tool_call.delta') {
      const delta = extractLiveToolCallDelta((payload ?? {}) as Record<string, unknown>);
      const applied = toolCallDraftStore.apply(delta);
      if (applied === 'created') {
        projection.liveDraftIds.add(delta.draftId);
        dispatch({
          type: 'tool-draft-start',
          attemptId: delta.llmAttemptId,
          draftId: delta.draftId,
          toolName: delta.toolName,
          sender: resolveLiveEventSender(event, senderOptionsRef.current),
          at: getEventTimestamp(event),
        });
      } else if (applied === 'completed' && delta.toolCallId) {
        projection.draftIdByToolCallId.set(delta.toolCallId, delta.draftId);
        dispatch({ type: 'tool-draft-complete', draftId: delta.draftId, toolCallId: delta.toolCallId });
        const snapshot = toolCallDraftStore.getSnapshot(delta.draftId);
        if (!snapshot) throw new Error(`Completed tool draft '${delta.draftId}' disappeared.`);
        const parsedToolCall = parseCompletedToolCallDraft(snapshot);
        dispatch({
          type: 'tool-call',
          attemptId: delta.llmAttemptId,
          sender: resolveLiveEventSender(event, senderOptionsRef.current),
          at: getEventTimestamp(event),
          toolCall: {
            id: parsedToolCall.id!,
            toolId: parsedToolCall.toolId,
            name: parsedToolCall.name,
            arguments: parsedToolCall.arguments,
            status: parsedToolCall.status,
          },
        });
        projection.liveDraftIds.delete(delta.draftId);
      } else if (applied === 'discarded') {
        projection.liveDraftIds.delete(delta.draftId);
        dispatch({ type: 'tool-draft-discard', draftId: delta.draftId });
      }
      projection.hasProgress = true;
      commitOffset();
      return;
    }

    if (type === 'tool_execution.created') {
      const lifecycle = extractToolExecutionLifecycle(event);
      dispatch({
        type: 'tool-execution-start',
        attemptId: projection.state.activeAttemptId ?? projection.state.lastAttemptId,
        id: lifecycle.id,
        toolExecutionId: lifecycle.toolExecutionId,
        name: lifecycle.name,
        sender: resolveLiveEventSender(event, senderOptionsRef.current),
        at: getEventTimestamp(event),
      });
      projection.hasProgress = true;
      commitOffset();
      return;
    }

    if (type === 'tool_output.delta') {
      const update = extractToolOutputDelta(event);
      if (update.channel === 'result' && isRecord(update.delta)) processToolOutput(update.delta);
      dispatch({ type: 'tool-output', update });
      projection.hasProgress = true;
      commitOffset();
      return;
    }

    if (
      type === 'tool_execution.completed' || type === 'tool_execution.failed' ||
      type === 'tool_execution.cancelled'
    ) {
      const lifecycle = extractToolExecutionLifecycle(event);
      dispatch({
        type: 'tool-result',
        update: {
          id: lifecycle.id,
          toolExecutionId: lifecycle.toolExecutionId,
          name: lifecycle.name,
          status: lifecycle.status,
          ...(lifecycle.error ? { error: lifecycle.error } : {}),
          endTime: lifecycle.endTime ?? getEventTimestamp(event),
        },
      });
      commitOffset();
      return;
    }

    if (isAgentOutputMessageEvent(event)) {
      const attemptId = getLlmAttemptId(event) ??
        projection.state.activeAttemptId ?? projection.state.lastAttemptId;
      if (attemptId) dispatch({ type: 'attempt-result', attemptId, at: getEventTimestamp(event) });
      queueCanonicalRefresh(threadId);
      commitOffset();
      return;
    }

    if (type === 'asset.created') {
      const assetPayload = payload ?? event.payload;
      if (projection.hasProgress) {
        handleStreamAssetEvent(assetPayload, getLatestLiveRunMessageId(projection.state));
      }
      queueCanonicalRefresh(threadId);
      commitOffset();
      return;
    }

    if (type !== 'operation.accepted' && type !== 'operation.started' && type !== 'message.created') {
      handleStreamMessageEvent(event);
    }
    if (type === 'message.created') queueCanonicalRefresh(threadId);
    commitOffset();
  }, [applyEventInterceptor, handleStreamAssetEvent, handleStreamMessageEvent, processToolOutput, queueCanonicalRefresh, toolCallDraftStore]);

  const sendReconnectableCopilotzMessage = useCallback(
    async (params: { threadId?: string | null; threadExternalId?: string | null; content: string; attachments?: MediaAttachment[]; metadata?: Record<string, unknown>; threadMetadata?: Record<string, unknown>; toolCalls?: Array<{ name: string; args: Record<string, unknown> }>; userId: string; userName?: string; userMetadata?: Record<string, unknown>; agentName?: string | null; assistantMessageId?: string; assistantSender?: ChatSender; onBeforeStart?: (assistantMessageId: string) => void }) => {
      const transportGeneration = threadTransportGenerationRef.current;
      const operationId = generateId();
      const assistantMessageId = params.assistantMessageId ?? `${operationId}:assistant:0`;
      params.onBeforeStart?.(assistantMessageId);
      liveOperationsRef.current.set(operationId, {
        state: createLiveRunState(assistantMessageId),
        assistantSender: params.assistantSender,
        liveDraftIds: new Set(),
        draftIdByToolCallId: new Map(),
        accumulated: new Map(),
        messageOrdinal: 1,
        hasProgress: false,
      });
      activeOperationsRef.current.set(operationId, 'running');
      setThreadActivityStatus('running');
      setIsStreaming(true);
      setIsStopping(false);

      const metadataKey = params.threadId ?? params.threadExternalId ?? undefined;
      const currentThreadMetadataMap = threadMetadataMapRef.current;
      const messageMetadata = metadataKey
        ? currentThreadMetadataMap[metadataKey]?.userContext as Record<string, unknown> | undefined
        : undefined;
      const threadMetadata = metadataKey ? currentThreadMetadataMap[metadataKey] : undefined;
      const mergedMetadata = { ...(messageMetadata ?? {}), ...(params.metadata ?? {}) };
      const contextSeed = userContextSeedRef.current;
      let activeOperationId = operationId;

      try {
        const receipt = await startCopilotzRun({
          operationId,
          threadId: params.threadId ?? undefined,
          threadExternalId: params.threadExternalId ?? undefined,
          content: params.content || '',
          user: {
            externalId: params.userId,
            name: params.userName ?? params.userId,
            metadata: {
              ...(contextSeed ? JSON.parse(JSON.stringify(contextSeed)) : {}),
              ...(params.userMetadata ? JSON.parse(JSON.stringify(params.userMetadata)) : {}),
            },
          },
          attachments: params.attachments,
          metadata: Object.keys(mergedMetadata).length ? mergedMetadata : undefined,
          threadMetadata: params.threadMetadata ?? threadMetadata,
          toolCalls: params.toolCalls,
          selectedAgent: params.agentName ?? preferredAgentRef.current ?? null,
          participants: participantsRef.current,
          targetAgent: targetAgentNameRef.current,
          getRequestHeaders,
        });
        const remainsSelected = () =>
          threadTransportGenerationRef.current === transportGeneration && (
            (params.threadId !== undefined && params.threadId !== null &&
              currentThreadIdRef.current === params.threadId) ||
            (params.threadExternalId !== undefined && params.threadExternalId !== null &&
              currentThreadExternalIdRef.current === params.threadExternalId)
          );
        if (!remainsSelected()) {
          activeOperationsRef.current.delete(operationId);
          liveOperationsRef.current.delete(operationId);
          return assistantMessageId;
        }
        if (receipt.operationId !== operationId) {
          const projection = liveOperationsRef.current.get(operationId);
          liveOperationsRef.current.delete(operationId);
          activeOperationsRef.current.delete(operationId);
          if (projection) liveOperationsRef.current.set(receipt.operationId, projection);
          activeOperationsRef.current.set(receipt.operationId, 'running');
          activeOperationId = receipt.operationId;
        }
        const rawThreads = await fetchThreads(params.userId, getRequestHeaders);
        if (!remainsSelected()) {
          activeOperationsRef.current.delete(receipt.operationId);
          liveOperationsRef.current.delete(receipt.operationId);
          return assistantMessageId;
        }
        const persistedThreadId = updateThreadsState(
          rawThreads,
          receipt.thread.externalId,
        ) ?? receipt.thread.id;
        currentThreadIdRef.current = persistedThreadId;
        currentThreadExternalIdRef.current = receipt.thread.externalId;
        setCurrentThreadId(persistedThreadId);
        setCurrentThreadExternalId(receipt.thread.externalId);
        setFeedBootstrap({
          threadId: persistedThreadId,
          cursor: selectAcceptedOperationFeedCursor({
            activeOperationIds: activeOperationsRef.current.keys(),
            acceptedOperationId: receipt.operationId,
            currentCursor: currentFeedCursorRef.current,
            receiptCursor: receipt.replayCursor,
          }),
          generation: ++feedBootstrapGenerationRef.current,
        });
        return assistantMessageId;
      } catch (error) {
        activeOperationsRef.current.delete(operationId);
        activeOperationsRef.current.delete(activeOperationId);
        liveOperationsRef.current.delete(operationId);
        liveOperationsRef.current.delete(activeOperationId);
        if (threadTransportGenerationRef.current !== transportGeneration) {
          return assistantMessageId;
        }
        if (
          activeOperationsRef.current.size === 0
        ) finalizeStreamingPlaceholders('failed');
        throw error;
      }
    },
    [finalizeStreamingPlaceholders, getRequestHeaders, updateThreadsState],
  );

  const handleSendMessage = useCallback(
    async (content: string, attachments: MediaAttachment[] = []) => {
      if (!content.trim() && attachments.length === 0) return;
      if (!userId) return;

      const timestamp = nowTs();
      const curThreadId = currentThreadIdRef.current;
      const curThreadExtId = currentThreadExternalIdRef.current;

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
        await sendReconnectableCopilotzMessage({
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
          // Include pending title for new threads
          threadMetadata: pendingTitle ? { name: pendingTitle } : undefined,
        });

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
    [userId, sendReconnectableCopilotzMessage, getSpecialStateFromError]
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
        await sendReconnectableCopilotzMessage({
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
    [sendReconnectableCopilotzMessage, bootstrap, defaultThreadName, getSpecialStateFromError]
  );

  const reset = useCallback(() => {
    resetThreadTransport();
    messagesRequestRef.current += 1;
    setThreads([]);
    setThreadMetadataMap({});
    setThreadExternalIdMap({});
    setCurrentThreadId(null);
    setCurrentThreadExternalId(null);
    currentThreadIdRef.current = null;
    currentThreadExternalIdRef.current = null;
    setMessages([]);
    setUserContextSeed({});
    setIsMessagesLoading(false);
    setIsLoadingOlderMessages(false);
    setMessagePageInfo(createEmptyMessagePageInfo());
    persistedToolUpdatesRef.current = [];
    setSpecialState(null);
  }, [resetThreadTransport]);

  useEffect(() => {
    if (!feedBootstrap || feedBootstrap.threadId !== currentThreadId) return;
    if (activeOperationsRef.current.size === 0) {
      setFeedConnectionStatus('idle');
      setIsRecoveringStream(false);
      return;
    }

    feedAbortControllerRef.current?.abort();
    const controller = new AbortController();
    feedAbortControllerRef.current = controller;
    const threadId = feedBootstrap.threadId;
    let cursor = feedBootstrap.cursor;
    let reconnectAttempt = 0;
    let serverRetry: number | undefined;

    const delay = (milliseconds: number) => new Promise<void>((resolve) => {
      const timeout = setTimeout(done, milliseconds);
      const onAbort = () => done();
      function done() {
        clearTimeout(timeout);
        controller.signal.removeEventListener('abort', onAbort);
        resolve();
      }
      controller.signal.addEventListener('abort', onAbort, { once: true });
    });

    const waitUntilOnline = () => {
      if (typeof navigator === 'undefined' || navigator.onLine) return Promise.resolve();
      return new Promise<void>((resolve) => {
        const done = () => {
          globalThis.removeEventListener?.('online', done);
          controller.signal.removeEventListener('abort', done);
          resolve();
        };
        globalThis.addEventListener?.('online', done, { once: true });
        controller.signal.addEventListener('abort', done, { once: true });
      });
    };

    const rebuildFromCanonicalHistory = async () => {
      let attempt = 0;
      while (!controller.signal.aborted) {
        try {
          await loadThreadMessages(threadId, { rethrow: true });
          return;
        } catch (error) {
          if (controller.signal.aborted || isAbortError(error)) return;
          if (
            error instanceof CopilotzRequestError &&
            (error.status === 401 || error.status === 403 || error.status === 404)
          ) {
            setFeedConnectionStatus('failed');
            setIsRecoveringStream(false);
            return;
          }
          if (
            error instanceof CopilotzRequestError &&
            (error.status === 409 || error.status === 410)
          ) {
            attempt += 1;
            setFeedConnectionStatus('reconnecting');
            setIsRecoveringStream(true);
            await delay(feedRetryDelay(attempt, serverRetry));
            continue;
          }
          console.warn('Copilotz canonical feed recovery failed', error);
          attempt += 1;
          setFeedConnectionStatus('reconnecting');
          setIsRecoveringStream(true);
          await delay(feedRetryDelay(attempt, serverRetry));
        }
      }
    };

    void (async () => {
      while (!controller.signal.aborted) {
        if (activeOperationsRef.current.size === 0) {
          setFeedConnectionStatus('idle');
          setIsRecoveringStream(false);
          return;
        }
        await waitUntilOnline();
        if (controller.signal.aborted) return;
        setFeedConnectionStatus(reconnectAttempt === 0 ? 'connecting' : 'reconnecting');
        if (reconnectAttempt > 0) setIsRecoveringStream(true);
        let sawEvent = false;
        try {
          const result = await observeThreadFeed({
            threadId,
            operationIds: [...activeOperationsRef.current.keys()],
            cursor,
            getRequestHeaders,
            signal: controller.signal,
            watchdogMs: 45_000,
            onOpen: () => setFeedConnectionStatus('connected'),
            onEvent: async (frame) => {
              await processThreadFeedEvent(frame);
              cursor = frame.id;
              currentFeedCursorRef.current = frame.id;
              if (frame.retry !== undefined) serverRetry = frame.retry;
              sawEvent = true;
              reconnectAttempt = 0;
              setFeedConnectionStatus('connected');
              setIsRecoveringStream(false);
            },
          });
          cursor = result.cursor;
          currentFeedCursorRef.current = result.cursor;
          if (result.retry !== undefined) serverRetry = result.retry;
        } catch (error) {
          if (controller.signal.aborted || isAbortError(error)) return;
          if (
            error instanceof CopilotzRequestError &&
            (error.status === 409 || error.status === 410)
          ) {
            currentFeedCursorRef.current = null;
            await rebuildFromCanonicalHistory();
            return;
          }
          if (
            error && typeof error === 'object' &&
            ((error as { name?: unknown }).name === 'FeedOffsetGapError' ||
              (error as { name?: unknown }).name === 'FeedReplayCapacityError')
          ) {
            currentFeedCursorRef.current = null;
            await rebuildFromCanonicalHistory();
            return;
          }
          if (
            error instanceof CopilotzRequestError &&
            (error.status === 401 || error.status === 403 || error.status === 404)
          ) {
            setFeedConnectionStatus('failed');
            setIsRecoveringStream(false);
            return;
          }
          console.warn('Copilotz thread feed disconnected', error);
        }
        if (controller.signal.aborted) return;
        if (activeOperationsRef.current.size === 0) {
          setFeedConnectionStatus('idle');
          setIsRecoveringStream(false);
          return;
        }
        if (!sawEvent) reconnectAttempt += 1;
        setFeedConnectionStatus('reconnecting');
        setIsRecoveringStream(true);
        await delay(feedRetryDelay(reconnectAttempt, serverRetry));
      }
    })();

    return () => {
      controller.abort();
      if (feedAbortControllerRef.current === controller) {
        feedAbortControllerRef.current = null;
      }
    };
  }, [currentThreadId, feedBootstrap, getRequestHeaders, loadThreadMessages, processThreadFeedEvent]);

  // Initialize when userId changes
  useEffect(() => {
    initializationAbortControllerRef.current?.abort();
    const controller = new AbortController();
    initializationAbortControllerRef.current = controller;
    const generation = initializationRef.current.generation + 1;
    initializationRef.current = {
      userId,
      started: Boolean(userId),
      generation,
    };
    const isCurrent = () => userId !== null && isCurrentInitializationRun(
      initializationRef.current,
      { userId, generation },
      controller.signal,
    );

    if (userId) {
      const init = async () => {
        // Use URL thread ID as preferred if available
        const urlPreferredThread = isUrlSyncEnabled ? urlState.threadId : undefined;
        const preferredThreadId = await fetchAndSetThreadsState(
          userId,
          urlPreferredThread,
          { signal: controller.signal, isCurrent },
        );
        if (!isCurrent()) return;
        if (preferredThreadId) {
          await loadThreadMessages(preferredThreadId);
        } else if (bootstrap && isCurrent()) {
          await bootstrapConversation(userId);
        }
      };
      void init();
    } else {
      reset();
    }
    return () => {
      controller.abort();
      if (initializationAbortControllerRef.current === controller) {
        initializationAbortControllerRef.current = null;
      }
      if (initializationRef.current.generation === generation) {
        initializationRef.current = {
          userId: null,
          started: false,
          generation: generation + 1,
        };
      }
    };
    // urlState.threadId intentionally excluded: only needed on first init (captured
    // by the lazy initializer in useUrlState). Including it would re-trigger the
    // effect when the thread-sync effect writes back to the URL.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, fetchAndSetThreadsState, loadThreadMessages, bootstrapConversation, reset, bootstrap, isUrlSyncEnabled]);

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

  const activityNotice = isStopping
    ? {
      tone: 'info' as const,
      message: 'Stopping the current operation...',
    }
    : canonicalLoadStatus === 'retrying'
    ? {
      tone: 'info' as const,
      message: 'Connection interrupted. Retrying thread synchronization...',
    }
    : canonicalLoadStatus === 'failed'
    ? {
      tone: 'error' as const,
      message: 'Thread history could not be loaded. Refresh to try again.',
    }
    : feedConnectionStatus === 'reconnecting' ||
      (threadActivityStatus === 'running' && isRecoveringStream)
    ? {
      tone: 'info' as const,
      message: 'Connection interrupted. Reconnecting to live updates...',
    }
    : feedConnectionStatus === 'failed'
    ? {
      tone: 'error' as const,
      message: 'Live updates could not be reconnected. Refresh to synchronize this thread.',
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
    isStopping,
    feedConnectionStatus,
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
