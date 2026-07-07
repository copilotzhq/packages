export type RequestHeadersProvider = () =>
  | Record<string, string>
  | Promise<Record<string, string>>;

export type AdminDatePreset = "24h" | "7d" | "30d";
export type AdminActivityInterval = "hour" | "day";
export type AdminUsageInterval = "minute" | "hour" | "day" | "week" | "month";
export type AdminUsageKind =
  | "all"
  | "llm"
  | "tool"
  | "asset"
  | "rag"
  | "embedding"
  | (string & {});
export type AdminUsageMetricKind =
  | "tokens"
  | "cost"
  | "calls"
  | "duration"
  | "credits"
  | "failures"
  | "unpriced";
export type AdminUsageGroupBy =
  | "kind"
  | "resource"
  | "operation"
  | "status"
  | "thread"
  | "participant"
  | "namespace"
  | "provider"
  | "model";
export type AdminUsageAttribution = "generatedBy" | "initiatedBy";
export type AdminUsageDimension =
  | "total"
  | "input"
  | "output"
  | "reasoning"
  | "cacheRead"
  | "cacheWrite";

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
  failedCalls: number;
  unpricedCalls: number;
  totalDurationMs: number;
  totalCredits: number;
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

export interface AdminAgentSummary extends AdminUsageTotals {
  agentId: string;
  displayName: string;
  description: string | null;
  isConfigured: boolean;
  namespace: string;
  isGlobal: boolean;
  messageCount: number;
  llmCallCount: number;
  toolCallMessageCount: number;
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
  attribution?: AdminUsageAttribution;
  kind?: AdminUsageKind;
  threadId?: string;
  participantId?: string;
  participantType?: "all" | "human" | "agent" | "job";
  namespace?: string;
  provider?: string;
  model?: string;
  resource?: string;
  operation?: string;
  status?: string;
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

export type AdminCollectionItem = Record<string, unknown> & {
  id?: string;
  _id?: string;
};

export interface AdminCollectionPage {
  data: AdminCollectionItem[];
  pageInfo?: {
    hasNextPage?: boolean;
    hasPreviousPage?: boolean;
    startCursor?: string | null;
    endCursor?: string | null;
  };
}

export interface AdminQueueEvent {
  id: string;
  threadId: string;
  eventType: string;
  payload: unknown;
  parentEventId: string | null;
  traceId: string | null;
  priority: number | null;
  status:
    | "pending"
    | "processing"
    | "completed"
    | "failed"
    | "expired"
    | "overwritten";
  namespace: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string | null;
  updatedAt: string | null;
}
