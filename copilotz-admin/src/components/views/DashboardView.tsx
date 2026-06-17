import React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  Database,
  Filter,
  RefreshCw,
  Search,
  Sparkles,
  Users,
  Wallet,
} from "lucide-react";

import { fetchAdminUsage } from "../../adminService";
import { cn } from "../../lib/utils";
import type {
  AdminActivityPoint,
  AdminAgentSummary,
  AdminDatePreset,
  AdminOverview,
  AdminParticipantSummary,
  AdminThreadSummary,
  AdminUsageAttribution,
  AdminUsageDimension,
  AdminUsageGroupBy,
  AdminUsageInterval,
  AdminUsageMetricKind,
  AdminUsagePoint,
  AdminUsageResponse,
  AdminUsageTotals,
  ResolvedAdminConfig,
} from "../../types";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartLegendContent,
  ChartTooltipContent,
} from "../ui/chart";
import { Input } from "../ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

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
  void overview;
  void activity;
  void threads;
  void participants;
  void agents;
  void interval;
  void threadSearch;
  void participantSearch;
  void agentSearch;
  void onThreadSearchChange;
  void onParticipantSearchChange;
  void onAgentSearchChange;
  void onThreadClick;

  if (!config.features.showOverview) {
    return (
      <EmptyDashboard
        description={config.labels.emptyDescription}
        title={config.labels.emptyTitle}
      />
    );
  }

  return (
    <UsageDashboard
      config={config}
      namespace={namespace}
    />
  );
};

function UsageDashboard({
  config,
  namespace,
}: {
  config: ResolvedAdminConfig;
  namespace?: string;
}) {
  const [period, setPeriod] = React.useState<AdminDatePreset | "custom">("7d");
  const [bucket, setBucket] = React.useState<AdminUsageInterval>("day");
  const [metricKind, setMetricKind] = React.useState<AdminUsageMetricKind>(
    "cost",
  );
  const [dimension, setDimension] = React.useState<AdminUsageDimension>("total");
  const [groupBy, setGroupBy] = React.useState<AdminUsageGroupBy>(
    "participant",
  );
  const [attribution, setAttribution] = React.useState<AdminUsageAttribution>(
    "initiatedBy",
  );
  const [participantType, setParticipantType] = React.useState<
    "all" | "human" | "agent" | "job"
  >("all");
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
        metric: metricKind,
        groupBy,
        attribution,
        namespace: namespace || undefined,
        participantType,
        threadId: emptyToUndefined(threadId),
        participantId: emptyToUndefined(participantId),
        provider: emptyToUndefined(provider),
        model: emptyToUndefined(model),
      }, {
        baseUrl: config.baseUrl,
        getRequestHeaders: config.getRequestHeaders,
      });
      setUsage(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load usage");
      setUsage(null);
    } finally {
      setIsLoading(false);
    }
  }, [
    attribution,
    bucket,
    config.baseUrl,
    config.getRequestHeaders,
    groupBy,
    metricKind,
    model,
    namespace,
    participantId,
    participantType,
    provider,
    range.from,
    range.to,
    threadId,
  ]);

  React.useEffect(() => {
    void loadUsage();
  }, [loadUsage]);

  const points = usage?.points ?? [];
  const totals = usage?.totals ?? EMPTY_TOTALS;
  const chartState = React.useMemo(() =>
    buildChartState(points, metricKind, dimension, bucket), [
      bucket,
      dimension,
      metricKind,
      points,
    ]);
  const groupedRows = React.useMemo(() =>
    aggregateUsageRows(points, metricKind, dimension), [
      dimension,
      metricKind,
      points,
    ]);
  const activeFilterCount = [
    participantType !== "all" ? participantType : "",
    threadId,
    participantId,
    provider,
    model,
    period === "custom" ? customFrom : "",
    period === "custom" ? customTo : "",
  ].filter((value) => value.trim().length > 0).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">
            {config.labels.llmUsageTitle}
          </h2>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge variant="outline">{formatUsageRangeLabel(period, range)}</Badge>
            <Badge variant="secondary">
              {getGroupByLabel(groupBy)}
            </Badge>
            {groupBy === "participant" && (
              <Badge variant="outline">
                {attribution === "initiatedBy"
                  ? "Initiated by sender"
                  : "Generated by caller"}
              </Badge>
            )}
          </div>
        </div>
        <Button
          className="w-full sm:w-auto"
          disabled={isLoading}
          onClick={() => void loadUsage()}
          size="sm"
          variant="outline"
        >
          <RefreshCw className={cn("size-4", isLoading && "animate-spin")} />
          {config.labels.refresh}
        </Button>
      </div>

      <UsageSummary
        dimension={dimension}
        labels={config.labels}
        metricKind={metricKind}
        totals={totals}
      />

      <Card className="gap-4 overflow-hidden py-4">
        <CardContent className="space-y-4 px-4 lg:px-5">
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-6">
            <UsageSelect
              label="Period"
              onValueChange={(value) =>
                setPeriod(value as AdminDatePreset | "custom")}
              options={[
                ["24h", config.labels.range24h],
                ["7d", config.labels.range7d],
                ["30d", config.labels.range30d],
                ["custom", "Custom"],
              ]}
              value={period}
            />
            <UsageSelect
              label="Bucket"
              onValueChange={(value) => setBucket(value as AdminUsageInterval)}
              options={[
                ["minute", "Minute"],
                ["hour", "Hour"],
                ["day", "Day"],
                ["week", "Week"],
                ["month", "Month"],
              ]}
              value={bucket}
            />
            <UsageSelect
              label={config.labels.usageMetricLabel}
              onValueChange={(value) =>
                setMetricKind(value as AdminUsageMetricKind)}
              options={[
                ["cost", config.labels.usageMetricCost],
                ["tokens", config.labels.usageMetricTokens],
                ["calls", "Calls"],
              ]}
              value={metricKind}
            />
            <UsageSelect
              label="Group"
              onValueChange={(value) => setGroupBy(value as AdminUsageGroupBy)}
              options={[
                ["participant", "Participant"],
                ["thread", "Thread"],
                ["namespace", "Namespace"],
                ["provider", "Provider"],
                ["model", "Model"],
              ]}
              value={groupBy}
            />
            <UsageSelect
              label="Attribution"
              onValueChange={(value) =>
                setAttribution(value as AdminUsageAttribution)}
              options={[
                ["initiatedBy", "Initiated by"],
                ["generatedBy", "Generated by"],
              ]}
              value={attribution}
            />
            <UsageSelect
              label={config.labels.usageDimensionLabel}
              onValueChange={(value) =>
                setDimension(value as AdminUsageDimension)}
              options={USAGE_DIMENSIONS.map((nextDimension) => [
                nextDimension,
                getUsageDimensionLabel(config.labels, nextDimension),
              ])}
              value={dimension}
            />
          </div>

          <div className="rounded-lg border bg-muted/30 p-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Filter className="size-4" />
                <span>Filters</span>
                {activeFilterCount > 0 && (
                  <Badge variant="secondary">{activeFilterCount}</Badge>
                )}
              </div>
              {activeFilterCount > 0 && (
                <Button
                  onClick={() => {
                    setParticipantType("all");
                    setThreadId("");
                    setParticipantId("");
                    setProvider("");
                    setModel("");
                    setCustomFrom("");
                    setCustomTo("");
                  }}
                  size="sm"
                  variant="ghost"
                >
                  Clear
                </Button>
              )}
            </div>
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-6">
              {period === "custom" && (
                <>
                  <FilterInput
                    label="From"
                    onChange={setCustomFrom}
                    type="datetime-local"
                    value={customFrom}
                  />
                  <FilterInput
                    label="To"
                    onChange={setCustomTo}
                    type="datetime-local"
                    value={customTo}
                  />
                </>
              )}
              <UsageSelect
                label="Type"
                onValueChange={(value) =>
                  setParticipantType(
                    value as "all" | "human" | "agent" | "job",
                  )}
                options={[
                  ["all", "All"],
                  ["human", "Human"],
                  ["agent", "Agent"],
                  ["job", "Job"],
                ]}
                value={participantType}
              />
              <FilterInput
                icon={<Search className="size-3.5" />}
                label="Thread"
                onChange={setThreadId}
                value={threadId}
              />
              <FilterInput
                icon={<Users className="size-3.5" />}
                label="Participant"
                onChange={setParticipantId}
                value={participantId}
              />
              <FilterInput
                icon={<Database className="size-3.5" />}
                label="Provider"
                onChange={setProvider}
                value={provider}
              />
              <FilterInput
                icon={<Sparkles className="size-3.5" />}
                label="Model"
                onChange={setModel}
                value={model}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="gap-3 overflow-hidden py-4">
        <CardHeader className="px-4 lg:px-5">
          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div>
              <CardTitle className="text-base">
                {getUsageSummaryLabel(config.labels, metricKind, dimension)}
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                {formatMetricValue(
                  getUsageTotalValue(totals, metricKind, dimension),
                  metricKind,
                )}{" "}
                across {formatNumber(totals.totalCalls)} calls
              </p>
            </div>
            {isLoading && <Badge variant="outline">{config.labels.loading}</Badge>}
          </div>
        </CardHeader>
        <CardContent className="px-2 lg:px-4">
          {error ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
              {error}
            </div>
          ) : chartState.data.length === 0 ? (
            <EmptyDashboard
              description={config.labels.noResults}
              title="No usage"
            />
          ) : (
            <UsageChart
              chartState={chartState}
              metricKind={metricKind}
            />
          )}
        </CardContent>
      </Card>

      <UsageTable
        dimension={dimension}
        groupBy={groupBy}
        labels={config.labels}
        metricKind={metricKind}
        onRowFilter={(row) => {
          if (groupBy === "thread") setThreadId(row.groupKey);
          if (groupBy === "participant") setParticipantId(row.groupKey);
          if (groupBy === "provider") setProvider(row.groupKey);
          if (groupBy === "model") setModel(row.groupKey);
        }}
        rows={groupedRows}
        totals={totals}
      />
    </div>
  );
}

function UsageSummary({
  dimension,
  labels,
  metricKind,
  totals,
}: {
  dimension: AdminUsageDimension;
  labels: ResolvedAdminConfig["labels"];
  metricKind: AdminUsageMetricKind;
  totals: AdminUsageTotals;
}) {
  const summary = [
    {
      label: labels.usageMetricCost,
      value: formatMetricValue(totals.totalCostUsd, "cost"),
      detail: `${formatNumber(totals.totalCalls)} ${labels.usageCallsDetail}`,
      icon: Wallet,
    },
    {
      label: labels.usageMetricTokens,
      value: formatMetricValue(totals.totalTokens, "tokens"),
      detail: `${formatMetricValue(totals.inputTokens, "tokens")} input`,
      icon: Activity,
    },
    {
      label: labels.usageCacheRead,
      value: formatMetricValue(totals.cacheReadInputCostUsd, "cost"),
      detail: `${formatMetricValue(totals.cacheReadInputTokens, "tokens")} tokens`,
      icon: Database,
    },
    {
      label: getUsageSummaryLabel(labels, metricKind, dimension),
      value: formatMetricValue(
        getUsageTotalValue(totals, metricKind, dimension),
        metricKind,
      ),
      detail: labels.usageTotal,
      icon: Sparkles,
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {summary.map((item) => (
        <Card className="gap-3 py-4" key={item.label}>
          <CardContent className="px-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm text-muted-foreground">
                  {item.label}
                </p>
                <p className="mt-1 truncate text-2xl font-semibold tracking-tight">
                  {item.value}
                </p>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {item.detail}
                </p>
              </div>
              <div className="rounded-md border bg-muted/50 p-2 text-muted-foreground">
                <item.icon className="size-4" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function UsageChart({
  chartState,
  metricKind,
}: {
  chartState: ChartState;
  metricKind: AdminUsageMetricKind;
}) {
  return (
    <ChartContainer
      className="h-[320px] w-full"
      config={chartState.config}
    >
      <BarChart
        accessibilityLayer
        data={chartState.data}
        margin={{ left: 8, right: 8, top: 12 }}
      >
        <CartesianGrid vertical={false} />
        <XAxis
          axisLine={false}
          dataKey="label"
          tickLine={false}
          tickMargin={10}
        />
        <YAxis
          axisLine={false}
          tickFormatter={(value) => formatCompactMetric(value, metricKind)}
          tickLine={false}
          width={60}
        />
        <Tooltip
          content={
            <ChartTooltipContent
              formatter={(value) =>
                formatMetricValue(Number(value), metricKind)}
              labelFormatter={(value) => String(value ?? "")}
            />
          }
          cursor={false}
        />
        <Legend
          content={<ChartLegendContent className="justify-center pt-3" />}
        />
        {chartState.series.map((series) => (
          <Bar
            dataKey={series.id}
            fill={`var(--color-${series.id})`}
            key={series.id}
            radius={[4, 4, 0, 0]}
            stackId="usage"
          />
        ))}
      </BarChart>
    </ChartContainer>
  );
}

function UsageTable({
  dimension,
  groupBy,
  labels,
  metricKind,
  onRowFilter,
  rows,
  totals,
}: {
  dimension: AdminUsageDimension;
  groupBy: AdminUsageGroupBy;
  labels: ResolvedAdminConfig["labels"];
  metricKind: AdminUsageMetricKind;
  onRowFilter: (row: AggregatedUsageRow) => void;
  rows: AggregatedUsageRow[];
  totals: AdminUsageTotals;
}) {
  const totalValue = getUsageTotalValue(totals, metricKind, dimension);
  const filterable = groupBy !== "namespace";

  return (
    <Card className="gap-3 py-4">
      <CardHeader className="px-4 lg:px-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-base">Usage detail</CardTitle>
          <Badge variant="outline">
            {formatNumber(rows.length)} {getGroupByLabel(groupBy).toLowerCase()}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="px-0">
        {rows.length === 0 ? (
          <p className="px-5 py-4 text-sm text-muted-foreground">
            {labels.noResults}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[940px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-[0.12em] text-muted-foreground">
                  <th className="px-5 py-2.5 font-medium">
                    {getGroupByLabel(groupBy)}
                  </th>
                  <th className="px-3 py-2.5 text-right font-medium">
                    {getUsageSummaryLabel(labels, metricKind, dimension)}
                  </th>
                  <th className="px-3 py-2.5 text-right font-medium">Share</th>
                  <th className="px-3 py-2.5 text-right font-medium">Calls</th>
                  <th className="px-3 py-2.5 text-right font-medium">Input</th>
                  <th className="px-3 py-2.5 text-right font-medium">Output</th>
                  <th className="px-3 py-2.5 text-right font-medium">
                    Reasoning
                  </th>
                  <th className="px-3 py-2.5 text-right font-medium">
                    Cache read
                  </th>
                  <th className="px-5 py-2.5 text-right font-medium">
                    Avg/call
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 60).map((row) => {
                  const share = totalValue > 0 ? row.value / totalValue : 0;
                  return (
                    <tr
                      className={cn(
                        "border-b last:border-0",
                        filterable &&
                          "cursor-pointer transition-colors hover:bg-muted/50",
                      )}
                      key={row.groupKey}
                      onClick={() => filterable && onRowFilter(row)}
                    >
                      <td className="px-5 py-3">
                        <div className="max-w-80 truncate font-medium">
                          {row.groupLabel}
                        </div>
                        {row.groupKey !== row.groupLabel && (
                          <div className="mt-0.5 max-w-80 truncate text-xs text-muted-foreground">
                            {row.groupKey}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right font-medium">
                        {formatMetricValue(row.value, metricKind)}
                      </td>
                      <td className="px-3 py-3 text-right">
                        {formatPercent(share)}
                      </td>
                      <td className="px-3 py-3 text-right">
                        {formatNumber(row.totalCalls)}
                      </td>
                      <td className="px-3 py-3 text-right">
                        {formatMetricValue(
                          getUsageTotalValue(row, metricKind, "input"),
                          metricKind,
                        )}
                      </td>
                      <td className="px-3 py-3 text-right">
                        {formatMetricValue(
                          getUsageTotalValue(row, metricKind, "output"),
                          metricKind,
                        )}
                      </td>
                      <td className="px-3 py-3 text-right">
                        {formatMetricValue(
                          getUsageTotalValue(row, metricKind, "reasoning"),
                          metricKind,
                        )}
                      </td>
                      <td className="px-3 py-3 text-right">
                        {formatMetricValue(
                          getUsageTotalValue(row, metricKind, "cacheRead"),
                          metricKind,
                        )}
                      </td>
                      <td className="px-5 py-3 text-right">
                        {formatMetricValue(
                          row.totalCalls > 0 ? row.value / row.totalCalls : 0,
                          metricKind,
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function UsageSelect(props: {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: Array<[string, string]>;
}) {
  return (
    <label className="space-y-1">
      <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
        {props.label}
      </span>
      <Select value={props.value} onValueChange={props.onValueChange}>
        <SelectTrigger className="h-9 w-full min-w-0 bg-background">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {props.options.map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}

function FilterInput(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  icon?: React.ReactNode;
  type?: string;
}) {
  return (
    <label className="space-y-1">
      <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
        {props.label}
      </span>
      <div className="relative">
        {props.icon && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            {props.icon}
          </span>
        )}
        <Input
          className={cn("h-9 bg-background", props.icon && "pl-8")}
          onChange={(event) => props.onChange(event.target.value)}
          type={props.type ?? "text"}
          value={props.value}
        />
      </div>
    </label>
  );
}

function EmptyDashboard({
  description,
  title,
}: {
  description: string;
  title: string;
}) {
  return (
    <div className="rounded-lg border border-dashed bg-muted/20 p-8 text-center">
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

interface ChartSeries {
  color: string;
  id: string;
  key: string;
  label: string;
}

interface ChartState {
  config: ChartConfig;
  data: Array<Record<string, number | string>>;
  series: ChartSeries[];
}

interface AggregatedUsageRow extends AdminUsageTotals {
  groupKey: string;
  groupLabel: string;
  value: number;
}

const EMPTY_TOTALS: AdminUsageTotals = {
  inputTokens: 0,
  outputTokens: 0,
  reasoningTokens: 0,
  cacheReadInputTokens: 0,
  cacheCreationInputTokens: 0,
  totalTokens: 0,
  inputCostUsd: 0,
  outputCostUsd: 0,
  reasoningCostUsd: 0,
  cacheReadInputCostUsd: 0,
  cacheCreationInputCostUsd: 0,
  totalCostUsd: 0,
  totalCalls: 0,
};

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

function buildChartState(
  points: AdminUsagePoint[],
  metricKind: AdminUsageMetricKind,
  dimension: AdminUsageDimension,
  interval: AdminUsageInterval,
): ChartState {
  const topGroups = topUsageGroups(points, metricKind, dimension);
  const groupIdByKey = new Map(topGroups.map((group, index) => [
    group.key,
    `series${index + 1}`,
  ]));
  const series = topGroups.map((group, index) => ({
    color: USAGE_CHART_COLORS[index % USAGE_CHART_COLORS.length],
    id: groupIdByKey.get(group.key) ?? `series${index + 1}`,
    key: group.key,
    label: group.label,
  }));
  const config = Object.fromEntries(
    series.map((item) => [item.id, {
      color: item.color,
      label: item.label,
    }]),
  );
  const buckets = buildUsageBuckets(points);
  const data = buckets.map((bucket) => {
    const row: Record<string, number | string> = {
      bucket: bucket.bucket,
      label: formatUsageBucket(bucket.bucket, interval),
    };
    for (const item of series) row[item.id] = 0;
    for (const point of bucket.points) {
      const seriesId = groupIdByKey.get(point.groupKey);
      if (!seriesId) continue;
      row[seriesId] = Number(row[seriesId] ?? 0) +
        getUsageTotalValue(point, metricKind, dimension);
    }
    return row;
  });

  return {
    config,
    data,
    series,
  };
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
    .sort((a, b) =>
      new Date(a.bucket).getTime() - new Date(b.bucket).getTime()
    );
}

function aggregateUsageRows(
  points: AdminUsagePoint[],
  metricKind: AdminUsageMetricKind,
  dimension: AdminUsageDimension,
): AggregatedUsageRow[] {
  const totals = new Map<string, AggregatedUsageRow>();
  for (const point of points) {
    const existing = totals.get(point.groupKey) ?? {
      ...EMPTY_TOTALS,
      groupKey: point.groupKey,
      groupLabel: point.groupLabel,
      value: 0,
    };
    addUsageTotals(existing, point);
    existing.value = getUsageTotalValue(existing, metricKind, dimension);
    totals.set(point.groupKey, existing);
  }
  return Array.from(totals.values())
    .sort((a, b) => b.value - a.value);
}

function addUsageTotals(target: AdminUsageTotals, source: AdminUsageTotals) {
  target.inputTokens += source.inputTokens;
  target.outputTokens += source.outputTokens;
  target.reasoningTokens += source.reasoningTokens;
  target.cacheReadInputTokens += source.cacheReadInputTokens;
  target.cacheCreationInputTokens += source.cacheCreationInputTokens;
  target.totalTokens += source.totalTokens;
  target.inputCostUsd += source.inputCostUsd;
  target.outputCostUsd += source.outputCostUsd;
  target.reasoningCostUsd += source.reasoningCostUsd;
  target.cacheReadInputCostUsd += source.cacheReadInputCostUsd;
  target.cacheCreationInputCostUsd += source.cacheCreationInputCostUsd;
  target.totalCostUsd += source.totalCostUsd;
  target.totalCalls += source.totalCalls;
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
    existing.value += getUsageTotalValue(point, metricKind, dimension);
    totals.set(point.groupKey, existing);
  }
  return Array.from(totals.values())
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);
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

function emptyToUndefined(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
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

function getGroupByLabel(groupBy: AdminUsageGroupBy) {
  switch (groupBy) {
    case "thread":
      return "Thread";
    case "namespace":
      return "Namespace";
    case "provider":
      return "Provider";
    case "model":
      return "Model";
    case "participant":
    default:
      return "Participant";
  }
}

function getUsageTotalValue(
  totals: AdminUsageTotals,
  metricKind: AdminUsageMetricKind,
  dimension: AdminUsageDimension,
) {
  if (metricKind === "calls") return totals.totalCalls;
  if (metricKind === "cost") {
    switch (dimension) {
      case "input":
        return totals.inputCostUsd;
      case "output":
        return totals.outputCostUsd;
      case "reasoning":
        return totals.reasoningCostUsd;
      case "cacheRead":
        return totals.cacheReadInputCostUsd;
      case "cacheWrite":
        return totals.cacheCreationInputCostUsd;
      case "total":
      default:
        return totals.totalCostUsd;
    }
  }

  switch (dimension) {
    case "input":
      return totals.inputTokens;
    case "output":
      return totals.outputTokens;
    case "reasoning":
      return totals.reasoningTokens;
    case "cacheRead":
      return totals.cacheReadInputTokens;
    case "cacheWrite":
      return totals.cacheCreationInputTokens;
    case "total":
    default:
      return totals.totalTokens;
  }
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

function formatUsageRangeLabel(
  period: AdminDatePreset | "custom",
  range: { from?: string; to?: string },
) {
  if (period !== "custom") return period;
  if (!range.from && !range.to) return "Custom";
  return `${formatShortDate(range.from)} - ${formatShortDate(range.to)}`;
}

function formatShortDate(value?: string) {
  if (!value) return "Open";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function formatNumber(value: number) {
  return new Intl.NumberFormat().format(value);
}

function formatPercent(value: number) {
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 1,
    style: "percent",
  }).format(value);
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

function formatCompactMetric(value: number, metricKind: AdminUsageMetricKind) {
  if (metricKind === "cost") {
    return new Intl.NumberFormat(undefined, {
      compactDisplay: "short",
      currency: "USD",
      maximumFractionDigits: 1,
      notation: "compact",
      style: "currency",
    }).format(value);
  }
  return new Intl.NumberFormat(undefined, {
    compactDisplay: "short",
    maximumFractionDigits: 1,
    notation: "compact",
  }).format(value);
}
