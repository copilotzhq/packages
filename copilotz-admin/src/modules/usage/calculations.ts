import type { AdminUsageMetricKind } from "../../api/types";

/** Shared display formatting used by overview, participant, and thread views. */
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
  metricKind: AdminUsageMetricKind
) {
  if (metricKind === "cost") {
    const absoluteValue = Math.abs(value);
    const maximumFractionDigits =
      absoluteValue >= 1 ? 2 : absoluteValue >= 0.01 ? 4 : 6;
    return new Intl.NumberFormat(undefined, {
      currency: "USD",
      maximumFractionDigits,
      minimumFractionDigits: 2,
      style: "currency",
    }).format(value);
  }
  if (metricKind === "duration") return formatDuration(value);
  return formatNumber(value);
}

export function formatCompactMetric(
  value: number,
  metricKind: AdminUsageMetricKind
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
  if (metricKind === "duration") {
    if (value >= 3_600_000) return `${(value / 3_600_000).toFixed(1)}h`;
    if (value >= 60_000) return `${(value / 60_000).toFixed(1)}m`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(1)}s`;
    return `${Math.round(value)}ms`;
  }
  return new Intl.NumberFormat(undefined, {
    compactDisplay: "short",
    maximumFractionDigits: 1,
    notation: "compact",
  }).format(value);
}

function formatDuration(value: number) {
  if (value >= 3_600_000) {
    return `${new Intl.NumberFormat(undefined, {
      maximumFractionDigits: 1,
    }).format(value / 3_600_000)} h`;
  }
  if (value >= 60_000) {
    return `${new Intl.NumberFormat(undefined, {
      maximumFractionDigits: 1,
    }).format(value / 60_000)} min`;
  }
  if (value >= 1_000) {
    return `${new Intl.NumberFormat(undefined, {
      maximumFractionDigits: 1,
    }).format(value / 1_000)} sec`;
  }
  return `${formatNumber(Math.round(value))} ms`;
}
