import React from "react";
import { cn } from "../../lib/utils";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
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
  AdminUsageGroupBy,
  AdminUsageInterval,
  AdminUsageMetricKind,
  AdminUsageResponse,
  AdminUsagePoint,
  ResolvedAdminConfig,
} from "../../types";
import { fetchAdminUsage } from "../../adminService";

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
  namespace?: string;
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
  namespace,
}) => {
  const [usageMetricKind, setUsageMetricKind] = React.useState<AdminUsageMetricKind>(
    "cost",
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
      detail: `${overview?.participantTotals.agents ?? 0} agents, ${
        overview?.participantTotals.jobs ?? 0
      } jobs`,
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
        <UsageExplorer
          config={config}
          metricKind={usageMetricKind}
          namespace={namespace}
          onDimensionChange={setUsageDimension}
          onMetricKindChange={setUsageMetricKind}
          selectedDimension={usageDimension}
        />
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

function UsageExplorer(props: {
  config: ResolvedAdminConfig;
  namespace?: string;
  metricKind: AdminUsageMetricKind;
  selectedDimension: AdminUsageDimension;
  onMetricKindChange: (value: AdminUsageMetricKind) => void;
  onDimensionChange: (value: AdminUsageDimension) => void;
}) {
  const [period, setPeriod] = React.useState<AdminDatePreset | "custom">("7d");
  const [bucket, setBucket] = React.useState<AdminUsageInterval>("day");
  const [groupBy, setGroupBy] = React.useState<AdminUsageGroupBy>("participant");
  const [participantType, setParticipantType] = React.useState<"all" | "human" | "agent" | "job">("all");
  const [threadId, setThreadId] = React.useState("");
  const [participantId, setParticipantId] = React.useState("");
  const [provider, setProvider] = React.useState("");
  const [model, setModel] = React.useState("");
  const [customFrom, setCustomFrom] = React.useState("");
  const [customTo, setCustomTo] = React.useState("");
  const [usage, setUsage] = React.useState<AdminUsageResponse | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const range = React.useMemo(() => getUsageRange(period, customFrom, customTo), [
    customFrom,
    customTo,
    period,
  ]);

  const loadUsage = React.useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const next = await fetchAdminUsage({
        from: range.from,
        to: range.to,
        interval: bucket,
        metric: props.metricKind,
        groupBy,
        namespace: props.namespace || undefined,
        participantType,
        threadId: emptyToUndefined(threadId),
        participantId: emptyToUndefined(participantId),
        provider: emptyToUndefined(provider),
        model: emptyToUndefined(model),
      }, {
        baseUrl: props.config.baseUrl,
        getRequestHeaders: props.config.getRequestHeaders,
      });
      setUsage(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load usage");
      setUsage(null);
    } finally {
      setIsLoading(false);
    }
  }, [
    bucket,
    groupBy,
    model,
    participantId,
    participantType,
    props.config.baseUrl,
    props.config.getRequestHeaders,
    props.metricKind,
    props.namespace,
    provider,
    range.from,
    range.to,
    threadId,
  ]);

  React.useEffect(() => {
    void loadUsage();
  }, [loadUsage]);

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <SectionHeading title={props.config.labels.llmUsageTitle} />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <UsageSelect
            label="Period"
            value={period}
            onValueChange={(value) => setPeriod(value as AdminDatePreset | "custom")}
            options={[
              ["24h", props.config.labels.range24h],
              ["7d", props.config.labels.range7d],
              ["30d", props.config.labels.range30d],
              ["custom", "Custom"],
            ]}
          />
          <UsageSelect
            label="Bucket"
            value={bucket}
            onValueChange={(value) => setBucket(value as AdminUsageInterval)}
            options={[
              ["minute", "Minute"],
              ["hour", "Hour"],
              ["day", "Day"],
              ["week", "Week"],
              ["month", "Month"],
            ]}
          />
          <UsageSelect
            label={props.config.labels.usageMetricLabel}
            value={props.metricKind}
            onValueChange={(value) => props.onMetricKindChange(value as AdminUsageMetricKind)}
            options={[
              ["cost", props.config.labels.usageMetricCost],
              ["tokens", props.config.labels.usageMetricTokens],
              ["calls", "Calls"],
            ]}
          />
          <UsageSelect
            label="Group by"
            value={groupBy}
            onValueChange={(value) => setGroupBy(value as AdminUsageGroupBy)}
            options={[
              ["participant", "Participant"],
              ["thread", "Thread"],
              ["namespace", "Namespace"],
              ["provider", "Provider"],
              ["model", "Model"],
            ]}
          />
          <UsageSelect
            label={props.config.labels.usageDimensionLabel}
            value={props.selectedDimension}
            onValueChange={(value) => props.onDimensionChange(value as AdminUsageDimension)}
            options={USAGE_DIMENSIONS.map((dimension) => [
              dimension,
              getUsageDimensionLabel(props.config.labels, dimension),
            ])}
          />
        </div>
      </div>

      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          {period === "custom" && (
            <>
              <FilterInput label="From" type="datetime-local" value={customFrom} onChange={setCustomFrom} />
              <FilterInput label="To" type="datetime-local" value={customTo} onChange={setCustomTo} />
            </>
          )}
          <UsageSelect
            label="Participant type"
            value={participantType}
            onValueChange={(value) => setParticipantType(value as "all" | "human" | "agent" | "job")}
            options={[
              ["all", "All"],
              ["human", "Human"],
              ["agent", "Agent"],
              ["job", "Job"],
            ]}
          />
          <FilterInput label="Thread" value={threadId} onChange={setThreadId} />
          <FilterInput label="Participant" value={participantId} onChange={setParticipantId} />
          <FilterInput label="Provider" value={provider} onChange={setProvider} />
          <FilterInput label="Model" value={model} onChange={setModel} />
          <div className="flex items-end">
            <Button
              className="h-9 w-full"
              onClick={() => void loadUsage()}
              disabled={isLoading}
              variant="outline"
            >
              {props.config.labels.refresh}
            </Button>
          </div>
        </div>
      </div>

      <UsageChart
        labels={props.config.labels}
        metricKind={props.metricKind}
        dimension={props.selectedDimension}
        points={usage?.points ?? []}
        bucket={bucket}
        isLoading={isLoading}
        error={error}
      />

      <UsageTable
        labels={props.config.labels}
        metricKind={props.metricKind}
        dimension={props.selectedDimension}
        rows={usage?.rows ?? []}
        isLoading={isLoading}
      />
    </section>
  );
}

function UsageSelect(props: {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: Array<[string, string]>;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
        {props.label}
      </p>
      <Select value={props.value} onValueChange={props.onValueChange}>
        <SelectTrigger className="h-9 w-full min-w-[140px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {props.options.map(([value, label]) => (
            <SelectItem key={value} value={value}>{label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function FilterInput(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
        {props.label}
      </p>
      <Input
        className="h-9"
        type={props.type ?? "text"}
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
      />
    </div>
  );
}

function UsageChart(props: {
  points: AdminUsagePoint[];
  labels: ResolvedAdminConfig["labels"];
  metricKind: AdminUsageMetricKind;
  dimension: AdminUsageDimension;
  bucket: AdminUsageInterval;
  isLoading: boolean;
  error: string | null;
}) {
  const buckets = React.useMemo(() => buildUsageBuckets(props.points), [props.points]);
  const visibleBuckets = buckets.slice(-18);
  const groups = React.useMemo(() => topUsageGroups(props.points, props.metricKind, props.dimension), [
    props.dimension,
    props.metricKind,
    props.points,
  ]);
  const maxBucketValue = Math.max(
    ...visibleBuckets.map((bucket) =>
      bucket.points.reduce((sum, point) =>
        sum + getUsagePointValue(point, props.metricKind, props.dimension), 0)
    ),
    1,
  );

  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      {props.error ? (
        <p className="text-sm text-destructive">{props.error}</p>
      ) : props.isLoading && props.points.length === 0 ? (
        <p className="text-sm text-muted-foreground">{props.labels.loading}</p>
      ) : visibleBuckets.length === 0 ? (
        <p className="text-sm text-muted-foreground">{props.labels.noResults}</p>
      ) : (
        <div className="space-y-4">
          <div className="flex min-h-56 items-end gap-2">
            {visibleBuckets.map((bucket) => {
              const bucketTotal = bucket.points.reduce((sum, point) =>
                sum + getUsagePointValue(point, props.metricKind, props.dimension), 0);
              return (
                <div className="flex min-w-0 flex-1 flex-col items-center gap-2" key={bucket.bucket}>
                  <div className="flex h-40 w-full items-end rounded-lg bg-muted px-1 pb-1">
                    <div
                      className="flex w-full flex-col-reverse overflow-hidden rounded-md"
                      style={{
                        height: `${Math.max((bucketTotal / maxBucketValue) * 100, 6)}%`,
                      }}
                    >
                      {groups.map((group, index) => {
                        const point = bucket.points.find((item) => item.groupKey === group.key);
                        const value = point
                          ? getUsagePointValue(point, props.metricKind, props.dimension)
                          : 0;
                        if (value <= 0 || bucketTotal <= 0) return null;
                        return (
                          <div
                            key={group.key}
                            title={`${group.label}: ${formatMetricValue(value, props.metricKind)}`}
                            style={{
                              height: `${(value / bucketTotal) * 100}%`,
                              backgroundColor: USAGE_CHART_COLORS[index % USAGE_CHART_COLORS.length],
                            }}
                          />
                        );
                      })}
                    </div>
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-medium">{formatUsageBucket(bucket.bucket, props.bucket)}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {formatMetricValue(bucketTotal, props.metricKind)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-3">
            {groups.map((group, index) => (
              <div className="flex items-center gap-2 text-xs" key={group.key}>
                <span
                  className="size-2 rounded-sm"
                  style={{ backgroundColor: USAGE_CHART_COLORS[index % USAGE_CHART_COLORS.length] }}
                />
                <span className="max-w-48 truncate text-muted-foreground">{group.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function UsageTable(props: {
  rows: AdminUsagePoint[];
  labels: ResolvedAdminConfig["labels"];
  metricKind: AdminUsageMetricKind;
  dimension: AdminUsageDimension;
  isLoading: boolean;
}) {
  const rows = props.rows.slice(0, 40);
  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <SectionHeading title="Usage detail" />
        {props.isLoading && (
          <Badge variant="outline">{props.labels.loading}</Badge>
        )}
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{props.labels.noResults}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-[0.14em] text-muted-foreground">
                <th className="py-2 pr-4 font-medium">Interval</th>
                <th className="py-2 pr-4 font-medium">Group</th>
                <th className="py-2 pr-4 text-right font-medium">Input</th>
                <th className="py-2 pr-4 text-right font-medium">Output</th>
                <th className="py-2 pr-4 text-right font-medium">Reasoning</th>
                <th className="py-2 pr-4 text-right font-medium">Cache read</th>
                <th className="py-2 pr-4 text-right font-medium">Cache write</th>
                <th className="py-2 text-right font-medium">
                  {getUsageSummaryLabel(props.labels, props.metricKind, props.dimension)}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr className="border-b last:border-0" key={`${row.bucket}:${row.groupKey}`}>
                  <td className="py-2 pr-4 text-muted-foreground">{formatDate(row.bucket)}</td>
                  <td className="max-w-72 truncate py-2 pr-4 font-medium">{row.groupLabel}</td>
                  <td className="py-2 pr-4 text-right">{formatMetricValue(getUsagePointValue(row, props.metricKind, "input"), props.metricKind)}</td>
                  <td className="py-2 pr-4 text-right">{formatMetricValue(getUsagePointValue(row, props.metricKind, "output"), props.metricKind)}</td>
                  <td className="py-2 pr-4 text-right">{formatMetricValue(getUsagePointValue(row, props.metricKind, "reasoning"), props.metricKind)}</td>
                  <td className="py-2 pr-4 text-right">{formatMetricValue(getUsagePointValue(row, props.metricKind, "cacheRead"), props.metricKind)}</td>
                  <td className="py-2 pr-4 text-right">{formatMetricValue(getUsagePointValue(row, props.metricKind, "cacheWrite"), props.metricKind)}</td>
                  <td className="py-2 text-right font-medium">{formatMetricValue(getUsagePointValue(row, props.metricKind, props.dimension), props.metricKind)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
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

function formatUsageBucket(bucket: string, interval: AdminUsageInterval) {
  const date = new Date(bucket);
  if (Number.isNaN(date.getTime())) return bucket;
  if (interval === "minute" || interval === "hour") {
    return date.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: interval === "minute" ? "2-digit" : undefined,
    });
  }
  if (interval === "month") {
    return date.toLocaleDateString(undefined, {
      month: "short",
      year: "numeric",
    });
  }
  return date.toLocaleDateString(undefined, {
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

const USAGE_CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2, 142 76% 36%))",
  "hsl(var(--chart-3, 38 92% 50%))",
  "hsl(var(--chart-4, 199 89% 48%))",
  "hsl(var(--chart-5, 346 77% 49%))",
  "hsl(var(--muted-foreground))",
];

function emptyToUndefined(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function getUsageRange(
  period: AdminDatePreset | "custom",
  customFrom: string,
  customTo: string,
) {
  if (period === "custom") {
    return {
      from: customFrom ? new Date(customFrom).toISOString() : undefined,
      to: customTo ? new Date(customTo).toISOString() : undefined,
    };
  }
  const to = new Date();
  const from = new Date(to);
  if (period === "24h") {
    from.setHours(from.getHours() - 24);
  } else if (period === "30d") {
    from.setDate(from.getDate() - 30);
  } else {
    from.setDate(from.getDate() - 7);
  }
  return { from: from.toISOString(), to: to.toISOString() };
}

function buildUsageBuckets(points: AdminUsagePoint[]) {
  const byBucket = new Map<string, AdminUsagePoint[]>();
  for (const point of points) {
    const rows = byBucket.get(point.bucket) ?? [];
    rows.push(point);
    byBucket.set(point.bucket, rows);
  }
  return Array.from(byBucket.entries())
    .map(([bucket, bucketPoints]) => ({ bucket, points: bucketPoints }))
    .sort((a, b) => new Date(a.bucket).getTime() - new Date(b.bucket).getTime());
}

function topUsageGroups(
  points: AdminUsagePoint[],
  metricKind: AdminUsageMetricKind,
  dimension: AdminUsageDimension,
) {
  const totals = new Map<string, { key: string; label: string; value: number }>();
  for (const point of points) {
    const existing = totals.get(point.groupKey) ?? {
      key: point.groupKey,
      label: point.groupLabel,
      value: 0,
    };
    existing.value += getUsagePointValue(point, metricKind, dimension);
    totals.set(point.groupKey, existing);
  }
  return Array.from(totals.values())
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);
}

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
    : metricKind === "calls"
    ? "Calls"
    : labels.usageMetricTokens;
  return `${getUsageDimensionLabel(labels, dimension)} ${metricLabel}`;
}

function getOverviewUsageValue(
  overview: AdminOverview,
  metricKind: AdminUsageMetricKind,
  dimension: AdminUsageDimension,
) {
  const llmTotals = overview.llmTotals;
  if (metricKind === "calls") return llmTotals.totalCalls;
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
  if (metricKind === "calls") return agent.llmCallCount;

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
  if (metricKind === "calls") return point.llmCallCount;

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

function getUsagePointValue(
  point: AdminUsagePoint,
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
  if (metricKind === "calls") return point.totalCalls;

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
