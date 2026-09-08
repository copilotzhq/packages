import type {
  AdminActivityInterval,
  AdminActivityPoint,
  AdminAgentSummary,
  AdminBrainFilters,
  AdminBrainResponse,
  AdminCollectionItem,
  AdminDatePreset,
  AdminEventFilters,
  AdminMessage,
  AdminMessagePage,
  AdminMessagePageInfo,
  AdminOverview,
  AdminParticipantDetail,
  AdminParticipantSummary,
  AdminQueueEvent,
  AdminThreadDetail,
  AdminThreadSummary,
  RequestHeadersProvider,
} from "./types";
import {
  createUsageClient,
  type UsageDataSource,
} from "@copilotz/usage/client";

export interface AdminClientPaths {
  adminBase: string;
  collectionsBase: string;
  threadsBase: string;
}

export interface AdminClientOptions {
  baseUrl?: string;
  paths?: Partial<AdminClientPaths>;
  getRequestHeaders?: RequestHeadersProvider;
}

export interface AdminListOptions {
  namespace?: string;
  search?: string;
  limit?: number;
  offset?: number;
  before?: string;
  after?: string;
  filter?: Record<string, unknown>;
  sort?: Record<string, "asc" | "desc">;
  populate?: string[];
}

export interface CopilotzAdminClient {
  paths: AdminClientPaths;
  getOverview(options?: {
    range?: AdminDatePreset;
    namespace?: string;
  }): Promise<AdminOverview>;
  getActivity(options?: {
    range?: AdminDatePreset;
    interval?: AdminActivityInterval;
    namespace?: string;
  }): Promise<AdminActivityPoint[]>;
  getUsageDataSource(): UsageDataSource;
  listThreads(options?: AdminListOptions): Promise<AdminThreadSummary[]>;
  listParticipants(
    options?: AdminListOptions
  ): Promise<AdminParticipantSummary[]>;
  listAgents(
    options?: AdminListOptions & { range?: AdminDatePreset }
  ): Promise<AdminAgentSummary[]>;
  getThread(threadId: string): Promise<AdminThreadDetail>;
  getThreadMessages(
    threadId: string,
    options?: { limit?: number; after?: string }
  ): Promise<AdminMessagePage>;
  listEvents(options?: AdminEventFilters): Promise<AdminQueueEvent[]>;
  getThreadEvent(threadId: string): Promise<AdminQueueEvent | undefined>;
  getBrain(filters?: AdminBrainFilters): Promise<AdminBrainResponse>;
  listCollections(): Promise<string[]>;
  listCollectionItems(
    collection: string,
    options?: AdminListOptions
  ): Promise<AdminCollectionItem[]>;
  getCollectionItem(
    collection: string,
    itemId: string,
    options?: { namespace?: string; populate?: string[] }
  ): Promise<AdminCollectionItem>;
  createCollectionItem(
    collection: string,
    data: Record<string, unknown>,
    options?: { namespace?: string }
  ): Promise<AdminCollectionItem>;
  updateCollectionItem(
    collection: string,
    itemId: string,
    data: Record<string, unknown>,
    options?: { namespace?: string }
  ): Promise<AdminCollectionItem>;
  deleteCollectionItem(
    collection: string,
    itemId: string,
    options?: { namespace?: string }
  ): Promise<void>;
}

const DEFAULT_PATHS: AdminClientPaths = {
  // Compass's Server facade owns the /api prefix. Its Admin adapter and Core
  // thread routes are relative to that prefix (rather than the retired v1 API).
  adminBase: "/admin",
  collectionsBase: "/v1/collections",
  threadsBase: "/threads",
};

function resolveBaseUrl(baseUrl?: string): string {
  const candidate = (baseUrl && baseUrl.length > 0 ? baseUrl : "/api").replace(
    /\/$/,
    ""
  );
  return candidate.startsWith("http") || candidate.startsWith("/")
    ? candidate
    : `/${candidate}`;
}

function getRangeWindow(range: AdminDatePreset = "7d") {
  const to = new Date();
  const from = new Date(to);
  if (range === "24h") {
    from.setHours(from.getHours() - 24);
  } else if (range === "30d") {
    from.setDate(from.getDate() - 30);
  } else {
    from.setDate(from.getDate() - 7);
  }
  return { from: from.toISOString(), to: to.toISOString() };
}

function encodeJsonParam(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  return JSON.stringify(value);
}

function encodeListParam(value: string[] | undefined): string | undefined {
  return value && value.length > 0 ? value.join(",") : undefined;
}

function buildUrl(
  baseUrl: string,
  path: string,
  params: Record<string, string | undefined> = {}
): URL {
  const url = new URL(`${baseUrl}${path}`, globalThis.location?.origin);
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string" && value.length > 0) {
      url.searchParams.set(key, value);
    }
  }
  return url;
}

async function mergeHeaders(
  headers: Record<string, string>,
  getRequestHeaders?: RequestHeadersProvider
): Promise<Record<string, string>> {
  const provided = getRequestHeaders ? await getRequestHeaders() : undefined;
  return provided ? { ...headers, ...provided } : headers;
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload?.message ??
      payload?.data?.message ??
      payload?.error?.message ??
      `Admin request failed (${response.status})`;
    throw new Error(message);
  }
  return (payload?.data ?? payload) as T;
}

async function parseJsonEnvelopeResponse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload?.message ??
      payload?.data?.message ??
      payload?.error?.message ??
      `Admin request failed (${response.status})`;
    throw new Error(message);
  }
  return payload as T;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function numberValue(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function textValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function usageTotals(value: unknown = {}): AdminOverview["llmTotals"] {
  const source = isRecord(value) ? value : {};
  return {
    inputTokens: numberValue(source.inputTokens),
    outputTokens: numberValue(source.outputTokens),
    reasoningTokens: numberValue(source.reasoningTokens),
    totalTokens: numberValue(source.totalTokens),
    totalCostUsd: numberValue(source.totalCostUsd),
    totalCalls: numberValue(source.totalCalls),
  };
}

function normalizeOverview(value: unknown): AdminOverview {
  const source = isRecord(value) ? value : {};
  const threads = isRecord(source.threadTotals) ? source.threadTotals : {};
  const messages = isRecord(source.messageTotals) ? source.messageTotals : {};
  const participants = isRecord(source.participantTotals)
    ? source.participantTotals
    : {};
  return {
    threadTotals: {
      total: numberValue(threads.total),
      active: numberValue(threads.active),
      archived: numberValue(threads.archived),
      closed: numberValue(threads.closed),
    },
    messageTotals: {
      total: numberValue(messages.total),
    },
    participantTotals: {
      total: numberValue(participants.total),
      human: numberValue(participants.human),
      agent: numberValue(participants.agent),
      tool: numberValue(participants.tool),
      job: numberValue(participants.job),
    },
    llmTotals: usageTotals(source.llmTotals),
  };
}

function normalizeActivity(value: unknown): AdminActivityPoint[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((point) => ({
    ...usageTotals(point),
    bucket: textValue(point.bucket) ?? "",
    messageCount: numberValue(point.messageCount),
    toolCallCount: numberValue(point.toolCallCount),
  }));
}

function normalizeAgent(value: unknown): AdminAgentSummary | undefined {
  if (!isRecord(value)) return undefined;
  const agentId = textValue(value.agentId ?? value.id);
  if (!agentId) return undefined;
  return {
    agentId,
    displayName: textValue(value.displayName ?? value.name) ?? agentId,
    role: textValue(value.role) ?? null,
    capabilities: isRecord(value.capabilities) ? value.capabilities : {},
  };
}

function normalizeThread(value: unknown): AdminThreadDetail {
  const source = isRecord(value) ? value : {};
  const id = textValue(source.id) ?? "";
  const metadata = isRecord(source.metadata) ? source.metadata : null;
  return {
    id,
    name: textValue(source.name) ?? textValue(source.externalId) ?? id,
    externalId: textValue(source.externalId) ?? null,
    description: textValue(source.description) ?? null,
    participants: Array.isArray(source.participants)
      ? source.participants
          .map((participant) =>
            isRecord(participant) ? textValue(participant.id) : undefined
          )
          .filter((id): id is string => Boolean(id))
      : null,
    status: textValue(source.status) ?? "active",
    summary: textValue(metadata?.summary) ?? null,
    mode: textValue(metadata?.mode) ?? null,
    metadata,
    createdAt: textValue(source.createdAt) ?? null,
    updatedAt: textValue(source.updatedAt) ?? null,
  };
}

function normalizeMessage(value: unknown): AdminMessage | undefined {
  if (!isRecord(value)) return undefined;
  const id = textValue(value.id);
  const threadId = textValue(value.threadId);
  if (!id || !threadId) return undefined;
  const metadata = isRecord(value.metadata) ? value.metadata : null;
  return {
    id,
    threadId,
    sender: isRecord(value.sender) ? value.sender : {},
    recipientIds: Array.isArray(value.recipientIds)
      ? value.recipientIds.filter((id): id is string => typeof id === "string")
      : [],
    content: Array.isArray(value.content) ? value.content : [],
    metadata,
    createdAt: textValue(value.createdAt) ?? null,
    updatedAt: textValue(value.updatedAt) ?? null,
  };
}

function normalizeMessagePageInfo(
  value: unknown,
  messages: AdminMessage[]
): AdminMessagePageInfo {
  const nextFromData = messages[messages.length - 1]?.id ?? null;

  if (!isRecord(value)) {
    return {
      hasMore: false,
      next: nextFromData,
    };
  }

  return {
    hasMore: value.hasMore === true,
    next: typeof value.next === "string" ? value.next : nextFromData,
  };
}

function normalizeMessagePage(payload: unknown): AdminMessagePage {
  const candidate =
    isRecord(payload) &&
    isRecord(payload.data) &&
    Array.isArray(payload.data.data)
      ? payload.data
      : payload;
  const source =
    isRecord(candidate) && Array.isArray(candidate.data)
      ? candidate.data
      : Array.isArray(candidate)
      ? candidate
      : [];
  const data = source
    .map(normalizeMessage)
    .filter((message): message is AdminMessage => Boolean(message));
  const pageInfo = isRecord(candidate)
    ? normalizeMessagePageInfo(candidate.pageInfo, data)
    : normalizeMessagePageInfo(undefined, data);

  return { data, pageInfo };
}

function isQueueEvent(value: unknown): value is AdminQueueEvent {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.threadId === "string" &&
    typeof value.eventType === "string"
  );
}

function normalizeQueueEvent(value: unknown): AdminQueueEvent | undefined {
  if (isQueueEvent(value)) return value;
  if (isRecord(value) && isQueueEvent(value.data)) return value.data;
  return undefined;
}

function normalizeQueueEvents(value: unknown): AdminQueueEvent[] {
  if (Array.isArray(value)) return value.filter(isQueueEvent);
  if (isRecord(value) && Array.isArray(value.data)) {
    return value.data.filter(isQueueEvent);
  }
  return [];
}

export function createAdminClient(
  options: AdminClientOptions = {}
): CopilotzAdminClient {
  const baseUrl = resolveBaseUrl(options.baseUrl);
  const paths = { ...DEFAULT_PATHS, ...options.paths };
  const usageSource = createUsageClient({
    baseUrl: `${baseUrl}${paths.adminBase}/usage`,
    getRequestHeaders: options.getRequestHeaders,
  });

  const requestJson = async <T>(
    path: string,
    params?: Record<string, string | undefined>
  ): Promise<T> => {
    const url = buildUrl(baseUrl, path, params);
    const response = await fetch(url.toString(), {
      headers: await mergeHeaders({}, options.getRequestHeaders),
    });
    return await parseJsonResponse<T>(response);
  };

  const requestEnvelopeJson = async <T>(
    path: string,
    params?: Record<string, string | undefined>
  ): Promise<T> => {
    const url = buildUrl(baseUrl, path, params);
    const response = await fetch(url.toString(), {
      headers: await mergeHeaders({}, options.getRequestHeaders),
    });
    return await parseJsonEnvelopeResponse<T>(response);
  };

  const writeJson = async <T>(
    method: "POST" | "PUT" | "DELETE",
    path: string,
    data?: Record<string, unknown>,
    params?: Record<string, string | undefined>
  ): Promise<T> => {
    const url = buildUrl(baseUrl, path, params);
    const response = await fetch(url.toString(), {
      method,
      headers: await mergeHeaders(
        data ? { "Content-Type": "application/json" } : {},
        options.getRequestHeaders
      ),
      ...(data ? { body: JSON.stringify(data) } : {}),
    });
    if (response.status === 204) return undefined as T;
    return await parseJsonResponse<T>(response);
  };

  return {
    paths,
    getOverview: async ({ range = "7d", namespace } = {}) => {
      const windowRange = getRangeWindow(range);
      const payload = await requestJson<unknown>(
        `${paths.adminBase}/overview`,
        {
          namespace,
          from: windowRange.from,
          to: windowRange.to,
        }
      );
      return normalizeOverview(payload);
    },
    getActivity: async ({ range = "7d", interval = "day", namespace } = {}) => {
      const windowRange = getRangeWindow(range);
      const payload = await requestJson<unknown>(
        `${paths.adminBase}/activity`,
        {
          namespace,
          interval,
          from: windowRange.from,
          to: windowRange.to,
        }
      );
      return normalizeActivity(payload);
    },
    getUsageDataSource: () => usageSource,
    listThreads: async (listOptions = {}) =>
      await requestJson<AdminThreadSummary[]>(`${paths.adminBase}/threads`, {
        search: listOptions.search,
        namespace: listOptions.namespace,
        limit: String(listOptions.limit ?? 25),
      }),
    listParticipants: async (listOptions = {}) =>
      await requestJson<AdminParticipantSummary[]>(
        `${paths.adminBase}/participants`,
        {
          search: listOptions.search,
          namespace: listOptions.namespace,
          limit: String(listOptions.limit ?? 25),
        }
      ),
    listAgents: async (listOptions = {}) => {
      const windowRange = getRangeWindow(listOptions.range ?? "7d");
      const payload = await requestJson<unknown>(`${paths.adminBase}/agents`, {
        search: listOptions.search,
        namespace: listOptions.namespace,
        from: windowRange.from,
        to: windowRange.to,
        limit: String(listOptions.limit ?? 25),
      });
      return (Array.isArray(payload) ? payload : [])
        .map(normalizeAgent)
        .filter((agent): agent is AdminAgentSummary => Boolean(agent));
    },
    getThread: async (threadId) =>
      normalizeThread(
        await requestJson<unknown>(
          `${paths.threadsBase}/${encodeURIComponent(threadId)}`
        )
      ),
    getThreadMessages: async (threadId, messageOptions = {}) => {
      const payload = await requestEnvelopeJson<unknown>(
        `${paths.threadsBase}/${encodeURIComponent(threadId)}/messages`,
        {
          query: encodeJsonParam({
            limit: messageOptions.limit,
            after: messageOptions.after,
            order: "desc",
          }),
        }
      );
      return normalizeMessagePage(payload);
    },
    listEvents: async (eventOptions = {}) => {
      const payload = await requestJson<unknown>(`${paths.adminBase}/events`, {
        namespace: eventOptions.namespace,
        threadId: eventOptions.threadId,
        status: eventOptions.status,
        eventType: eventOptions.eventType,
        traceId: eventOptions.traceId,
        search: eventOptions.search,
        limit: String(eventOptions.limit ?? 50),
        offset: eventOptions.offset ? String(eventOptions.offset) : undefined,
      });
      return normalizeQueueEvents(payload);
    },
    getThreadEvent: async (threadId) => {
      const payload = await requestJson<unknown>(
        `${paths.threadsBase}/${encodeURIComponent(threadId)}/events`
      );
      return normalizeQueueEvent(payload);
    },
    getBrain: async (filters = {}) =>
      await requestJson<AdminBrainResponse>(`${paths.adminBase}/brain`, {
        namespace: filters.namespace,
        memorySpaceId: filters.memorySpaceId,
        checkpointId: filters.checkpointId,
        agentId: filters.agentId,
        threadId: filters.threadId,
        layer: filters.layer === "all" ? undefined : filters.layer,
        kind: filters.kind === "all" ? undefined : filters.kind,
        status: filters.status === "all" ? undefined : filters.status,
        search: filters.search,
        searchMode: filters.searchMode,
        focusNodeId: filters.focusNodeId,
        includeRelated: filters.includeRelated ? "true" : undefined,
        includeSimilar: filters.includeSimilar ? "true" : undefined,
        similarLimit: filters.similarLimit
          ? String(filters.similarLimit)
          : undefined,
        minSimilarity:
          typeof filters.minSimilarity === "number"
            ? String(filters.minSimilarity)
            : undefined,
        relationDepth: filters.relationDepth
          ? String(filters.relationDepth)
          : undefined,
        relationTypes: filters.relationTypes?.join(","),
        limit: String(filters.limit ?? 160),
        offset: filters.offset ? String(filters.offset) : undefined,
      }),
    listCollections: async () =>
      await requestJson<string[]>(paths.collectionsBase),
    listCollectionItems: async (collection, listOptions = {}) =>
      await requestJson<AdminCollectionItem[]>(
        `${paths.collectionsBase}/${encodeURIComponent(collection)}`,
        {
          q: listOptions.search,
          namespace: listOptions.namespace,
          limit: listOptions.limit ? String(listOptions.limit) : undefined,
          offset: listOptions.offset ? String(listOptions.offset) : undefined,
          before: listOptions.before,
          after: listOptions.after,
          filter: encodeJsonParam(listOptions.filter),
          sort: encodeJsonParam(listOptions.sort),
          populate: encodeListParam(listOptions.populate),
        }
      ),
    getCollectionItem: async (collection, itemId, getOptions = {}) =>
      await requestJson<AdminCollectionItem>(
        `${paths.collectionsBase}/${encodeURIComponent(
          collection
        )}/${encodeURIComponent(itemId)}`,
        {
          namespace: getOptions.namespace,
          populate: encodeListParam(getOptions.populate),
        }
      ),
    createCollectionItem: async (collection, data, writeOptions = {}) =>
      await writeJson<AdminCollectionItem>(
        "POST",
        `${paths.collectionsBase}/${encodeURIComponent(collection)}`,
        data,
        { namespace: writeOptions.namespace }
      ),
    updateCollectionItem: async (collection, itemId, data, writeOptions = {}) =>
      await writeJson<AdminCollectionItem>(
        "PUT",
        `${paths.collectionsBase}/${encodeURIComponent(
          collection
        )}/${encodeURIComponent(itemId)}`,
        data,
        { namespace: writeOptions.namespace }
      ),
    deleteCollectionItem: async (collection, itemId, writeOptions = {}) => {
      await writeJson<void>(
        "DELETE",
        `${paths.collectionsBase}/${encodeURIComponent(
          collection
        )}/${encodeURIComponent(itemId)}`,
        undefined,
        { namespace: writeOptions.namespace }
      );
    },
  };
}
