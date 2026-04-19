import React from "react";
import { cn } from "../../lib/utils";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import type {
  AdminActivityPoint,
  AdminAgentSummary,
  AdminParticipantSummary,
  AdminThreadSummary,
  AdminOverview,
  AdminUsageDimension,
  AdminUsageMetricKind,
  ResolvedAdminConfig,
} from "../../types";

interface DashboardViewProps {
  config: ResolvedAdminConfig;
  overview: AdminOverview | null;
  activity: AdminActivityPoint[];
  threads: AdminThreadSummary[];
  participants: AdminParticipantSummary[];
  agents: AdminAgentSummary[];
  interval: "hour" | "day";
  threadSearch: string;
  participantSearch: string;
  agentSearch: string;
  onThreadSearchChange: (value: string) => void;
  onParticipantSearchChange: (value: string) => void;
  onAgentSearchChange: (value: string) => void;
  onThreadClick?: (threadId: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  config,
  overview,
  activity,
  threads,
  participants,
  agents,
  interval,
  threadSearch,
  participantSearch,
  agentSearch,
  onThreadSearchChange,
  onParticipantSearchChange,
  onAgentSearchChange,
  onThreadClick,
}) => {
  const [usageMetricKind, setUsageMetricKind] = React.useState<AdminUsageMetricKind>(
    "tokens",
  );
  const [usageDimension, setUsageDimension] = React.useState<AdminUsageDimension>(
    "total",
  );

  const llmSummaryValue = overview
    ? getOverviewUsageValue(overview, usageMetricKind, usageDimension)
    : 0;
  const llmSummaryLabel = getUsageSummaryLabel(
    config.labels,
    usageMetricKind,
    usageDimension,
  );
  const usageBreakdownCards = USAGE_DIMENSIONS.map((dimension) => ({
    dimension,
    label: getUsageDimensionLabel(config.labels, dimension),
    value: overview
      ? getOverviewUsageValue(overview, usageMetricKind, dimension)
      : 0,
  }));

  const cards = [
    {
      label: config.labels.messagesCard,
      value: overview?.messageTotals.total ?? 0,
      detail: `${overview?.messageTotals.toolCallMessages ?? 0} tool-call messages`,
    },
    {
      label: config.labels.activeThreadsCard,
      value: overview?.threadTotals.active ?? 0,
      detail: `${overview?.threadTotals.total ?? 0} total threads`,
    },
    {
      label: config.labels.participantsCard,
      value: overview?.participantTotals.total ?? 0,
      detail: `${overview?.participantTotals.agents ?? 0} agents`,
    },
    {
      label: llmSummaryLabel,
      value: llmSummaryValue,
      detail: `${overview?.llmTotals.totalCalls ?? 0} ${config.labels.usageCallsDetail}`,
      metricKind: usageMetricKind,
    },
    {
      label: config.labels.queueCard,
      value: overview?.queueTotals.pending ?? 0,
      detail: `${overview?.queueTotals.failed ?? 0} failed`,
    },
  ];

  const isEmpty =
    cards.every((card) => card.value === 0) &&
    activity.length === 0 &&
    threads.length === 0 &&
    participants.length === 0 &&
    agents.length === 0;

  return (
    <div className="space-y-6">
      {isEmpty && (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <h3 className="text-lg font-semibold">{config.labels.emptyTitle}</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {config.labels.emptyDescription}
          </p>
        </div>
      )}

      {/* Overview Cards */}
      {config.features.showOverview && (
        <section className="space-y-4">
          <SectionHeading title={config.labels.overviewTitle} />
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
            {cards.map((card) => (
              <div
                className="rounded-xl border bg-card p-5 shadow-sm"
                key={card.label}
              >
                <p className="text-sm font-medium text-muted-foreground">
                  {card.label}
                </p>
                <p className="mt-3 text-3xl font-semibold tracking-tight">
                  {formatMetricValue(
                    card.value,
                    card.metricKind ?? "tokens",
                  )}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {card.detail}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {config.features.showOverview && (
        <section className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <SectionHeading title={config.labels.llmUsageTitle} />
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  {config.labels.usageMetricLabel}
                </p>
                <Select
                  value={usageMetricKind}
                  onValueChange={(value) =>
                    setUsageMetricKind(value as AdminUsageMetricKind)}
                >
                  <SelectTrigger className="h-9 w-full min-w-[160px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tokens">
                      {config.labels.usageMetricTokens}
                    </SelectItem>
                    <SelectItem value="cost">
                      {config.labels.usageMetricCost}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  {config.labels.usageDimensionLabel}
                </p>
                <Select
                  value={usageDimension}
                  onValueChange={(value) =>
                    setUsageDimension(value as AdminUsageDimension)}
                >
                  <SelectTrigger className="h-9 w-full min-w-[160px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {USAGE_DIMENSIONS.map((dimension) => (
                      <SelectItem key={dimension} value={dimension}>
                        {getUsageDimensionLabel(config.labels, dimension)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {usageBreakdownCards.map((card) => {
              const isSelected = card.dimension === usageDimension;
              return (
                <div
                  className={cn(
                    "rounded-xl border bg-card p-5 shadow-sm transition-colors",
                    isSelected && "border-primary/60 ring-1 ring-primary/15",
                  )}
                  key={card.dimension}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">
                        {card.label}
                      </p>
                      <p className="mt-3 text-2xl font-semibold tracking-tight">
                        {formatMetricValue(card.value, usageMetricKind)}
                      </p>
                    </div>
                    {isSelected && (
                      <Badge variant="outline">
                        {config.labels.usageDimensionLabel}
                      </Badge>
                    )}
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {overview?.llmTotals.totalCalls ?? 0} {config.labels.usageCallsDetail}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Activity Chart */}
      {config.features.showActivity && (
        <section className="space-y-4">
          <SectionHeading title={config.labels.activityTitle} />
          <ActivityChart
            interval={interval}
            labels={config.labels}
            maxBars={config.ui.maxActivityBars}
            points={activity}
            usageDimension={usageDimension}
            usageMetricKind={usageMetricKind}
          />
        </section>
      )}

      {/* Data Tables */}
      <div className="grid gap-6 lg:grid-cols-3">
        {config.features.showThreads && (
          <DataTable
            rows={threads}
            searchPlaceholder={config.labels.threadSearchPlaceholder}
            searchValue={threadSearch}
            setSearchValue={onThreadSearchChange}
            title={config.labels.threadsTitle}
          >
            <ThreadsTable
              rows={threads}
              labels={config.labels}
              onThreadClick={onThreadClick}
            />
          </DataTable>
        )}
        {config.features.showParticipants && (
          <DataTable
            rows={participants}
            searchPlaceholder={config.labels.participantSearchPlaceholder}
            searchValue={participantSearch}
            setSearchValue={onParticipantSearchChange}
            title={config.labels.participantsTitle}
          >
            <ParticipantsTable rows={participants} labels={config.labels} />
          </DataTable>
        )}
        {config.features.showAgents && (
          <DataTable
            rows={agents}
            searchPlaceholder={config.labels.agentSearchPlaceholder}
            searchValue={agentSearch}
            setSearchValue={onAgentSearchChange}
            title={config.labels.agentsTitle}
          >
            <AgentsTable
              rows={agents}
              labels={config.labels}
              usageMetricKind={usageMetricKind}
              usageDimension={usageDimension}
            />
          </DataTable>
        )}
      </div>
    </div>
  );
};

function SectionHeading({ title }: { title: string }) {
  return <h3 className="text-lg font-semibold tracking-tight">{title}</h3>;
}

function ActivityChart(props: {
  points: AdminActivityPoint[];
  interval: "hour" | "day";
  maxBars: number;
  labels: ResolvedAdminConfig["labels"];
  usageMetricKind: AdminUsageMetricKind;
  usageDimension: AdminUsageDimension;
}) {
  const trimmedPoints = props.points.slice(-props.maxBars);
  const maxUsageValue = Math.max(
    ...trimmedPoints.map((point) =>
      getActivityUsageValue(
        point,
        props.usageMetricKind,
        props.usageDimension,
      )
    ),
    1,
  );

  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      {trimmedPoints.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {props.labels.noResults}
        </p>
      ) : (
        <div className="flex min-h-48 items-end gap-2">
          {trimmedPoints.map((point) => {
            const usageValue = getActivityUsageValue(
              point,
              props.usageMetricKind,
              props.usageDimension,
            );
            return (
              <div
                className="flex min-w-0 flex-1 flex-col items-center gap-2"
                key={point.bucket}
              >
                <div className="flex h-36 w-full items-end rounded-lg bg-muted px-1 pb-1">
                  <div
                    className="w-full rounded-md bg-primary transition-all"
                    style={{
                      height: `${Math.max((usageValue / maxUsageValue) * 100, 8)}%`,
                    }}
                  />
                </div>
                <div className="text-center">
                  <p className="text-xs font-medium">
                    {formatBucket(point.bucket, props.interval)}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {formatMetricValue(usageValue, props.usageMetricKind)}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {formatNumber(point.totalCalls)} {props.labels.usageCallsDetail}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DataTable<T>(props: {
  title: string;
  searchPlaceholder: string;
  searchValue: string;
  setSearchValue: (value: string) => void;
  rows: T[];
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <SectionHeading title={props.title} />
        <Input
          className="h-8 w-full max-w-44"
          onChange={(event) => props.setSearchValue(event.target.value)}
          placeholder={props.searchPlaceholder}
          value={props.searchValue}
        />
      </div>
      {props.rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No results</p>
      ) : (
        props.children
      )}
    </div>
  );
}

function ThreadsTable({
  rows,
  labels,
  onThreadClick,
}: {
  rows: AdminThreadSummary[];
  labels: ResolvedAdminConfig["labels"];
  onThreadClick?: (threadId: string) => void;
}) {
  return (
    <div className="space-y-3">
      {rows.map((thread) => (
        <div
          className={cn(
            "rounded-lg border bg-muted/50 p-4",
            onThreadClick && "cursor-pointer hover:bg-muted transition-colors",
          )}
          key={thread.threadId}
          onClick={() => onThreadClick?.(thread.threadId)}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-medium">{thread.name}</p>
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {thread.summary ??
                  thread.lastMessagePreview ??
                  "No summary yet"}
              </p>
            </div>
            <Badge
              variant={
                thread.status === "archived" ? "secondary" : "default"
              }
            >
              {thread.status === "archived"
                ? labels.statusArchived
                : labels.statusActive}
            </Badge>
          </div>
          <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span>{formatNumber(thread.messageCount)} messages</span>
            <span>{thread.participantIds.length} participants</span>
            <span>{formatDate(thread.lastActivityAt)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function ParticipantsTable({
  rows,
  labels,
}: {
  rows: AdminParticipantSummary[];
  labels: ResolvedAdminConfig["labels"];
}) {
  return (
    <div className="space-y-3">
      {rows.map((participant) => (
        <div
          className="rounded-lg border bg-muted/50 p-4"
          key={`${participant.namespace}:${participant.externalId}`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-medium">{participant.displayName}</p>
              <p className="mt-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                {participant.participantType}
              </p>
            </div>
            <Badge variant="outline">
              {participant.isGlobal
                ? labels.scopeGlobal
                : labels.scopeScoped}
            </Badge>
          </div>
          <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span>{formatNumber(participant.messageCount)} messages</span>
            <span>{formatNumber(participant.threadCount)} threads</span>
            <span>{formatDate(participant.lastActivityAt)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function AgentsTable({
  rows,
  labels,
  usageMetricKind,
  usageDimension,
}: {
  rows: AdminAgentSummary[];
  labels: ResolvedAdminConfig["labels"];
  usageMetricKind: AdminUsageMetricKind;
  usageDimension: AdminUsageDimension;
}) {
  return (
    <div className="space-y-3">
      {rows.map((agent) => (
        <div
          className="rounded-lg border bg-muted/50 p-4"
          key={`${agent.namespace}:${agent.agentId}`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-medium">{agent.displayName}</p>
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {agent.description ?? agent.agentId}
              </p>
            </div>
            <Badge variant="outline">
              {agent.isConfigured
                ? labels.configured
                : labels.unconfigured}
            </Badge>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            {[
              {
                label: "Messages",
                value: formatNumber(agent.messageCount),
              },
              {
                label: "LLM calls",
                value: formatNumber(agent.llmCallCount),
              },
              {
                label: "Tool calls",
                value: formatNumber(agent.toolCallMessageCount),
              },
              {
                label: getUsageSummaryLabel(labels, usageMetricKind, usageDimension),
                value: formatMetricValue(
                  getAgentUsageValue(agent, usageMetricKind, usageDimension),
                  usageMetricKind,
                ),
              },
            ].map((item) => (
              <div key={item.label}>
                <p className="font-medium text-foreground">{item.value}</p>
                <p className="text-muted-foreground">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function formatBucket(bucket: string, interval: "hour" | "day") {
  const date = new Date(bucket);
  if (Number.isNaN(date.getTime())) return bucket;
  return interval === "hour"
    ? date.toLocaleString(undefined, {
        hour: "numeric",
        month: "short",
        day: "numeric",
      })
    : date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      });
}

function formatDate(value: string | null) {
  if (!value) return "No activity";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatNumber(value: number) {
  return new Intl.NumberFormat().format(value);
}

const USAGE_DIMENSIONS: AdminUsageDimension[] = [
  "total",
  "input",
  "output",
  "reasoning",
  "cacheRead",
  "cacheWrite",
];

function getUsageDimensionLabel(
  labels: ResolvedAdminConfig["labels"],
  dimension: AdminUsageDimension,
) {
  switch (dimension) {
    case "input":
      return labels.usageInput;
    case "output":
      return labels.usageOutput;
    case "reasoning":
      return labels.usageReasoning;
    case "cacheRead":
      return labels.usageCacheRead;
    case "cacheWrite":
      return labels.usageCacheWrite;
    case "total":
    default:
      return labels.usageTotal;
  }
}

function getUsageSummaryLabel(
  labels: ResolvedAdminConfig["labels"],
  metricKind: AdminUsageMetricKind,
  dimension: AdminUsageDimension,
) {
  const metricLabel = metricKind === "cost"
    ? labels.usageMetricCost
    : labels.usageMetricTokens;
  return `${getUsageDimensionLabel(labels, dimension)} ${metricLabel}`;
}

function getOverviewUsageValue(
  overview: AdminOverview,
  metricKind: AdminUsageMetricKind,
  dimension: AdminUsageDimension,
) {
  const llmTotals = overview.llmTotals;
  if (metricKind === "cost") {
    switch (dimension) {
      case "input":
        return llmTotals.inputCostUsd;
      case "output":
        return llmTotals.outputCostUsd;
      case "reasoning":
        return llmTotals.reasoningCostUsd;
      case "cacheRead":
        return llmTotals.cacheReadInputCostUsd;
      case "cacheWrite":
        return llmTotals.cacheCreationInputCostUsd;
      case "total":
      default:
        return llmTotals.totalCostUsd;
    }
  }

  switch (dimension) {
    case "input":
      return llmTotals.inputTokens;
    case "output":
      return llmTotals.outputTokens;
    case "reasoning":
      return llmTotals.reasoningTokens;
    case "cacheRead":
      return llmTotals.cacheReadInputTokens;
    case "cacheWrite":
      return llmTotals.cacheCreationInputTokens;
    case "total":
    default:
      return llmTotals.totalTokens;
  }
}

function getAgentUsageValue(
  agent: AdminAgentSummary,
  metricKind: AdminUsageMetricKind,
  dimension: AdminUsageDimension,
) {
  if (metricKind === "cost") {
    switch (dimension) {
      case "input":
        return agent.inputCostUsd;
      case "output":
        return agent.outputCostUsd;
      case "reasoning":
        return agent.reasoningCostUsd;
      case "cacheRead":
        return agent.cacheReadInputCostUsd;
      case "cacheWrite":
        return agent.cacheCreationInputCostUsd;
      case "total":
      default:
        return agent.totalCostUsd;
    }
  }

  switch (dimension) {
    case "input":
      return agent.inputTokens;
    case "output":
      return agent.outputTokens;
    case "reasoning":
      return agent.reasoningTokens;
    case "cacheRead":
      return agent.cacheReadInputTokens;
    case "cacheWrite":
      return agent.cacheCreationInputTokens;
    case "total":
    default:
      return agent.totalTokens;
  }
}

function getActivityUsageValue(
  point: AdminActivityPoint,
  metricKind: AdminUsageMetricKind,
  dimension: AdminUsageDimension,
) {
  if (metricKind === "cost") {
    switch (dimension) {
      case "input":
        return point.inputCostUsd;
      case "output":
        return point.outputCostUsd;
      case "reasoning":
        return point.reasoningCostUsd;
      case "cacheRead":
        return point.cacheReadInputCostUsd;
      case "cacheWrite":
        return point.cacheCreationInputCostUsd;
      case "total":
      default:
        return point.totalCostUsd;
    }
  }

  switch (dimension) {
    case "input":
      return point.inputTokens;
    case "output":
      return point.outputTokens;
    case "reasoning":
      return point.reasoningTokens;
    case "cacheRead":
      return point.cacheReadInputTokens;
    case "cacheWrite":
      return point.cacheCreationInputTokens;
    case "total":
    default:
      return point.totalTokens;
  }
}

function formatMetricValue(
  value: number,
  metricKind: AdminUsageMetricKind,
) {
  if (metricKind === "cost") {
    const absoluteValue = Math.abs(value);
    const maximumFractionDigits = absoluteValue >= 1
      ? 2
      : absoluteValue >= 0.01
        ? 4
        : 6;
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits,
    }).format(value);
  }

  return formatNumber(value);
}
