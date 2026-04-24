// deno-lint-ignore-file no-explicit-any
import { useState, useCallback, useRef, useEffect } from 'react';
import {
  runCopilotzStream,
  fetchThreads,
  fetchThreadMessagesPage,
  updateThread as updateThreadApi,
  deleteThread as deleteThreadApi,
} from './copilotzService';
import { resolveAssetsInMessages } from './assetsService';
import type { ChatMessage as ChatViewMessage, ChatThread, MediaAttachment, ChatUserContext } from '@copilotz/chat-ui';
import { useUrlState } from './useUrlState';
import type { EventInterceptor, RunErrorInterceptor, SpecialChatState } from './specialState';
import type { RequestHeadersProvider, RestMessagePageInfo } from './copilotzService';
import {
  appendAssistantToolCall,
  applyAssistantToolResult,
  closeAssistantMessage,
  finalizeAssistantMessage,
  hasVisibleAssistantOutput,
  type InternalChatMessage,
  updateAssistantMessageToken,
  syncAssistantActivity,
  toPublicChatMessage,
} from './activity';

const nowTs = () => Date.now();
const generateId = () =>
  (globalThis.crypto?.randomUUID?.() ?? `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`) as string;
const isAbortError = (error: unknown) => (
  error instanceof DOMException && error.name === 'AbortError'
) || (typeof error === 'object' && error !== null && 'name' in error && (error as { name?: string }).name === 'AbortError');
const getEventPayload = (event: any) => event?.payload ?? event;
const getEventSenderType = (payload: any): string | undefined => payload?.senderType || payload?.sender?.type;

const isInternalMessageMetadata = (
  metadata?: Record<string, unknown> | null,
): boolean => metadata?.visibility === 'internal';

const normalizeAgentIdentity = (
  agent?: { id?: string | null; name?: string | null } | null,
): { senderAgentId?: string; senderName?: string } => {
  const senderAgentId = typeof agent?.id === 'string' && agent.id.length > 0
    ? agent.id
    : undefined;
  const senderName = typeof agent?.name === 'string' && agent.name.length > 0
    ? agent.name
    : senderAgentId;

  return {
    ...(senderAgentId ? { senderAgentId } : {}),
    ...(senderName ? { senderName } : {}),
  };
};

const messageAgentKey = (message: ChatViewMessage): string | null => {
  if (message.role !== 'assistant') return null;
  return message.senderAgentId ?? message.senderName ?? null;
};

type ServerThread = Awaited<ReturnType<typeof fetchThreads>>[number];
type ServerMessage = Awaited<ReturnType<typeof fetchThreadMessagesPage>>['data'][number];
type AgentIdentity = { senderAgentId?: string; senderName?: string };

const resolveLiveAgentIdentity = (event: any): AgentIdentity => {
  const payload = getEventPayload(event);
  const agent = (
    payload?.agent && typeof payload.agent === 'object'
      ? payload.agent
      : event?.agent && typeof event.agent === 'object'
        ? event.agent
        : null
  ) as { id?: string | null; name?: string | null } | null;

  if (agent) {
    return normalizeAgentIdentity(agent);
  }

  const sender = (
    payload?.sender && typeof payload.sender === 'object'
      ? payload.sender
      : event?.sender && typeof event.sender === 'object'
        ? event.sender
        : null
  ) as { id?: string | null; name?: string | null } | null;

  return normalizeAgentIdentity({
    id:
      typeof payload?.senderId === 'string' ? payload.senderId
      : typeof sender?.id === 'string' ? sender.id
      : null,
    name:
      typeof payload?.senderName === 'string' ? payload.senderName
      : typeof sender?.name === 'string' ? sender.name
      : null,
  });
};

const canAttachToStreamingAssistant = (
  message: ChatViewMessage | undefined,
  incomingAgentKey: string | null,
): boolean => {
  if (!message || message.role !== 'assistant' || !message.isStreaming) {
    return false;
  }

  const currentAgentKey = messageAgentKey(message);
  return !incomingAgentKey || !currentAgentKey || currentAgentKey === incomingAgentKey;
};

type ToolCallStatus = 'pending' | 'running' | 'completed' | 'failed';
type ParsedToolCall = {
  id?: string;
  name: string;
  arguments: Record<string, unknown>;
  status: ToolCallStatus;
  result?: unknown;
};

type ToolResultUpdate = {
  id?: string;
  name?: string;
  status: ToolCallStatus;
  result?: unknown;
  endTime: number;
};

const THREAD_MESSAGES_PAGE_SIZE = 50;

const createEmptyMessagePageInfo = (): RestMessagePageInfo => ({
  hasMoreBefore: false,
  oldestMessageId: null,
  newestMessageId: null,
});

const normalizeToolStatus = (status: unknown): ToolCallStatus => {
  if (status === 'pending') return 'pending';
  if (status === 'running' || status === 'processing') return 'running';
  if (status === 'failed') return 'failed';
  return 'completed';
};

const parseToolArguments = (value: unknown): Record<string, unknown> => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // Ignore invalid JSON and fall through to empty args.
    }
  }
  return {};
};

const matchesToolResultUpdate = (
  target: { id?: string; name?: string },
  update: Pick<ToolResultUpdate, 'id' | 'name'>,
): boolean => {
  if (update.id && target.id) {
    return update.id === target.id;
  }

  return Boolean(update.name && target.name && update.name === target.name);
};

const findMatchingToolCallIndex = (
  toolCalls: NonNullable<InternalChatMessage['_activityToolCalls']>,
  update: ToolResultUpdate,
): number => toolCalls.findIndex((toolCall) => (
  matchesToolResultUpdate(
    { id: toolCall.id, name: toolCall.name },
    update,
  ) &&
  (toolCall.status === 'pending' || toolCall.status === 'running' || typeof toolCall.result === 'undefined')
));

const applyToolResultUpdateToMessages = (
  messages: InternalChatMessage[],
  update: ToolResultUpdate,
  assistantPatch?: Partial<InternalChatMessage>,
): { messages: InternalChatMessage[]; matched: boolean } => {
  const nextMessages = [...messages];

  for (let i = nextMessages.length - 1; i >= 0; i--) {
    const message = nextMessages[i];
    if (message.role !== 'assistant' || !Array.isArray(message._activityToolCalls) || message._activityToolCalls.length === 0) {
      continue;
    }

    const toolCallIndex = findMatchingToolCallIndex(message._activityToolCalls, update);
    if (toolCallIndex === -1) continue;

    nextMessages[i] = syncAssistantActivity({
      ...applyAssistantToolResult(message, {
        ...(update.id ? { id: update.id } : {}),
        name: update.name ?? message._activityToolCalls[toolCallIndex].name,
        status: update.status,
        ...(update.result !== undefined ? { result: update.result } : {}),
        endTime: update.endTime,
      }),
      ...(assistantPatch ?? {}),
    });

    return { messages: nextMessages, matched: true };
  }

  return { messages, matched: false };
};

const extractLiveToolCall = (payload: Record<string, unknown> | undefined): ParsedToolCall | null => {
  const toolCall = payload?.toolCall as Record<string, unknown> | undefined;
  if (!toolCall) return null;

  const tool = toolCall.tool as Record<string, unknown> | undefined;
  const name = typeof tool?.name === 'string'
    ? tool.name
    : typeof tool?.id === 'string'
      ? tool.id
      : 'tool';
  const result = toolCall.output !== undefined ? toolCall.output : undefined;

  return {
    ...(typeof toolCall.id === 'string' ? { id: toolCall.id } : {}),
    name,
    arguments: parseToolArguments(toolCall.args),
    status: normalizeToolStatus(toolCall.status ?? payload?.status ?? 'running'),
    ...(result !== undefined ? { result } : {}),
  };
};

const extractLiveToolResultUpdate = (
  payload: Record<string, unknown> | undefined,
): ToolResultUpdate => {
  const tool = payload?.tool as Record<string, unknown> | undefined;
  const result =
    payload?.projectedOutput !== undefined
      ? payload.projectedOutput
      : payload?.output !== undefined
        ? payload.output
        : payload?.content;

  return {
    ...(typeof payload?.toolCallId === 'string' ? { id: payload.toolCallId } : {}),
    ...(typeof tool?.name === 'string'
      ? { name: tool.name }
      : typeof tool?.id === 'string'
        ? { name: tool.id }
        : {}),
    status: normalizeToolStatus(payload?.status),
    ...(result !== undefined ? { result } : {}),
    endTime: nowTs(),
  };
};

const extractToolCallsFromServerMessage = (msg: ServerMessage): ParsedToolCall[] => {
  const metadata = (msg.metadata ?? undefined) as Record<string, unknown> | undefined;
  const topLevelToolCalls = Array.isArray((msg as unknown as { toolCalls?: Array<Record<string, unknown>> }).toolCalls)
    ? ((msg as unknown as { toolCalls?: Array<Record<string, unknown>> }).toolCalls || [])
    : [];
  const metadataToolCalls = Array.isArray(metadata?.toolCalls)
    ? (metadata.toolCalls as Array<Record<string, unknown>>)
    : [];

  const usedMetadataIndexes = new Set<number>();
  const parsed: ParsedToolCall[] = [];

  const extractToolName = (obj: Record<string, unknown>): string | undefined => {
    if (typeof obj.name === 'string') return obj.name;
    const t = obj.tool as Record<string, unknown> | undefined;
    if (typeof t?.name === 'string') return t.name;
    if (typeof t?.id === 'string') return t.id;
    return undefined;
  };

  const findMatchingMetadataIndex = (toolCall: Record<string, unknown>): number => {
    const id = typeof toolCall.id === 'string' ? toolCall.id : undefined;
    const name = extractToolName(toolCall);

    const byId = id
      ? metadataToolCalls.findIndex((candidate, idx) => !usedMetadataIndexes.has(idx) && candidate?.id === id)
      : -1;
    if (byId >= 0) return byId;

    return name
      ? metadataToolCalls.findIndex((candidate, idx) => !usedMetadataIndexes.has(idx) && extractToolName(candidate) === name)
      : -1;
  };

  const parseToolCall = (
    primary: Record<string, unknown>,
    secondary?: Record<string, unknown>,
  ): ParsedToolCall => {
    const id = typeof primary.id === 'string'
      ? primary.id
      : (typeof secondary?.id === 'string' ? secondary.id : undefined);
    const toolObj = primary.tool as Record<string, unknown> | undefined;
    const secondaryToolObj = secondary?.tool as Record<string, unknown> | undefined;
    const name = typeof primary.name === 'string'
      ? primary.name
      : typeof toolObj?.name === 'string'
        ? toolObj.name
        : typeof toolObj?.id === 'string'
          ? toolObj.id
          : typeof secondary?.name === 'string'
            ? secondary.name
            : typeof secondaryToolObj?.name === 'string'
              ? secondaryToolObj.name
              : typeof secondaryToolObj?.id === 'string'
                ? secondaryToolObj.id
                : 'tool';
    const argsRaw =
      primary.args ?? primary.arguments ?? secondary?.args ?? secondary?.arguments;
    const result =
      primary.output !== undefined
        ? primary.output
        : primary.result !== undefined
          ? primary.result
          : secondary?.output !== undefined
            ? secondary.output
            : secondary?.result;
    const status = normalizeToolStatus(primary.status ?? secondary?.status);

    return {
      ...(id ? { id } : {}),
      name,
      arguments: parseToolArguments(argsRaw),
      ...(result !== undefined ? { result } : {}),
      status,
    };
  };

  topLevelToolCalls.forEach((toolCall) => {
    const metadataIndex = findMatchingMetadataIndex(toolCall);
    const metadataCall = metadataIndex >= 0 ? metadataToolCalls[metadataIndex] : undefined;
    if (metadataIndex >= 0) usedMetadataIndexes.add(metadataIndex);
    parsed.push(parseToolCall(toolCall, metadataCall));
  });

  metadataToolCalls.forEach((toolCall, index) => {
    if (usedMetadataIndexes.has(index)) return;
    parsed.push(parseToolCall(toolCall));
  });

  return parsed;
};

const extractToolResultUpdateFromMessage = (msg: ServerMessage): ToolResultUpdate | null => {
  if (msg.senderType !== 'tool') return null;

  const toolCalls = extractToolCallsFromServerMessage(msg);
  if (!Array.isArray(toolCalls) || toolCalls.length === 0) return null;

  const firstToolCall = toolCalls[0];
  const metadata = (msg.metadata ?? undefined) as Record<string, unknown> | undefined;
  const fallbackResult = metadata?.output;
  const result = firstToolCall.result !== undefined ? firstToolCall.result : fallbackResult;

  return {
    ...(firstToolCall.id ? { id: firstToolCall.id } : {}),
    ...(firstToolCall.name ? { name: firstToolCall.name } : {}),
    ...(result !== undefined ? { result } : {}),
    status: firstToolCall.status,
    endTime: msg.createdAt ? new Date(msg.createdAt).getTime() : nowTs(),
  };
};

const mergePersistedToolResults = (
  messages: InternalChatMessage[],
  updates: ToolResultUpdate[],
): InternalChatMessage[] => {
  if (updates.length === 0) return messages;

  let nextMessages = messages;
  for (const update of updates) {
    nextMessages = applyToolResultUpdateToMessages(nextMessages, update).messages;
  }

  return nextMessages;
};

const prependUniqueMessages = (
  olderMessages: InternalChatMessage[],
  currentMessages: InternalChatMessage[],
): InternalChatMessage[] => {
  if (olderMessages.length === 0) return currentMessages;
  if (currentMessages.length === 0) return olderMessages;

  const seen = new Set<string>();
  const combined: InternalChatMessage[] = [];

  for (const message of [...olderMessages, ...currentMessages]) {
    if (seen.has(message.id)) continue;
    seen.add(message.id);
    combined.push(message);
  }

  return combined;
};

const convertServerMessage = (msg: ServerMessage): InternalChatMessage => {
  const timestamp = msg.createdAt ? new Date(msg.createdAt).getTime() : nowTs();
  const metadata = (msg.metadata ?? undefined) as Record<string, unknown> | undefined;
  const attachmentsMeta = Array.isArray(metadata?.attachments)
    ? (metadata!.attachments as Array<Record<string, unknown>>)
    : [];

  const attachments: MediaAttachment[] = attachmentsMeta.flatMap((att) => {
    const kind = typeof att.kind === 'string' ? att.kind : undefined;
    const dataUrl = typeof att.dataUrl === 'string' ? att.dataUrl : undefined;
    const mimeType = typeof att.mimeType === 'string' ? att.mimeType : undefined;
    if (!dataUrl) return [];

    if (kind === 'image') {
      return [{ kind: 'image', dataUrl, mimeType: mimeType ?? 'image/jpeg' }] as MediaAttachment[];
    }
    if (kind === 'audio') {
      return [{
        kind: 'audio',
        dataUrl,
        mimeType: mimeType ?? 'audio/webm',
        durationMs: typeof att.durationMs === 'number' ? att.durationMs : undefined,
      }] as MediaAttachment[];
    }
    if (kind === 'video') {
      return [{
        kind: 'video',
        dataUrl,
        mimeType: mimeType ?? 'video/mp4',
        durationMs: typeof att.durationMs === 'number' ? att.durationMs : undefined,
        poster: typeof att.poster === 'string' ? att.poster : undefined,
      }] as MediaAttachment[];
    }
    return [] as MediaAttachment[];
  });

  const role = msg.senderType === 'agent'
    ? 'assistant'
    : msg.senderType === 'user'
      ? 'user'
      : 'assistant';

  const parsedToolCalls = extractToolCallsFromServerMessage(msg);
  const shouldRenderToolCalls = msg.senderType !== 'tool';
  const mappedToolCalls = parsedToolCalls.map((toolCall) => ({
    id: toolCall.id ?? generateId(),
    name: toolCall.name,
    arguments: toolCall.arguments,
    status: toolCall.status,
    ...(toolCall.result !== undefined ? { result: toolCall.result } : {}),
  }));

  const hasToolCalls = shouldRenderToolCalls && mappedToolCalls.length > 0;
  const isToolSender = msg.senderType === 'tool';
  const content =
    isToolSender
      ? '' // Do not render textual content for tool messages; attachments only
      : ((msg.content ?? '') || (hasToolCalls ? '' : ''));

  const reasoning = typeof (msg as any).reasoning === 'string' && (msg as any).reasoning.length > 0
    ? (msg as any).reasoning as string
    : undefined;

  // Extract sender identity for multi-agent display
  const senderAgentId = msg.senderType === 'agent' ? (msg.senderId ?? undefined) : undefined;
  const senderName = msg.senderType === 'agent'
    ? (typeof (msg as any).senderName === 'string' ? (msg as any).senderName : (msg.senderId ?? undefined))
    : undefined;

  return syncAssistantActivity({
    id: msg.id,
    role,
    content,
    timestamp,
    attachments: attachments.length > 0 ? attachments : undefined,
    isStreaming: false,
    isComplete: true,
    metadata,
    _activityToolCalls: hasToolCalls ? mappedToolCalls : undefined,
    ...(reasoning ? { _activityReasoning: reasoning } : {}),
    ...(senderAgentId ? { senderAgentId } : {}),
    ...(senderName ? { senderName } : {}),
  });
};

export interface UseCopilotzOptions {
  userId: string | null;
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

export function useCopilotz({
  userId,
  initialContext,
  bootstrap,
  defaultThreadName,
  onToolOutput,
  preferredAgentName,
  participants,
  targetAgentName,
  getRequestHeaders,
  eventInterceptor,
  runErrorInterceptor,
}: UseCopilotzOptions) {
  // URL state — thread ID is synced to/from URL by default
  const {
    state: urlState,
    setThreadId: setUrlThreadId,
    isEnabled: isUrlSyncEnabled,
  } = useUrlState();

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
  const persistedToolUpdatesRef = useRef<ToolResultUpdate[]>([]);
  // Buffer live TOOL_RESULT updates that arrive before their matching TOOL_CALL
  // has been rendered. We reconcile them as soon as the TOOL_CALL lands.
  const liveToolUpdatesRef = useRef<ToolResultUpdate[]>([]);

  // Sync refs on every render (more efficient than multiple useEffects)
  threadsRef.current = threads;
  threadMetadataMapRef.current = threadMetadataMap;
  threadExternalIdMapRef.current = threadExternalIdMap;
  currentThreadIdRef.current = currentThreadId;
  currentThreadExternalIdRef.current = currentThreadExternalId;
  userContextSeedRef.current = userContextSeed;
  messagePageInfoRef.current = messagePageInfo;
  isLoadingOlderMessagesRef.current = isLoadingOlderMessages;
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

  const processToolOutput = useCallback((output: Record<string, unknown>) => {
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
  }, [onToolOutput]);

  const clearSpecialState = useCallback(() => {
    setSpecialState(null);
  }, []);

  const applyEventInterceptor = useCallback((event: unknown) => {
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
  }, [eventInterceptor]);

  const getSpecialStateFromError = useCallback((error: unknown) => {
    if (!runErrorInterceptor) return null;
    try {
      return runErrorInterceptor(error) ?? null;
    } catch (interceptorError) {
      console.error('Error in Copilotz run error interceptor', interceptorError);
      return null;
    }
  }, [runErrorInterceptor]);

  const handleStreamMessageEvent = useCallback((event: any) => {
    const payload = getEventPayload(event);
    if (!payload) return;
    const liveMetadata = (
      event?.metadata && typeof event.metadata === 'object'
        ? event.metadata
        : payload?.metadata
    ) as Record<string, unknown> | undefined;
    if (isInternalMessageMetadata(liveMetadata)) {
      return;
    }
    const senderType = getEventSenderType(payload);
    if (senderType !== 'agent' || typeof payload.content !== 'string') return;

    // Fallback path for custom/non-contract events that still look like an
    // assistant artifact message.
    const agentIdentity = resolveLiveAgentIdentity(event);
    const incomingAgentKey = agentIdentity.senderAgentId ?? agentIdentity.senderName ?? null;

    setMessages((prev) => {
      const next = [...prev];
      for (let i = next.length - 1; i >= 0; i--) {
        const m = next[i];
        if (canAttachToStreamingAssistant(m, incomingAgentKey)) {
          next[i] = syncAssistantActivity({
            ...m,
            content: payload.content,
            isStreaming: false,
            isComplete: true,
            ...agentIdentity,
          });
          return next;
        }
      }

      const trimmedContent = payload.content.trim();
      if (!trimmedContent) {
        return prev;
      }

      return [
        ...next,
        syncAssistantActivity({
          id: generateId(),
          role: 'assistant',
          content: payload.content,
          timestamp: nowTs(),
          isStreaming: false,
          isComplete: true,
          metadata: liveMetadata,
          ...agentIdentity,
        } as InternalChatMessage),
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
        messageCount: typeof thread.metadata?.messageCount === 'number'
          ? thread.metadata!.messageCount as number
          : 0,
        isArchived: thread.status === 'archived',
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

  const fetchAndSetThreadsState = useCallback(async (uid: string, preferredExternalId?: string | null) => {
    try {
      const rawThreads = await fetchThreads(uid, getRequestHeaders);
      return updateThreadsState(rawThreads, preferredExternalId);
    } catch (error) {
      if (isAbortError(error)) return;
      console.error('Error loading threads', error);
      return null;
    }
  }, [updateThreadsState, getRequestHeaders]);

  const prepareThreadMessages = useCallback(async (rawMessages: ServerMessage[]) => {
    const resolvedMessages = await resolveAssetsInMessages(rawMessages as unknown as any[]);

    resolvedMessages.forEach((msg: any) => {
      if (msg.senderType === 'tool') {
        const metadata = msg.metadata as Record<string, unknown> | undefined;
        const output = (metadata?.output ?? metadata) as Record<string, unknown> | undefined;
        if (output) processToolOutput(output);
      }
    });

    const toolResultUpdates = resolvedMessages
      .map((msg) => extractToolResultUpdateFromMessage(msg as unknown as ServerMessage))
      .filter((update): update is ToolResultUpdate => update !== null);

    const viewMessages = resolvedMessages
      .filter((msg) => {
        const meta = (msg.metadata ?? {}) as Record<string, unknown>;
        if (isInternalMessageMetadata(meta)) {
          return false;
        }
        const text = (typeof msg.content === 'string' ? msg.content : '').trim();
        const hasText = text.length > 0;
        const hasToolCalls = extractToolCallsFromServerMessage(msg as unknown as ServerMessage).length > 0;
        const hasAttachments = Array.isArray(meta.attachments) && (meta.attachments as unknown[]).length > 0;
        if (msg.senderType === 'tool') {
          return hasAttachments;
        }
        return hasText || hasToolCalls || hasAttachments;
      })
      .map(convertServerMessage);

    return {
      viewMessages,
      toolResultUpdates,
    };
  }, [processToolOutput]);

  const loadThreadMessages = useCallback(async (threadId: string) => {
    const requestId = messagesRequestRef.current + 1;
    messagesRequestRef.current = requestId;
    setIsMessagesLoading(true);
    setIsLoadingOlderMessages(false);
    setMessagePageInfo(createEmptyMessagePageInfo());
    persistedToolUpdatesRef.current = [];
    liveToolUpdatesRef.current = [];
    try {
      const page = await fetchThreadMessagesPage(
        threadId,
        { limit: THREAD_MESSAGES_PAGE_SIZE },
        getRequestHeaders,
      );
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
  }, [getRequestHeaders, prepareThreadMessages]);

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
      const page = await fetchThreadMessagesPage(
        threadId,
        { limit: THREAD_MESSAGES_PAGE_SIZE, before },
        getRequestHeaders,
      );
      const { viewMessages, toolResultUpdates } = await prepareThreadMessages(page.data);
      if (messagesRequestRef.current !== requestId) return;

      persistedToolUpdatesRef.current = [
        ...toolResultUpdates,
        ...persistedToolUpdatesRef.current,
      ];

      setMessages((prev) => mergePersistedToolResults(
        prependUniqueMessages(viewMessages, prev),
        persistedToolUpdatesRef.current,
      ));
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

  const handleSelectThread = useCallback(async (threadId: string) => {
    setCurrentThreadId(threadId);
    setMessages([]);
    setMessagePageInfo(createEmptyMessagePageInfo());
    persistedToolUpdatesRef.current = [];
    // Use ref for external map to avoid re-creation
    const extMap = threadExternalIdMapRef.current;
    setCurrentThreadExternalId(extMap[threadId] ?? null);
    await loadThreadMessages(threadId);
  }, [loadThreadMessages]);

  const handleCreateThread = useCallback((title?: string) => {
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
    setThreadMetadataMap((prev) => ({ ...prev, [id]: { pendingTitle: title?.trim() || undefined } }));
    setThreadExternalIdMap((prev) => ({ ...prev, [id]: id }));
    setCurrentThreadId(id);
    setCurrentThreadExternalId(id);
    setMessages([]);
    setMessagePageInfo(createEmptyMessagePageInfo());
    persistedToolUpdatesRef.current = [];
  }, []);

  const handleRenameThread = useCallback(async (threadId: string, newTitle: string) => {
    const trimmedTitle = newTitle.trim();
    if (!trimmedTitle) return;

    // Update local state immediately
    setThreads((prev) =>
      prev.map((t) => (t.id === threadId ? { ...t, title: trimmedTitle, updatedAt: nowTs() } : t))
    );

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
  }, [userId, fetchAndSetThreadsState, getRequestHeaders]);

  const handleArchiveThread = useCallback(async (threadId: string) => {
    // Find current archive status
    const thread = threadsRef.current.find((t) => t.id === threadId);
    if (!thread) return;

    const newArchivedStatus = !thread.isArchived;

    // Update local state immediately
    setThreads((prev) =>
      prev.map((t) => (t.id === threadId ? { ...t, isArchived: newArchivedStatus, updatedAt: nowTs() } : t))
    );

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
  }, [userId, fetchAndSetThreadsState, getRequestHeaders]);

  const handleDeleteThread = useCallback(async (threadId: string) => {
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
  }, [userId, fetchAndSetThreadsState, loadThreadMessages, getRequestHeaders]);

  const handleStop = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
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

    const mimeType = payload.mime || 'image/png';
    const dataUrl = payload.dataUrl;

    // Determine attachment kind based on mime type
    let kind: 'image' | 'audio' | 'video' = 'image';
    if (mimeType.startsWith('audio/')) {
      kind = 'audio';
    } else if (mimeType.startsWith('video/')) {
      kind = 'video';
    }

    const mediaAttachment: MediaAttachment = {
      kind,
      dataUrl,
      mimeType,
    };

    setMessages((prev) => prev.map((msg) => (msg.id === assistantMessageId
      ? syncAssistantActivity({
        ...msg,
        attachments: [...(msg.attachments || []), mediaAttachment],
      })
      : msg)));
  }, []);

  const sendCopilotzMessage = useCallback(async (
    params: {
      threadId?: string | null;
      threadExternalId?: string | null;
      content: string;
      attachments?: MediaAttachment[];
      metadata?: Record<string, unknown>;
      threadMetadata?: Record<string, unknown>;
      toolCalls?: Array<{ name: string; args: Record<string, unknown> }>;
      userId: string;
      userName?: string;
      userMetadata?: Record<string, unknown>;
      agentName?: string | null;
      onBeforeStart?: (assistantMessageId: string) => void;
    },
  ) => {
    // Track the current live assistant message so one sender streak stays in one bubble.
    let currentAssistantId = generateId();
    let currentAssistantIdentity: AgentIdentity = {};
    params.onBeforeStart?.(currentAssistantId);

    let hasStreamProgress = false;

    // Combined function to ensure bubble exists AND update content in a single setMessages call
    const updateStreamingMessage = (
      partial: string,
      opts?: {
        isReasoning?: boolean;
        agent?: { id?: string | null; name?: string | null } | null;
      },
    ) => {
      if (partial && partial.length > 0) {
        hasStreamProgress = true;
      }

      const isReasoning = opts?.isReasoning ?? false;
      const nextIdentity = normalizeAgentIdentity(opts?.agent ?? null);
      if (nextIdentity.senderAgentId || nextIdentity.senderName) {
        currentAssistantIdentity = {
          ...currentAssistantIdentity,
          ...nextIdentity,
        };
      }
      const agentIdentity = currentAssistantIdentity;
      const nextAgentKey = agentIdentity.senderAgentId ?? agentIdentity.senderName ?? null;

      const applyUpdate = (msg: InternalChatMessage): InternalChatMessage => {
        return updateAssistantMessageToken(msg, {
          partial,
          isReasoning,
          agentIdentity,
        });
      };
      
      setMessages((prev) => {
        const idx = prev.findIndex((m) => m.id === currentAssistantId);
        if (idx >= 0 && canAttachToStreamingAssistant(prev[idx], nextAgentKey)) {
          const msg = prev[idx];
          const next = applyUpdate(msg);
          if (msg.content === next.content && msg._activityReasoning === next._activityReasoning && msg._activityReasoningStreaming === next._activityReasoningStreaming && msg.isStreaming === next.isStreaming && msg.isComplete === next.isComplete) {
            return prev;
          }
          const updated = [...prev];
          updated[idx] = next;
          return updated;
        }
        
        const last = prev[prev.length - 1];
        if (canAttachToStreamingAssistant(last, nextAgentKey)) {
          currentAssistantId = last.id;
          const next = applyUpdate(last);
          if (last.content === next.content && last._activityReasoning === next._activityReasoning && last._activityReasoningStreaming === next._activityReasoningStreaming && last.isStreaming === next.isStreaming && last.isComplete === next.isComplete) {
            return prev;
          }
          const updated = [...prev];
          updated[prev.length - 1] = next;
          return updated;
        }
        
        const lastStreamingBelongsToDifferentAgent =
          Boolean(nextAgentKey) &&
          last?.role === 'assistant' &&
          last.isStreaming &&
          Boolean(messageAgentKey(last)) &&
          messageAgentKey(last) !== nextAgentKey;

        if (
          !prev.length ||
          (prev[prev.length - 1].role !== 'assistant' || !prev[prev.length - 1].isStreaming) ||
          lastStreamingBelongsToDifferentAgent
        ) {
          const newId = generateId();
          currentAssistantId = newId;
          const base: InternalChatMessage = {
            id: newId,
            role: 'assistant' as const,
            content: '',
            timestamp: nowTs(),
            isStreaming: true,
            isComplete: false,
            ...currentAssistantIdentity,
          };
          return [...prev, applyUpdate(base)];
        }
        
        return prev;
      });
    };

    const finalizeCurrentAssistantBubble = () => {
      setMessages((prev) => {
        const idx = prev.findIndex((m) => m.id === currentAssistantId);
        if (idx < 0) return prev;
        const msg = prev[idx];
        // Skip update if already finalized
        if (!msg.isStreaming && msg.isComplete) return prev;
        const updated = [...prev];
        updated[idx] = closeAssistantMessage(msg);
        return updated;
      });
    };

    // Using Refs for accessing current state inside callback
    const curThreadId = currentThreadIdRef.current;

    const applyLiveToolResultUpdate = (update: ToolResultUpdate) => {
      let matched = false;
      setMessages((prev) => {
        const next = applyToolResultUpdateToMessages(prev, update, {
          isStreaming: true,
          isComplete: false,
        });
        matched = next.matched;
        return next.matched ? next.messages : prev;
      });

      if (!matched) {
        liveToolUpdatesRef.current.push(update);
      }
    };

    const finalizeActiveAssistantTurn = (finalAnswer?: string) => {
      setMessages((prev) => {
        const currentIdx = prev.findIndex((message) => (
          message.id === currentAssistantId &&
          message.role === 'assistant'
        ));
        const fallbackIdx = currentIdx >= 0
          ? currentIdx
          : (() => {
            for (let i = prev.length - 1; i >= 0; i--) {
                if (prev[i].role === 'assistant' && prev[i].isStreaming) {
                  return i;
                }
            }
            return -1;
          })();

        if (fallbackIdx < 0) return prev;

        const message = prev[fallbackIdx];
        const nextMessage = finalizeAssistantMessage(message, finalAnswer);

        if (
          message.content === nextMessage.content &&
          message.isStreaming === nextMessage.isStreaming &&
          message.isComplete === nextMessage.isComplete &&
          message._activityReasoningStreaming === nextMessage._activityReasoningStreaming
        ) {
          return prev;
        }

        const updated = [...prev];
        updated[fallbackIdx] = nextMessage;
        currentAssistantId = nextMessage.id;
        return updated;
      });
    };

    // Build a ServerMessage-like object from selected streaming artifact events.
    const toServerMessageFromEvent = async (event: any): Promise<ServerMessage | null> => {
      if (!event) return null;
      const type = (event?.type as string) || '';
      const payload = event?.payload ?? event;

      // TOOL_CALL bubble
      if (type === 'TOOL_CALL') {
        const parsedToolCall = extractLiveToolCall(payload);
        if (!parsedToolCall) return null;

        return {
          id: generateId(),
          threadId: curThreadId ?? '',
          senderType: 'tool',
          content: '',
          toolCalls: [{
            id: parsedToolCall.id ?? generateId(),
            name: parsedToolCall.name,
            args: parsedToolCall.arguments,
            ...(parsedToolCall.result !== undefined ? { output: parsedToolCall.result } : {}),
            status: parsedToolCall.status,
          }] as Array<Record<string, unknown>>,
        } as unknown as ServerMessage;
      }

      return null;
    };

    const abortController = new AbortController();
    abortControllerRef.current?.abort();
    abortControllerRef.current = abortController;
    setIsStreaming(true);
    // Reset the live tool-result buffer at the start of every stream so
    // stale updates from a previous run can't leak into this one.
    liveToolUpdatesRef.current = [];

    try {
      const normalizedUserMetadata = params.userMetadata
        ? JSON.parse(JSON.stringify(params.userMetadata)) as Record<string, unknown>
        : undefined;

      const contextSeed = userContextSeedRef.current;
      const contextMetadata = contextSeed
        ? JSON.parse(JSON.stringify(contextSeed)) as Record<string, unknown>
        : undefined;
      const requestContent = params.content && params.content.length > 0 ? params.content : '';

      const metadataKey = params.threadId ?? params.threadExternalId ?? undefined;
      // Read from ref to avoid dependency on threadMetadataMap
      const currentThreadMetadataMap = threadMetadataMapRef.current;
      const messageMetadata = metadataKey ? currentThreadMetadataMap[metadataKey]?.userContext as Record<string, unknown> | undefined : undefined;
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
        onToken: (token, _isComplete, raw, opts) => updateStreamingMessage(token, {
          ...opts,
          agent: raw?.payload?.agent ?? raw?.agent ?? null,
        }),
        onMessageEvent: async (event: any) => {
          const intercepted = applyEventInterceptor(event);
          if (intercepted?.handled) {
            return;
          }

          const type = (event?.type as string) || '';
          const payload = getEventPayload(event);

          if (type === 'TOOL_RESULT') {
            processToolOutput((payload ?? {}) as Record<string, unknown>);
            applyLiveToolResultUpdate(extractLiveToolResultUpdate(
              (payload ?? {}) as Record<string, unknown>,
            ));
            return;
          }

          if (type === 'LLM_RESULT') {
            const finalAnswer = typeof payload?.answer === 'string' ? payload.answer : undefined;
            finalizeActiveAssistantTurn(finalAnswer);
            return;
          }

          if (type === 'MESSAGE' || type === 'NEW_MESSAGE') {
            return;
          }

          // TOOL_CALL events: render inside current assistant bubble.
          // NOTE: This branch stays synchronous so any immediately following
          // TOOL_RESULT can reconcile against the rendered tool call.
          if (type === 'TOOL_CALL') {
            const parsedToolCall = extractLiveToolCall(
              (payload ?? {}) as Record<string, unknown>,
            );
            if (!parsedToolCall) return;
            const eventAgentIdentity = resolveLiveAgentIdentity(event);
            if (eventAgentIdentity.senderAgentId || eventAgentIdentity.senderName) {
              currentAssistantIdentity = {
                ...currentAssistantIdentity,
                ...eventAgentIdentity,
              };
            }
            const callId = parsedToolCall.id ?? generateId();
            const toolName = parsedToolCall.name;

            // Drain any tool-result updates that arrived before this TOOL_CALL.
            const bufferedUpdates = liveToolUpdatesRef.current;
            const matchingUpdateIndex = bufferedUpdates.findIndex((upd) => (
              matchesToolResultUpdate({ id: callId, name: toolName }, upd)
            ));
            const bufferedUpdate = matchingUpdateIndex >= 0 ? bufferedUpdates[matchingUpdateIndex] : undefined;
            if (matchingUpdateIndex >= 0) {
              bufferedUpdates.splice(matchingUpdateIndex, 1);
            }

            const initialStatus: 'pending' | 'running' | 'completed' | 'failed' =
              bufferedUpdate ? bufferedUpdate.status : parsedToolCall.status;
            const initialResult = bufferedUpdate && bufferedUpdate.result !== undefined
              ? bufferedUpdate.result
              : parsedToolCall.result;
            const endTime = bufferedUpdate?.endTime;

            setMessages((prev) =>
              (() => {
                const appendToolCall = (msg: ChatViewMessage) => ({
                  ...appendAssistantToolCall(msg, {
                    id: callId,
                    name: toolName,
                    arguments: parsedToolCall.arguments,
                    ...(initialResult !== undefined ? { result: initialResult } : {}),
                    status: initialStatus,
                    startTime: Date.now(),
                    ...(endTime !== undefined ? { endTime } : {}),
                  }),
                });

                const currentIdx = prev.findIndex((message) => (
                  message.id === currentAssistantId &&
                  message.role === 'assistant' &&
                  message.isStreaming
                ));
                if (currentIdx >= 0) {
                  const next = [...prev];
                  next[currentIdx] = appendToolCall({
                    ...next[currentIdx],
                    isStreaming: true,
                    isComplete: false,
                    ...currentAssistantIdentity,
                  });
                  return next;
                }

                const last = prev[prev.length - 1];
                if (canAttachToStreamingAssistant(
                  last,
                  currentAssistantIdentity.senderAgentId ?? currentAssistantIdentity.senderName ?? null,
                )) {
                  currentAssistantId = last.id;
                  const next = [...prev];
                  next[prev.length - 1] = appendToolCall({
                    ...last,
                    isStreaming: true,
                    isComplete: false,
                    ...currentAssistantIdentity,
                  });
                  return next;
                }

                // No assistant message yet – create one to host the tool call
                const newId = generateId();
                currentAssistantId = newId;
                return [
                  ...prev,
                  appendToolCall({
                    id: newId,
                    role: 'assistant',
                    content: '',
                    timestamp: nowTs(),
                    isStreaming: true,
                    isComplete: false,
                    ...currentAssistantIdentity,
                  }),
                ];
              })(),
            );
            hasStreamProgress = true;
            return;
          }

          // Other event types (ASSET_CREATED, etc.) should render as their own bubbles
          const sm = await toServerMessageFromEvent(event);
          if (sm) {
            const viewMsg = convertServerMessage(sm as unknown as ServerMessage);
            finalizeCurrentAssistantBubble();
            setMessages((prev) => [...prev, viewMsg]);
            return;
          }

          // Fallback for unknown events
          handleStreamMessageEvent(event);
        },
        onAssetEvent: async (payload: any) => {
          const intercepted = applyEventInterceptor({ type: 'ASSET_CREATED', payload });
          if (intercepted?.handled) {
            return;
          }

          // Treat as ASSET_CREATED event in unified handler
          await (async () => {
            if (!hasStreamProgress) return;
            handleStreamAssetEvent(payload, currentAssistantId);
          })();
        },
        signal: abortController.signal,
      });
    } finally {
      setIsStreaming(false);
      setMessages((prev) => {
        const hasStreaming = prev.some((msg) => msg.isStreaming);
        if (!hasStreaming) return prev;
        return prev.map((msg) => (msg.isStreaming
          ? closeAssistantMessage(msg)
          : msg));
      });
      abortControllerRef.current = null;
    }

    return currentAssistantId;
  }, [applyEventInterceptor, handleStreamMessageEvent, handleStreamAssetEvent, getRequestHeaders]);

  const handleSendMessage = useCallback(async (content: string, attachments: MediaAttachment[] = []) => {
    if (!content.trim() && attachments.length === 0) return;
    if (!userId) return;

    const timestamp = nowTs();
    const curThreadId = currentThreadIdRef.current;
    const curThreadExtId = currentThreadExternalIdRef.current;

    const existingThreadId = curThreadId ?? undefined;
    // Use Ref to check without adding dependency
    const extMap = threadExternalIdMapRef.current;
    const isPlaceholderThread = existingThreadId
      ? extMap[existingThreadId] === existingThreadId
      : false;

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

    const userMessage: ChatViewMessage = {
      id: generateId(),
      role: 'user',
      content,
      timestamp,
      attachments: attachments.length > 0 ? attachments : undefined,
      isComplete: true,
    };

    // Create an assistant message placeholder with streaming state for typewriter effect
    const assistantPlaceholder: ChatViewMessage = {
      id: generateId(),
      role: 'assistant',
      content: '',
      timestamp: timestamp + 1,
      isStreaming: true,
      isComplete: false,
      ...(targetAgentNameRef.current ? { senderName: targetAgentNameRef.current } : {}),
    };

    // Add user message and assistant placeholder for typewriter loading effect
    setMessages((prev) => [...prev, userMessage as InternalChatMessage, syncAssistantActivity(assistantPlaceholder as InternalChatMessage)]);
    setSpecialState(null);

    // Use ref for threads check
    if (!threadsRef.current.some(t => t.id === conversationKey)) {
      const newThread: ChatThread = {
        id: conversationKey,
        title: content.slice(0, 40) || 'Nova conversa',
        createdAt: timestamp,
        updatedAt: timestamp,
        messageCount: 0,
      };
      setThreads(prev => [newThread, ...prev]);
      setThreadMetadataMap(prev => ({ ...prev, [conversationKey]: {} }));
      setThreadExternalIdMap(prev => ({ ...prev, [conversationKey]: effectiveThreadExternalId ?? null }));
    }

    try {
      await sendCopilotzMessage({
        threadId: threadIdForSend,
        threadExternalId: effectiveThreadExternalId,
        content,
        attachments,
        userId,
        // userName can be anything, but let's try to find it in context or just fallback
        userName: (userContextSeedRef.current?.profile as any)?.full_name ?? userId,
        agentName: preferredAgentRef.current,
        // Include pending title for new threads
        threadMetadata: pendingTitle ? { name: pendingTitle } : undefined,
      });

      // Wait to ensure the assistant message is persisted before refreshing
      await new Promise((r) => setTimeout(r, 1000));
      // Refresh threads list to update metadata (message count, timestamps, etc.)
      // Don't reload messages since we already have them from streaming
      await fetchAndSetThreadsState(userId, effectiveThreadExternalId ?? existingThreadId ?? null);
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
        const finalized = prev.map((msg) => (
          msg.isStreaming
            ? closeAssistantMessage(msg)
            : msg
        ));

        if (finalized.some(hasVisibleAssistantOutput)) {
          return finalized;
        }

        for (let i = finalized.length - 1; i >= 0; i--) {
          const message = finalized[i];
          if (message.role !== 'assistant') continue;

          const updated = [...finalized];
          updated[i] = syncAssistantActivity({
            ...message,
            content: 'Desculpe, ocorreu um erro ao gerar a resposta. Por favor, tente novamente.',
            isStreaming: false,
            isComplete: true,
          });
          return updated;
        }

        return [
          ...finalized,
          syncAssistantActivity({
            id: generateId(),
            role: 'assistant',
            content: 'Desculpe, ocorreu um erro ao gerar a resposta. Por favor, tente novamente.',
            timestamp: nowTs(),
            isStreaming: false,
            isComplete: true,
          }),
        ];
      });
    }
  }, [userId, fetchAndSetThreadsState, loadThreadMessages, sendCopilotzMessage, getSpecialStateFromError]);

  const bootstrapConversation = useCallback(async (uid: string) => {
    if (!bootstrap?.initialToolCalls && !bootstrap?.initialMessage) return;

    const bootstrapThreadExternalId = generateId();
    setCurrentThreadId(bootstrapThreadExternalId);
    setCurrentThreadExternalId(bootstrapThreadExternalId);
    setThreadExternalIdMap((prev) => ({ ...prev, [bootstrapThreadExternalId]: bootstrapThreadExternalId }));
    setThreadMetadataMap((prev) => ({ ...prev, [bootstrapThreadExternalId]: {} }));
    // Clear messages; let streaming create bubbles as needed
    setMessages([]);
    setMessagePageInfo(createEmptyMessagePageInfo());
    persistedToolUpdatesRef.current = [];
    setSpecialState(null);

    try {
      await sendCopilotzMessage({
        threadExternalId: bootstrapThreadExternalId,
        content: bootstrap.initialMessage || '',
        toolCalls: bootstrap.initialToolCalls,
        userId: uid,
        agentName: preferredAgentRef.current,
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
        syncAssistantActivity({
          id: generateId(),
          role: 'assistant',
          content: 'Não foi possível iniciar a conversa. Tente novamente mais tarde.',
          timestamp: nowTs(),
          isStreaming: false,
          isComplete: true,
        }),
      ]);
    }
  }, [fetchAndSetThreadsState, loadThreadMessages, sendCopilotzMessage, bootstrap, defaultThreadName, getSpecialStateFromError]);

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
      setUserContextSeed((prev) => ({ ...prev, ...(metadata.userContext as Partial<ChatUserContext>) }));
    }
  }, [currentThreadId, threadMetadataMap]);

  return {
    messages: messages.map(toPublicChatMessage),
    isMessagesLoading,
    isLoadingOlderMessages,
    messagePageInfo,
    threads,
    currentThreadId,
    isStreaming,
    specialState,
    clearSpecialState,
    userContextSeed,
    sendMessage: handleSendMessage,
    createThread: handleCreateThread,
    selectThread: handleSelectThread,
    renameThread: handleRenameThread,
    archiveThread: handleArchiveThread,
    deleteThread: handleDeleteThread,
    stopGeneration: handleStop,
    fetchAndSetThreadsState,
    loadThreadMessages,
    loadOlderMessages,
    reset,
  };
}
