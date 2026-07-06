import React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Activity, BarChart3, DollarSign, Sparkles } from "lucide-react";
import type {
  AdminUsageAttribution,
  AdminUsageDimension,
  AdminUsageGroupBy,
  AdminUsageInterval,
  AdminUsageMetricKind,
  AdminUsageResponse,
} from "../../api/types";
import type { AdminModule, AdminRuntimeContext } from "../../core/types";
import { Card, CardContent } from "../../components/ui/card";
import {
  ChartContainer,
  ChartLegendContent,
  ChartTooltipContent,
} from "../../components/ui/chart";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import { Input } from "../../components/ui/input";
import {
  EmptyState,
  FilterBar,
  MetricStrip,
  PageHeader,
  ResourceTable,
} from "../../components/patterns";
import {
  aggregateUsageRows,
  buildUsageChartState,
  EMPTY_USAGE_TOTALS,
  formatCompactMetric,
  formatMetricValue,
  formatPercent,
  getUsageDimensionLabel,
  getUsageGroupLabel,
  getUsageRange,
  getUsageTotalValue,
} from "./calculations";
import type { AggregatedUsageRow } from "./types";

const USAGE_DIMENSIONS: AdminUsageDimension[] = [
  "total",
  "input",
  "output",
  "reasoning",
  "cacheRead",
  "cacheWrite",
];

export function usageModule(): AdminModule {
  return {
    group: "operate",
    icon: BarChart3,
    id: "usage",
    label: "Usage",
    navItems: [{
      group: "operate",
      icon: BarChart3,
      id: "usage",
      label: "Usage",
      order: 20,
      routeId: "usage",
    }],
    routes: [{
      id: "usage",
      title: "Usage",
      render: (context) => <UsagePage context={context} />,
    }],
  };
}

function UsagePage({ context }: { context: AdminRuntimeContext }) {
  const [period, setPeriod] = React.useState<"24h" | "7d" | "30d" | "custom">(
    "7d",
  );
  const [interval, setInterval] = React.useState<AdminUsageInterval>("day");
  const [metricKind, setMetricKind] = React.useState<AdminUsageMetricKind>(
    "cost",
  );
  const [dimension, setDimension] = React.useState<AdminUsageDimension>("total");
  const [groupBy, setGroupBy] = React.useState<AdminUsageGroupBy>("participant");
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
  const [error, setError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  const range = React.useMemo(
    () => getUsageRange(period, customFrom, customTo),
    [customFrom, customTo, period],
  );

  React.useEffect(() => {
    let active = true;
    setIsLoading(true);
    setError(null);
    void context.client.getUsage({
      attribution,
      from: range.from,
      groupBy,
      interval,
      metric: metricKind,
      model: emptyToUndefined(model),
      namespace: context.scope.namespace || undefined,
      participantId: emptyToUndefined(participantId),
      participantType,
      provider: emptyToUndefined(provider),
      threadId: emptyToUndefined(threadId),
      to: range.to,
    }).then((next) => {
      if (active) setUsage(next);
    }).catch((cause) => {
      if (active) {
        setError(cause instanceof Error ? cause.message : "Failed to load usage");
        setUsage(null);
      }
    }).finally(() => {
      if (active) setIsLoading(false);
    });
    return () => {
      active = false;
    };
  }, [
    attribution,
    context.client,
    context.refreshKey,
    context.scope.namespace,
    groupBy,
    interval,
    metricKind,
    model,
    participantId,
    participantType,
    provider,
    range.from,
    range.to,
    threadId,
  ]);

  const points = usage?.points ?? [];
  const totals = usage?.totals ?? EMPTY_USAGE_TOTALS;
  const chartState = React.useMemo(
    () => buildUsageChartState(points, metricKind, dimension, interval),
    [dimension, interval, metricKind, points],
  );
  const rows = React.useMemo(
    () => aggregateUsageRows(points, metricKind, dimension),
    [dimension, metricKind, points],
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Usage"
        description="Inspect cost, token, and call attribution across namespaces, models, participants, threads, and providers."
        badges={[
          { label: period },
          { label: getUsageGroupLabel(groupBy), variant: "secondary" },
          ...(isLoading ? [{ label: "Loading" as const }] : []),
        ]}
      />
      <FilterBar>
        <UsageSelect
          label="Period"
          onValueChange={(value) => setPeriod(value as typeof period)}
          options={["24h", "7d", "30d", "custom"]}
          value={period}
        />
        <UsageSelect
          label="Bucket"
          onValueChange={(value) => setInterval(value as AdminUsageInterval)}
          options={["minute", "hour", "day", "week", "month"]}
          value={interval}
        />
        <UsageSelect
          label="Metric"
          onValueChange={(value) => setMetricKind(value as AdminUsageMetricKind)}
          options={["cost", "tokens", "calls"]}
          value={metricKind}
        />
        <UsageSelect
          label="Group"
          onValueChange={(value) => setGroupBy(value as AdminUsageGroupBy)}
          options={["participant", "thread", "namespace", "provider", "model"]}
          value={groupBy}
        />
        <UsageSelect
          label="Attribution"
          onValueChange={(value) =>
            setAttribution(value as AdminUsageAttribution)}
          options={["initiatedBy", "generatedBy"]}
          value={attribution}
        />
        <UsageSelect
          label="Dimension"
          onValueChange={(value) =>
            setDimension(value as AdminUsageDimension)}
          options={USAGE_DIMENSIONS}
          value={dimension}
          formatOption={getUsageDimensionLabel}
        />
      </FilterBar>
      <FilterBar>
        {period === "custom" && (
          <>
            <Input
              className="h-8 w-[190px]"
              onChange={(event) => setCustomFrom(event.target.value)}
              type="datetime-local"
              value={customFrom}
            />
            <Input
              className="h-8 w-[190px]"
              onChange={(event) => setCustomTo(event.target.value)}
              type="datetime-local"
              value={customTo}
            />
          </>
        )}
        <UsageSelect
          label="Type"
          onValueChange={(value) =>
            setParticipantType(value as typeof participantType)}
          options={["all", "human", "agent", "job"]}
          value={participantType}
        />
        <Input
          className="h-8 w-[170px]"
          onChange={(event) => setThreadId(event.target.value)}
          placeholder="Thread ID"
          value={threadId}
        />
        <Input
          className="h-8 w-[170px]"
          onChange={(event) => setParticipantId(event.target.value)}
          placeholder="Participant ID"
          value={participantId}
        />
        <Input
          className="h-8 w-[140px]"
          onChange={(event) => setProvider(event.target.value)}
          placeholder="Provider"
          value={provider}
        />
        <Input
          className="h-8 w-[140px]"
          onChange={(event) => setModel(event.target.value)}
          placeholder="Model"
          value={model}
        />
      </FilterBar>
      <MetricStrip
        items={[
          {
            detail: `${totals.totalCalls} calls`,
            icon: DollarSign,
            label: "Cost",
            value: formatMetricValue(totals.totalCostUsd, "cost"),
          },
          {
            detail: `${formatMetricValue(totals.inputTokens, "tokens")} input`,
            icon: Activity,
            label: "Tokens",
            value: formatMetricValue(totals.totalTokens, "tokens"),
          },
          {
            detail: `${formatMetricValue(totals.reasoningTokens, "tokens")} reasoning`,
            icon: Sparkles,
            label: "Calls",
            value: formatMetricValue(totals.totalCalls, "calls"),
          },
        ]}
      />
      {error ? (
        <EmptyState title="Unable to load usage" description={error} />
      ) : chartState.data.length === 0 ? (
        <EmptyState
          title="No usage"
          description="Usage records will appear here when provider-native usage is captured."
        />
      ) : (
        <>
          <Card className="h-[320px] py-3">
            <CardContent className="h-full px-3">
              <UsageChart chartState={chartState} metricKind={metricKind} />
            </CardContent>
          </Card>
          <UsageRowsTable
            dimension={dimension}
            groupBy={groupBy}
            metricKind={metricKind}
            rows={rows}
            totals={totals}
          />
        </>
      )}
    </div>
  );
}

function UsageSelect<T extends string>({
  formatOption,
  label,
  onValueChange,
  options,
  value,
}: {
  formatOption?: (value: T) => string;
  label: string;
  onValueChange: (value: string) => void;
  options: T[];
  value: T;
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="h-8 w-[132px] text-xs" aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option} value={option}>
            {formatOption ? formatOption(option) : option}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function UsageChart({
  chartState,
  metricKind,
}: {
  chartState: ReturnType<typeof buildUsageChartState>;
  metricKind: AdminUsageMetricKind;
}) {
  return (
    <ChartContainer className="h-full w-full" config={chartState.config}>
      <BarChart accessibilityLayer data={chartState.data} margin={{ left: 8, right: 8, top: 12 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={10} />
        <YAxis
          axisLine={false}
          tickFormatter={(value) => formatCompactMetric(Number(value), metricKind)}
          tickLine={false}
          width={64}
        />
        <RechartsTooltip
          content={
            <ChartTooltipContent
              formatter={(value) =>
                formatMetricValue(Number(value), metricKind)}
              labelFormatter={(value) => String(value ?? "")}
            />
          }
          cursor={false}
        />
        <Legend content={<ChartLegendContent className="justify-center pt-3" />} />
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

function UsageRowsTable({
  dimension,
  groupBy,
  metricKind,
  rows,
  totals,
}: {
  dimension: AdminUsageDimension;
  groupBy: AdminUsageGroupBy;
  metricKind: AdminUsageMetricKind;
  rows: AggregatedUsageRow[];
  totals: typeof EMPTY_USAGE_TOTALS;
}) {
  const totalValue = getUsageTotalValue(totals, metricKind, dimension);
  return (
    <ResourceTable
      rows={rows.slice(0, 80)}
      getRowKey={(row) => row.groupKey}
      columns={[
        {
          id: "group",
          header: getUsageGroupLabel(groupBy),
          render: (row) => (
            <div className="min-w-0">
              <div className="max-w-80 truncate font-medium">{row.groupLabel}</div>
              {row.groupKey !== row.groupLabel && (
                <div className="max-w-80 truncate text-xs text-muted-foreground">
                  {row.groupKey}
                </div>
              )}
            </div>
          ),
        },
        {
          align: "right",
          id: "value",
          header: `${getUsageDimensionLabel(dimension)} ${metricKind}`,
          render: (row) => formatMetricValue(row.value, metricKind),
        },
        {
          align: "right",
          id: "share",
          header: "Share",
          render: (row) => formatPercent(totalValue > 0 ? row.value / totalValue : 0),
        },
        {
          align: "right",
          id: "calls",
          header: "Calls",
          render: (row) => formatMetricValue(row.totalCalls, "calls"),
        },
        {
          align: "right",
          id: "input",
          header: "Input",
          render: (row) =>
            formatMetricValue(getUsageTotalValue(row, metricKind, "input"), metricKind),
        },
        {
          align: "right",
          id: "output",
          header: "Output",
          render: (row) =>
            formatMetricValue(getUsageTotalValue(row, metricKind, "output"), metricKind),
        },
      ]}
    />
  );
}

function emptyToUndefined(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
