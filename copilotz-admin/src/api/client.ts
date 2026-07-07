import type {
  AdminActivityInterval,
  AdminActivityPoint,
  AdminAgentSummary,
  AdminCollectionItem,
  AdminDatePreset,
  AdminMessage,
  AdminMessagePage,
  AdminMessagePageInfo,
  AdminOverview,
  AdminParticipantDetail,
  AdminParticipantSummary,
  AdminQueueEvent,
  AdminThreadDetail,
  AdminThreadSummary,
  AdminUsageFilters,
  AdminUsageResponse,
  RequestHeadersProvider,
} from "./types";

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
  getOverview(
    options?: { range?: AdminDatePreset; namespace?: string },
  ): Promise<AdminOverview>;
  getActivity(
    options?: {
      range?: AdminDatePreset;
      interval?: AdminActivityInterval;
      namespace?: string;
    },
  ): Promise<AdminActivityPoint[]>;
  getUsage(filters?: AdminUsageFilters): Promise<AdminUsageResponse>;
  listThreads(options?: AdminListOptions): Promise<AdminThreadSummary[]>;
  listParticipants(
    options?: AdminListOptions,
  ): Promise<AdminParticipantSummary[]>;
  listAgents(
    options?: AdminListOptions & { range?: AdminDatePreset },
  ): Promise<AdminAgentSummary[]>;
  getThread(threadId: string): Promise<AdminThreadDetail>;
  getThreadMessages(
    threadId: string,
    options?: { limit?: number; before?: string },
  ): Promise<AdminMessagePage>;
  getThreadEvent(threadId: string): Promise<AdminQueueEvent | undefined>;
  listCollections(): Promise<string[]>;
  listCollectionItems(
    collection: string,
    options?: AdminListOptions,
  ): Promise<AdminCollectionItem[]>;
  getCollectionItem(
    collection: string,
    itemId: string,
    options?: { namespace?: string; populate?: string[] },
  ): Promise<AdminCollectionItem>;
  createCollectionItem(
    collection: string,
    data: Record<string, unknown>,
    options?: { namespace?: string },
  ): Promise<AdminCollectionItem>;
  updateCollectionItem(
    collection: string,
    itemId: string,
    data: Record<string, unknown>,
    options?: { namespace?: string },
  ): Promise<AdminCollectionItem>;
  deleteCollectionItem(
    collection: string,
    itemId: string,
    options?: { namespace?: string },
  ): Promise<void>;
}

const DEFAULT_PATHS: AdminClientPaths = {
  adminBase: "/v1/admin",
  collectionsBase: "/v1/collections",
  threadsBase: "/v1/threads",
};

function resolveBaseUrl(baseUrl?: string): string {
  const candidate = (baseUrl && baseUrl.length > 0 ? baseUrl : "/api")
    .replace(/\/$/, "");
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
  params: Record<string, string | undefined> = {},
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
  getRequestHeaders?: RequestHeadersProvider,
): Promise<Record<string, string>> {
  const provided = getRequestHeaders ? await getRequestHeaders() : undefined;
  return provided ? { ...headers, ...provided } : headers;
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload?.message ?? payload?.data?.message ??
      payload?.error?.message ??
      `Admin request failed (${response.status})`;
    throw new Error(message);
  }
  return (payload?.data ?? payload) as T;
}

async function parseJsonEnvelopeResponse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload?.message ?? payload?.data?.message ??
      payload?.error?.message ??
      `Admin request failed (${response.status})`;
    throw new Error(message);
  }
  return payload as T;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeMessagePageInfo(
  value: unknown,
  messages: AdminMessage[],
): AdminMessagePageInfo {
  const oldestFromData = messages[0]?.id ?? null;
  const newestFromData = messages[messages.length - 1]?.id ?? null;

  if (!isRecord(value)) {
    return {
      hasMoreBefore: false,
      oldestMessageId: oldestFromData,
      newestMessageId: newestFromData,
    };
  }

  return {
    hasMoreBefore: value.hasMoreBefore === true,
    oldestMessageId: typeof value.oldestMessageId === "string"
      ? value.oldestMessageId
      : oldestFromData,
    newestMessageId: typeof value.newestMessageId === "string"
      ? value.newestMessageId
      : newestFromData,
  };
}

function normalizeMessagePage(payload: unknown): AdminMessagePage {
  const candidate = isRecord(payload) && isRecord(payload.data) &&
      Array.isArray(payload.data.data)
    ? payload.data
    : payload;
  const data = isRecord(candidate) && Array.isArray(candidate.data)
    ? candidate.data as AdminMessage[]
    : Array.isArray(candidate)
    ? candidate as AdminMessage[]
    : [];
  const pageInfo = isRecord(candidate)
    ? normalizeMessagePageInfo(candidate.pageInfo, data)
    : normalizeMessagePageInfo(undefined, data);

  return { data, pageInfo };
}

export function createAdminClient(
  options: AdminClientOptions = {},
): CopilotzAdminClient {
  const baseUrl = resolveBaseUrl(options.baseUrl);
  const paths = { ...DEFAULT_PATHS, ...options.paths };

  const requestJson = async <T>(
    path: string,
    params?: Record<string, string | undefined>,
  ): Promise<T> => {
    const url = buildUrl(baseUrl, path, params);
    const response = await fetch(url.toString(), {
      headers: await mergeHeaders({}, options.getRequestHeaders),
    });
    return await parseJsonResponse<T>(response);
  };

  const requestEnvelopeJson = async <T>(
    path: string,
    params?: Record<string, string | undefined>,
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
    params?: Record<string, string | undefined>,
  ): Promise<T> => {
    const url = buildUrl(baseUrl, path, params);
    const response = await fetch(url.toString(), {
      method,
      headers: await mergeHeaders(
        data ? { "Content-Type": "application/json" } : {},
        options.getRequestHeaders,
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
      return await requestJson<AdminOverview>(`${paths.adminBase}/overview`, {
        namespace,
        from: windowRange.from,
        to: windowRange.to,
      });
    },
    getActivity: async ({ range = "7d", interval = "day", namespace } = {}) => {
      const windowRange = getRangeWindow(range);
      return await requestJson<AdminActivityPoint[]>(
        `${paths.adminBase}/activity`,
        {
          namespace,
          interval,
          from: windowRange.from,
          to: windowRange.to,
        },
      );
    },
    getUsage: async (filters = {}) =>
      await requestJson<AdminUsageResponse>(`${paths.adminBase}/usage`, {
        from: filters.from,
        to: filters.to,
        interval: filters.interval,
        metric: filters.metric,
        groupBy: filters.groupBy,
        attribution: filters.attribution,
        threadId: filters.threadId,
        participantId: filters.participantId,
        participantType: filters.participantType,
        namespace: filters.namespace,
        provider: filters.provider,
        model: filters.model,
      }),
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
        },
      ),
    listAgents: async (listOptions = {}) => {
      const windowRange = getRangeWindow(listOptions.range ?? "7d");
      return await requestJson<AdminAgentSummary[]>(`${paths.adminBase}/agents`, {
        search: listOptions.search,
        namespace: listOptions.namespace,
        from: windowRange.from,
        to: windowRange.to,
        limit: String(listOptions.limit ?? 25),
      });
    },
    getThread: async (threadId) =>
      await requestJson<AdminThreadDetail>(
        `${paths.threadsBase}/${encodeURIComponent(threadId)}`,
      ),
    getThreadMessages: async (threadId, messageOptions = {}) => {
      const payload = await requestEnvelopeJson<unknown>(
        `${paths.threadsBase}/${encodeURIComponent(threadId)}/messages`,
        {
          limit: messageOptions.limit ? String(messageOptions.limit) : undefined,
          before: messageOptions.before,
        },
      );
      return normalizeMessagePage(payload);
    },
    getThreadEvent: async (threadId) =>
      await requestJson<AdminQueueEvent | undefined>(
        `${paths.threadsBase}/${encodeURIComponent(threadId)}/events`,
      ),
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
        },
      ),
    getCollectionItem: async (collection, itemId, getOptions = {}) =>
      await requestJson<AdminCollectionItem>(
        `${paths.collectionsBase}/${encodeURIComponent(collection)}/${
          encodeURIComponent(itemId)
        }`,
        {
          namespace: getOptions.namespace,
          populate: encodeListParam(getOptions.populate),
        },
      ),
    createCollectionItem: async (collection, data, writeOptions = {}) =>
      await writeJson<AdminCollectionItem>(
        "POST",
        `${paths.collectionsBase}/${encodeURIComponent(collection)}`,
        data,
        { namespace: writeOptions.namespace },
      ),
    updateCollectionItem: async (collection, itemId, data, writeOptions = {}) =>
      await writeJson<AdminCollectionItem>(
        "PUT",
        `${paths.collectionsBase}/${encodeURIComponent(collection)}/${
          encodeURIComponent(itemId)
        }`,
        data,
        { namespace: writeOptions.namespace },
      ),
    deleteCollectionItem: async (collection, itemId, writeOptions = {}) => {
      await writeJson<void>(
        "DELETE",
        `${paths.collectionsBase}/${encodeURIComponent(collection)}/${
          encodeURIComponent(itemId)
        }`,
        undefined,
        { namespace: writeOptions.namespace },
      );
    },
  };
}
