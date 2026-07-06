import type {
  AdminActivityInterval,
  AdminActivityPoint,
  AdminAgentSummary,
  AdminCollectionItem,
  AdminDatePreset,
  AdminMessage,
  AdminMessagePage,
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

const rawBaseValue =
  (import.meta as { env?: Record<string, string | undefined> }).env
    ?.VITE_API_URL;
const rawBase = typeof rawBaseValue === "string" && rawBaseValue.length > 0
  ? rawBaseValue
  : "/api";
const normalizedBase = rawBase.replace(/\/$/, "");

const runtimeProcess: typeof process | undefined =
  typeof process !== "undefined" ? process : undefined;

const API_KEY = (() => {
  const env =
    (import.meta as { env?: Record<string, string | undefined> }).env ?? {};
  const candidates = [
    env.VITE_API_KEY,
    env.VITE_COPILOTZ_API_KEY,
    runtimeProcess?.env?.COPILOTZ_API_KEY,
    runtimeProcess?.env?.API_KEY,
  ];
  return candidates.find((value) =>
    typeof value === "string" && value.length > 0
  );
})();

const resolveBaseUrl = (baseUrl?: string) => {
  const candidate = (baseUrl && baseUrl.length > 0 ? baseUrl : normalizedBase)
    .replace(/\/$/, "");
  return candidate.startsWith("http") || candidate.startsWith("/")
    ? candidate
    : `/${candidate}`;
};

const withAuthHeaders = async (
  headers: Record<string, string> = {},
  getRequestHeaders?: RequestHeadersProvider,
): Promise<Record<string, string>> => {
  const providedHeaders = getRequestHeaders
    ? await getRequestHeaders()
    : undefined;
  if (providedHeaders && Object.keys(providedHeaders).length > 0) {
    return { ...headers, ...providedHeaders };
  }
  if (API_KEY) {
    return { ...headers, Authorization: `Bearer ${API_KEY}` };
  }
  return headers;
};

const getRangeWindow = (range: AdminDatePreset) => {
  const to = new Date();
  const from = new Date(to);
  if (range === "24h") {
    from.setHours(from.getHours() - 24);
  } else if (range === "30d") {
    from.setDate(from.getDate() - 30);
  } else {
    from.setDate(from.getDate() - 7);
  }
  return {
    from: from.toISOString(),
    to: to.toISOString(),
  };
};

interface FetchOptions {
  baseUrl?: string;
  getRequestHeaders?: RequestHeadersProvider;
}

async function fetchAdminJson<T>(
  path: string,
  params: Record<string, string | undefined>,
  options?: FetchOptions,
): Promise<T> {
  const url = new URL(
    `${resolveBaseUrl(options?.baseUrl)}${path}`,
    window.location.origin,
  );
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string" && value.length > 0) {
      url.searchParams.set(key, value);
    }
  }

  const response = await fetch(url.toString(), {
    headers: await withAuthHeaders({}, options?.getRequestHeaders),
  });

  if (!response.ok) {
    throw new Error(`Admin request failed (${response.status})`);
  }

  const payload = await response.json() as { data?: T };
  return payload.data as T;
}

async function fetchRawJson<T>(
  path: string,
  params: Record<string, string | undefined>,
  options?: FetchOptions,
): Promise<T> {
  const url = new URL(
    `${resolveBaseUrl(options?.baseUrl)}${path}`,
    window.location.origin,
  );
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string" && value.length > 0) {
      url.searchParams.set(key, value);
    }
  }

  const response = await fetch(url.toString(), {
    headers: await withAuthHeaders({}, options?.getRequestHeaders),
  });

  if (!response.ok) {
    throw new Error(`Admin request failed (${response.status})`);
  }

  return await response.json() as T;
}

// --- Admin aggregate endpoints ---

export async function fetchAdminOverview(
  range: AdminDatePreset,
  namespace?: string,
  options?: FetchOptions,
): Promise<AdminOverview> {
  const windowRange = getRangeWindow(range);
  return await fetchAdminJson<AdminOverview>("/v1/admin/overview", {
    namespace,
    from: windowRange.from,
    to: windowRange.to,
  }, options);
}

export async function fetchAdminActivity(
  range: AdminDatePreset,
  interval: AdminActivityInterval,
  namespace?: string,
  options?: FetchOptions,
): Promise<AdminActivityPoint[]> {
  const windowRange = getRangeWindow(range);
  return await fetchAdminJson<AdminActivityPoint[]>("/v1/admin/activity", {
    namespace,
    interval,
    from: windowRange.from,
    to: windowRange.to,
  }, options);
}

export async function fetchAdminThreads(
  search?: string,
  namespace?: string,
  options?: FetchOptions,
): Promise<AdminThreadSummary[]> {
  return await fetchAdminJson<AdminThreadSummary[]>("/v1/admin/threads", {
    search,
    namespace,
    limit: "8",
  }, options);
}

export async function fetchAdminParticipants(
  search?: string,
  namespace?: string,
  options?: FetchOptions,
): Promise<AdminParticipantSummary[]> {
  return await fetchAdminJson<AdminParticipantSummary[]>(
    "/v1/admin/participants",
    {
      search,
      namespace,
      limit: "8",
    },
    options,
  );
}

export async function fetchAdminAgents(
  search?: string,
  namespace?: string,
  range: AdminDatePreset = "7d",
  options?: FetchOptions,
): Promise<AdminAgentSummary[]> {
  const windowRange = getRangeWindow(range);
  return await fetchAdminJson<AdminAgentSummary[]>("/v1/admin/agents", {
    search,
    namespace,
    from: windowRange.from,
    to: windowRange.to,
    limit: "8",
  }, options);
}

export async function fetchAdminUsage(
  filters: AdminUsageFilters,
  options?: FetchOptions,
): Promise<AdminUsageResponse> {
  return await fetchAdminJson<AdminUsageResponse>("/v1/admin/usage", {
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
  }, options);
}

// --- Thread detail + messages ---

export async function fetchThreadDetail(
  threadId: string,
  options?: FetchOptions,
): Promise<AdminThreadDetail> {
  return await fetchAdminJson<AdminThreadDetail>(
    `/v1/threads/${encodeURIComponent(threadId)}`,
    {},
    options,
  );
}

export async function fetchThreadMessages(
  threadId: string,
  messageOptions?: { limit?: number; before?: string },
  options?: FetchOptions,
): Promise<AdminMessagePage> {
  return await fetchRawJson<AdminMessagePage>(
    `/v1/threads/${encodeURIComponent(threadId)}/messages`,
    {
      limit: messageOptions?.limit?.toString(),
      before: messageOptions?.before,
    },
    options,
  );
}

// --- Participant detail ---

export async function fetchParticipantDetail(
  participantId: string,
  options?: FetchOptions,
): Promise<AdminParticipantDetail | null> {
  return await fetchAdminJson<AdminParticipantDetail | null>(
    `/v1/collections/participant/${encodeURIComponent(participantId)}`,
    {},
    options,
  );
}

export async function updateParticipant(
  participantId: string,
  data: Record<string, unknown>,
  options?: FetchOptions,
): Promise<AdminParticipantDetail> {
  const url = new URL(
    `${resolveBaseUrl(options?.baseUrl)}/v1/collections/participant/${
      encodeURIComponent(participantId)
    }`,
    window.location.origin,
  );
  const response = await fetch(url.toString(), {
    method: "PUT",
    headers: await withAuthHeaders(
      { "Content-Type": "application/json" },
      options?.getRequestHeaders,
    ),
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error(`Update participant failed (${response.status})`);
  }
  const payload = await response.json() as { data?: AdminParticipantDetail };
  return payload.data as AdminParticipantDetail;
}

// --- Collections ---

export async function fetchCollectionNames(
  options?: FetchOptions,
): Promise<string[]> {
  return await fetchAdminJson<string[]>("/v1/collections", {}, options);
}

export async function fetchCollectionItems(
  collection: string,
  queryOptions?: {
    search?: string;
    namespace?: string;
    limit?: number;
    offset?: number;
  },
  options?: FetchOptions,
): Promise<AdminCollectionItem[]> {
  const params: Record<string, string | undefined> = {
    limit: queryOptions?.limit?.toString(),
  };
  if (queryOptions?.search) {
    params.q = queryOptions.search;
  } else {
    params.offset = queryOptions?.offset?.toString();
  }
  return await fetchAdminJson<AdminCollectionItem[]>(
    `/v1/collections/${encodeURIComponent(collection)}`,
    params,
    options,
  );
}

export async function fetchCollectionItem(
  collection: string,
  itemId: string,
  _namespace?: string,
  options?: FetchOptions,
): Promise<AdminCollectionItem> {
  return await fetchAdminJson<AdminCollectionItem>(
    `/v1/collections/${encodeURIComponent(collection)}/${
      encodeURIComponent(itemId)
    }`,
    {},
    options,
  );
}

export async function createCollectionItem(
  collection: string,
  data: Record<string, unknown>,
  _namespace?: string,
  options?: FetchOptions,
): Promise<AdminCollectionItem> {
  const url = new URL(
    `${resolveBaseUrl(options?.baseUrl)}/v1/collections/${
      encodeURIComponent(collection)
    }`,
    window.location.origin,
  );
  const response = await fetch(url.toString(), {
    method: "POST",
    headers: await withAuthHeaders(
      { "Content-Type": "application/json" },
      options?.getRequestHeaders,
    ),
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error(`Create collection item failed (${response.status})`);
  }
  const payload = await response.json() as { data?: AdminCollectionItem };
  return payload.data as AdminCollectionItem;
}

export async function updateCollectionItem(
  collection: string,
  itemId: string,
  data: Record<string, unknown>,
  _namespace?: string,
  options?: FetchOptions,
): Promise<AdminCollectionItem> {
  const url = new URL(
    `${resolveBaseUrl(options?.baseUrl)}/v1/collections/${
      encodeURIComponent(collection)
    }/${encodeURIComponent(itemId)}`,
    window.location.origin,
  );
  const response = await fetch(url.toString(), {
    method: "PUT",
    headers: await withAuthHeaders(
      { "Content-Type": "application/json" },
      options?.getRequestHeaders,
    ),
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error(`Update collection item failed (${response.status})`);
  }
  const payload = await response.json() as { data?: AdminCollectionItem };
  return payload.data as AdminCollectionItem;
}

export async function deleteCollectionItem(
  collection: string,
  itemId: string,
  _namespace?: string,
  options?: FetchOptions,
): Promise<void> {
  const url = new URL(
    `${resolveBaseUrl(options?.baseUrl)}/v1/collections/${
      encodeURIComponent(collection)
    }/${encodeURIComponent(itemId)}`,
    window.location.origin,
  );
  const response = await fetch(url.toString(), {
    method: "DELETE",
    headers: await withAuthHeaders({}, options?.getRequestHeaders),
  });
  if (!response.ok) {
    throw new Error(`Delete collection item failed (${response.status})`);
  }
}

// --- Thread events ---

export async function fetchThreadEvents(
  threadId: string,
  options?: FetchOptions,
): Promise<AdminQueueEvent | undefined> {
  return await fetchAdminJson<AdminQueueEvent | undefined>(
    `/v1/threads/${encodeURIComponent(threadId)}/events`,
    {},
    options,
  );
}
