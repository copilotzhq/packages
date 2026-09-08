import type {
  UsageFilters,
  UsageInterval,
} from "@copilotz/copilotz/usage/client";
export type Period = "24h" | "7d" | "30d" | "custom";
export type FilterFields = Record<
  | "provider"
  | "model"
  | "connection"
  | "resource"
  | "agentId"
  | "threadId"
  | "status",
  string
>;
export const emptyFields: FilterFields = {
  provider: "",
  model: "",
  connection: "",
  resource: "",
  agentId: "",
  threadId: "",
  status: "",
};
export function selectRange(
  period: Period,
  from: string,
  to: string,
  now: number,
) {
  if (period !== "custom") {
    const hours = period === "24h" ? 24 : period === "7d" ? 168 : 720;
    return {
      from: new Date(now - hours * 3600000).toISOString(),
      to: new Date(now).toISOString(),
    };
  }
  const parse = (value: string) =>
    Date.parse(/(?:Z|[+-]\d\d:\d\d)$/.test(value) ? value : `${value}Z`);
  const start = parse(from), end = parse(to);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    throw new Error(
      "Choose an end time after the start time. Dates are in UTC.",
    );
  }
  if (end - start > 366 * 86400000) {
    throw new Error("Choose a range no longer than 366 days.");
  }
  return {
    from: new Date(start).toISOString(),
    to: new Date(end).toISOString(),
  };
}
export function makeFilters(
  kind: "llm" | "tool",
  range: { from: string; to: string },
  fields: FilterFields,
): UsageFilters {
  const relevant = Object.entries(fields).filter(([key, value]) =>
    value.trim() &&
    (kind === "llm"
      ? key !== "resource"
      : !["provider", "model", "connection"].includes(key))
  );
  return {
    kind,
    ...range,
    ...Object.fromEntries(relevant.map(([key, value]) => [key, value.trim()])),
  };
}
export function validateInterval(
  filters: UsageFilters,
  interval: UsageInterval,
) {
  if (
    interval === "hour" &&
    Date.parse(filters.to) - Date.parse(filters.from) > 31 * 86400000
  ) {
    throw new Error(
      "Use daily or weekly buckets for ranges longer than 31 days.",
    );
  }
}
