import type {
  AdminUsageDimension,
  AdminUsageInterval,
  AdminUsageMetricKind,
  AdminUsagePoint,
  AdminUsageTotals,
} from "../../api/types";
import type {
  AggregatedUsageRow,
  UsageChartState,
} from "./types";

export const EMPTY_USAGE_TOTALS: AdminUsageTotals = {
  cacheCreationInputCostUsd: 0,
  cacheCreationInputTokens: 0,
  cacheReadInputCostUsd: 0,
  cacheReadInputTokens: 0,
  inputCostUsd: 0,
  inputTokens: 0,
  outputCostUsd: 0,
  outputTokens: 0,
  reasoningCostUsd: 0,
  reasoningTokens: 0,
  totalCalls: 0,
  totalCostUsd: 0,
  totalTokens: 0,
};

const USAGE_CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2, 142 76% 36%))",
  "hsl(var(--chart-3, 38 92% 50%))",
  "hsl(var(--chart-4, 199 89% 48%))",
  "hsl(var(--chart-5, 346 77% 49%))",
  "hsl(var(--muted-foreground))",
];

export function addUsageTotals(
  target: AdminUsageTotals,
  source: AdminUsageTotals,
) {
  target.cacheCreationInputCostUsd += source.cacheCreationInputCostUsd;
  target.cacheCreationInputTokens += source.cacheCreationInputTokens;
  target.cacheReadInputCostUsd += source.cacheReadInputCostUsd;
  target.cacheReadInputTokens += source.cacheReadInputTokens;
  target.inputCostUsd += source.inputCostUsd;
  target.inputTokens += source.inputTokens;
  target.outputCostUsd += source.outputCostUsd;
  target.outputTokens += source.outputTokens;
  target.reasoningCostUsd += source.reasoningCostUsd;
  target.reasoningTokens += source.reasoningTokens;
  target.totalCalls += source.totalCalls;
  target.totalCostUsd += source.totalCostUsd;
  target.totalTokens += source.totalTokens;
}

export function getUsageTotalValue(
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

export function aggregateUsageRows(
  points: AdminUsagePoint[],
  metricKind: AdminUsageMetricKind,
  dimension: AdminUsageDimension,
): AggregatedUsageRow[] {
  const totals = new Map<string, AggregatedUsageRow>();
  for (const point of points) {
    const row = totals.get(point.groupKey) ?? {
      ...EMPTY_USAGE_TOTALS,
      groupKey: point.groupKey,
      groupLabel: point.groupLabel,
      value: 0,
    };
    addUsageTotals(row, point);
    row.value = getUsageTotalValue(row, metricKind, dimension);
    totals.set(point.groupKey, row);
  }
  return Array.from(totals.values()).sort((a, b) => b.value - a.value);
}

export function buildUsageChartState(
  points: AdminUsagePoint[],
  metricKind: AdminUsageMetricKind,
  dimension: AdminUsageDimension,
  interval: AdminUsageInterval,
): UsageChartState {
  const topGroups = topUsageGroups(points, metricKind, dimension);
  const groupIdByKey = new Map(
    topGroups.map((group, index) => [group.key, `series${index + 1}`]),
  );
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
  return { config, data, series };
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

export function getUsageRange(
  period: "24h" | "7d" | "30d" | "custom",
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

export function getUsageDimensionLabel(dimension: AdminUsageDimension) {
  switch (dimension) {
    case "input":
      return "Input";
    case "output":
      return "Output";
    case "reasoning":
      return "Reasoning";
    case "cacheRead":
      return "Cache read";
    case "cacheWrite":
      return "Cache write";
    case "total":
    default:
      return "Total";
  }
}

export function getUsageGroupLabel(groupBy: string) {
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

export function formatUsageBucket(bucket: string, interval: AdminUsageInterval) {
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

export function formatNumber(value: number) {
  return new Intl.NumberFormat().format(value);
}

export function formatPercent(value: number) {
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 1,
    style: "percent",
  }).format(value);
}

export function formatMetricValue(
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
      currency: "USD",
      maximumFractionDigits,
      minimumFractionDigits: 2,
      style: "currency",
    }).format(value);
  }
  return formatNumber(value);
}

export function formatCompactMetric(
  value: number,
  metricKind: AdminUsageMetricKind,
) {
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
