import type { ReactNode } from "react";

export type RequestHeadersProvider = () =>
  | Record<string, string>
  | Promise<Record<string, string>>;

export type AdminDatePreset = "24h" | "7d" | "30d";
export type AdminActivityInterval = "hour" | "day";
export type AdminUsageInterval = "minute" | "hour" | "day" | "week" | "month";
export type AdminUsageMetricKind = "tokens" | "cost" | "calls";
export type AdminUsageGroupBy =
  | "thread"
  | "participant"
  | "namespace"
  | "provider"
  | "model";
export type AdminUsageDimension =
  | "total"
  | "input"
  | "output"
  | "reasoning"
  | "cacheRead"
  | "cacheWrite";

export type AdminPage =
  | "dashboard"
  | "threads"
  | "thread-detail"
  | "participants"
  | "participant-detail"
  | "agents"
  | "agent-detail"
  | "collection-items"
  | "collection-item-detail"
  | "events";

export interface AdminRoute {
  page: AdminPage;
  resourceId?: string;
  collection?: string;
}

export interface AdminUsageBreakdown {
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
  totalTokens: number;
  inputCostUsd: number;
  outputCostUsd: number;
  reasoningCostUsd: number;
  cacheReadInputCostUsd: number;
  cacheCreationInputCostUsd: number;
  totalCostUsd: number;
}

export interface AdminUsageTotals extends AdminUsageBreakdown {
  totalCalls: number;
}

export interface AdminOverview {
  threadTotals: {
    total: number;
    active: number;
    archived: number;
  };
  queueTotals: {
    total: number;
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    expired: number;
    overwritten: number;
  };
  messageTotals: {
    total: number;
    toolCallMessages: number;
  };
  participantTotals: {
    total: number;
    humans: number;
    agents: number;
    jobs?: number;
  };
  llmTotals: AdminUsageTotals;
}

export interface AdminActivityPoint extends AdminUsageTotals {
  bucket: string;
  messageCount: number;
  toolCallMessageCount: number;
  llmCallCount: number;
}

export interface AdminThreadSummary {
  threadId: string;
  name: string;
  status: string;
  summary: string | null;
  participantIds: string[];
  messageCount: number;
  lastActivityAt: string | null;
  lastMessagePreview: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface AdminParticipantSummary {
  externalId: string;
  displayName: string;
  participantType: "human" | "agent" | "job";
  namespace: string;
  isGlobal: boolean;
  messageCount: number;
  threadCount: number;
  lastActivityAt: string | null;
}

export interface AdminUsagePoint extends AdminUsageTotals {
  bucket: string;
  groupKey: string;
  groupLabel: string;
}

export interface AdminUsageResponse {
  points: AdminUsagePoint[];
  rows: AdminUsagePoint[];
  totals: AdminUsageTotals;
}

export interface AdminUsageFilters {
  from?: string;
  to?: string;
  interval?: AdminUsageInterval;
  metric?: AdminUsageMetricKind;
  groupBy?: AdminUsageGroupBy;
  threadId?: string;
  participantId?: string;
  participantType?: "all" | "human" | "agent" | "job";
  namespace?: string;
  provider?: string;
  model?: string;
}

export interface AdminAgentSummary {
  agentId: string;
  displayName: string;
  description: string | null;
  isConfigured: boolean;
  namespace: string;
  isGlobal: boolean;
  messageCount: number;
  llmCallCount: number;
  toolCallMessageCount: number;
  inputTokens: AdminUsageBreakdown["inputTokens"];
  outputTokens: AdminUsageBreakdown["outputTokens"];
  reasoningTokens: AdminUsageBreakdown["reasoningTokens"];
  cacheReadInputTokens: AdminUsageBreakdown["cacheReadInputTokens"];
  cacheCreationInputTokens: AdminUsageBreakdown["cacheCreationInputTokens"];
  totalTokens: AdminUsageBreakdown["totalTokens"];
  inputCostUsd: AdminUsageBreakdown["inputCostUsd"];
  outputCostUsd: AdminUsageBreakdown["outputCostUsd"];
  reasoningCostUsd: AdminUsageBreakdown["reasoningCostUsd"];
  cacheReadInputCostUsd: AdminUsageBreakdown["cacheReadInputCostUsd"];
  cacheCreationInputCostUsd: AdminUsageBreakdown["cacheCreationInputCostUsd"];
  totalCostUsd: AdminUsageBreakdown["totalCostUsd"];
  lastActivityAt: string | null;
}

export interface AdminThreadDetail {
  id: string;
  name: string;
  externalId: string | null;
  description: string | null;
  participants: string[] | null;
  status: string;
  summary: string | null;
  mode: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface AdminMessage {
  id: string;
  threadId: string;
  senderUserId: string | null;
  senderId: string | null;
  senderType: "agent" | "user" | "system" | "tool";
  targetId: string | null;
  content: string | null;
  toolCallId: string | null;
  toolCalls: unknown[] | null;
  reasoning: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface AdminMessagePageInfo {
  hasMoreBefore: boolean;
  oldestMessageId: string | null;
  newestMessageId: string | null;
}

export interface AdminMessagePage {
  data: AdminMessage[];
  pageInfo: AdminMessagePageInfo;
}

export type AdminParticipantDetail = Record<string, unknown>;

export type AdminCollectionItem = Record<string, unknown> & { id?: string };

export interface AdminQueueEvent {
  id: string;
  threadId: string;
  eventType: string;
  payload: unknown;
  parentEventId: string | null;
  traceId: string | null;
  priority: number | null;
  status: "pending" | "processing" | "completed" | "failed" | "expired" | "overwritten";
  namespace: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface AdminFilters {
  namespace?: string;
  range?: AdminDatePreset;
  interval?: AdminActivityInterval;
  threadSearch?: string;
  participantSearch?: string;
  agentSearch?: string;
}

export interface AdminConfig {
  branding?: {
    title?: string;
    subtitle?: string;
    logo?: ReactNode;
    actions?: ReactNode;
  };
  labels?: {
    overviewTitle?: string;
    activityTitle?: string;
    threadsTitle?: string;
    participantsTitle?: string;
    agentsTitle?: string;
    range24h?: string;
    range7d?: string;
    range30d?: string;
    intervalHour?: string;
    intervalDay?: string;
    refresh?: string;
    retry?: string;
    loading?: string;
    emptyTitle?: string;
    emptyDescription?: string;
    threadSearchPlaceholder?: string;
    participantSearchPlaceholder?: string;
    agentSearchPlaceholder?: string;
    messagesCard?: string;
    activeThreadsCard?: string;
    participantsCard?: string;
    tokensCard?: string;
    costCard?: string;
    queueCard?: string;
    llmUsageTitle?: string;
    usageMetricLabel?: string;
    usageDimensionLabel?: string;
    usageMetricTokens?: string;
    usageMetricCost?: string;
    usageTotal?: string;
    usageInput?: string;
    usageOutput?: string;
    usageReasoning?: string;
    usageCacheRead?: string;
    usageCacheWrite?: string;
    usageCallsDetail?: string;
    usageUnavailableDetail?: string;
    statusActive?: string;
    statusArchived?: string;
    scopeGlobal?: string;
    scopeScoped?: string;
    configured?: string;
    unconfigured?: string;
    noResults?: string;
    eventsTitle?: string;
    dashboardTitle?: string;
    collectionsTitle?: string;
    collectionsEndpoint?: string;
  };
  features?: {
    showOverview?: boolean;
    showActivity?: boolean;
    showThreads?: boolean;
    showParticipants?: boolean;
    showAgents?: boolean;
    showEvents?: boolean;
    showCollections?: boolean;
  };
  ui?: {
    compact?: boolean;
    maxActivityBars?: number;
  };
  sidebar?: {
    defaultOpen?: boolean;
    collapsible?: "icon" | "offcanvas" | "none";
  };
  baseUrl?: string;
  getRequestHeaders?: RequestHeadersProvider;
  namespace?: string;
  initialRange?: AdminDatePreset;
  initialInterval?: AdminActivityInterval;
  defaultPage?: AdminPage;
  onNavigate?: (route: AdminRoute) => void;
}

export interface ResolvedAdminConfig {
  branding: Required<NonNullable<AdminConfig["branding"]>>;
  labels: Required<NonNullable<AdminConfig["labels"]>>;
  features: Required<NonNullable<AdminConfig["features"]>>;
  ui: Required<NonNullable<AdminConfig["ui"]>>;
  sidebar: Required<NonNullable<AdminConfig["sidebar"]>>;
  baseUrl: string;
  getRequestHeaders: RequestHeadersProvider;
  namespace: string;
  initialRange: AdminDatePreset;
  initialInterval: AdminActivityInterval;
  defaultPage: AdminPage;
  onNavigate: ((route: AdminRoute) => void) | null;
}

export interface AdminSectionState {
  overview: AdminOverview | null;
  activity: AdminActivityPoint[];
  threads: AdminThreadSummary[];
  participants: AdminParticipantSummary[];
  agents: AdminAgentSummary[];
}

export interface UseCopilotzAdminOptions extends AdminFilters {
  baseUrl?: string;
  getRequestHeaders?: RequestHeadersProvider;
}

export interface UseCopilotzAdminResult extends AdminSectionState {
  filters: Required<Pick<AdminFilters, "range" | "interval">> & Omit<AdminFilters, "range" | "interval">;
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  setRange: (range: AdminDatePreset) => void;
  setInterval: (interval: AdminActivityInterval) => void;
}
