import React from "react";
import type {
  UsageAnalytics,
  UsageDataSource,
  UsageFilters,
  UsageInterval,
} from "@copilotz/copilotz/usage/client";
import { latestRequest } from "./latest";
export function useAnalytics(
  source: UsageDataSource,
  filters: UsageFilters | null,
  interval: UsageInterval,
  refreshKey: unknown,
) {
  const [data, setData] = React.useState<UsageAnalytics | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const pending = React.useRef(latestRequest());
  React.useEffect(() => {
    if (!filters) {
      pending.current.cancel();
      setLoading(false);
      return;
    }
    const request = pending.current.start();
    setLoading(true);
    setError(null);
    const groupBy = filters.kind === "llm"
      ? ["provider", "model"] as const
      : ["resource"] as const;
    void source.analytics({
      filters,
      interval,
      groupBy: [...groupBy],
      signal: request.signal,
    }).then((result) => {
      if (request.isCurrent()) setData(result);
    }).catch((cause) => {
      if (request.isCurrent()) {
        setError(
          cause instanceof Error ? cause.message : "Unable to load analytics.",
        );
      }
    }).finally(() => {
      if (request.isCurrent()) setLoading(false);
    });
    return () => pending.current.cancel();
  }, [source, filters, interval, refreshKey]);
  return { data, error, loading };
}
