import type {
  AdminUsageDimension,
  AdminUsageInterval,
  AdminUsageMetricKind,
  AdminUsagePoint,
  AdminUsageTotals,
} from "../../api/types";

export interface UsageChartSeries {
  color: string;
  id: string;
  key: string;
  label: string;
}

export interface UsageChartState {
  config: Record<string, { color: string; label: string }>;
  data: Array<Record<string, number | string>>;
  series: UsageChartSeries[];
}

export interface AggregatedUsageRow extends AdminUsageTotals {
  groupKey: string;
  groupLabel: string;
  value: number;
}

export interface UsageCalculationOptions {
  dimension: AdminUsageDimension;
  interval: AdminUsageInterval;
  metricKind: AdminUsageMetricKind;
  points: AdminUsagePoint[];
}
