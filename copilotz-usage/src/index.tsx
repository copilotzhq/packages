import React from "react";
import type {
  UsageDataSource,
  UsageFilters,
  UsageInterval,
} from "@copilotz/copilotz/usage/client";
import { UsageSummary } from "./components/UsageSummary";
import { UsageTimeline } from "./components/UsageTimeline";
import { UsageBreakdown } from "./components/UsageBreakdown";
import { UsageAttempts } from "./components/UsageAttempts";
import { useAnalytics } from "./data/useAnalytics";
import {
  emptyFields,
  type FilterFields,
  makeFilters,
  type Period,
  selectRange,
  validateInterval,
} from "./data/selection";
import { number } from "./formatting";
import "./styles.css";
export { UsageSummary } from "./components/UsageSummary";
export type {
  UsageDataSource,
  UsageFilters,
  UsageMetrics,
} from "@copilotz/copilotz/usage/client";
export interface UsageAnalyticsProps {
  source: UsageDataSource;
  initialFilters?: Partial<UsageFilters>;
  onOpenThread?: (threadId: string) => void;
  refreshKey?: string | number;
}
const labels: Record<keyof FilterFields, string> = {
  provider: "Provider",
  model: "Model",
  connection: "Connection",
  resource: "Tool",
  agentId: "Agent",
  threadId: "Thread",
  status: "Outcome",
};
export function UsageAnalytics(
  { source, initialFilters, onOpenThread, refreshKey }: UsageAnalyticsProps,
) {
  const [kind, setKind] = React.useState<"llm" | "tool">(
    initialFilters?.kind ?? "llm",
  );
  const [period, setPeriod] = React.useState<Period>(
    initialFilters?.from || initialFilters?.to ? "custom" : "7d",
  );
  const [from, setFrom] = React.useState(
    initialFilters?.from?.slice(0, 16) ?? "",
  );
  const [to, setTo] = React.useState(initialFilters?.to?.slice(0, 16) ?? "");
  const [fields, setFields] = React.useState<FilterFields>({
    ...emptyFields,
    ...Object.fromEntries(
      Object.keys(emptyFields).map(
        (key) => [key, initialFilters?.[key as keyof UsageFilters] ?? ""],
      ),
    ),
  });
  const [interval, setInterval] = React.useState<UsageInterval>("day");
  const [refresh, setRefresh] = React.useState(0);
  // Freeze preset boundaries for a selection. Rendering and request completion
  // must never move the window and trigger another request.
  const range = React.useMemo(() => {
    try {
      return { value: selectRange(period, from, to, Date.now()), error: null };
    } catch (cause) {
      return { value: null, error: (cause as Error).message };
    }
  }, [period, from, to, refresh, refreshKey]);
  const selected = React.useMemo(() => {
    try {
      if (!range.value) return { filters: null, error: range.error };
      const filters = makeFilters(kind, range.value, fields);
      validateInterval(filters, interval);
      return { filters, error: null };
    } catch (cause) {
      return { filters: null, error: (cause as Error).message };
    }
  }, [kind, range, fields, interval]);
  const { data, loading, error } = useAnalytics(
    source,
    selected.filters,
    interval,
    refreshKey,
  );
  const shown = data?.filters.kind === kind ? data : null;
  const stale = shown &&
    (JSON.stringify(shown.filters) !== JSON.stringify(selected.filters) ||
      shown.interval !== interval);
  function field(key: keyof FilterFields, value: string) {
    setFields((old) => ({ ...old, [key]: value }));
  }
  const input = (key: keyof FilterFields) => (
    <label key={key}>
      <span>{labels[key]}</span>
      <input
        value={fields[key]}
        placeholder={key === "provider"
          ? "All providers"
          : key === "model"
          ? "All models"
          : `All ${labels[key].toLowerCase()}s`}
        onChange={(event) => field(key, event.target.value)}
      />
    </label>
  );
  const chipFields = Object.entries(fields).filter(([key, value]) =>
    value &&
    (kind === "llm"
      ? key !== "resource"
      : !["provider", "model", "connection"].includes(key))
  );
  return (
    <section className="copilotz-usage" aria-busy={loading}>
      <header className="cu-heading">
        <div>
          <div className="cu-eyebrow">OBSERVE / USAGE</div>
          <h2>Understand your usage</h2>
          <p>Consumption, cache reuse, and execution outcomes.</p>
        </div>
        <button
          className="cu-button"
          disabled={loading}
          onClick={() => setRefresh((value) => value + 1)}
        >
          {loading ? "Updating…" : "↻ Refresh"}
        </button>
      </header>
      <div className="cu-toolbar">
        <div className="cu-tabs" role="group" aria-label="Usage type">
          <button aria-pressed={kind === "llm"} onClick={() => setKind("llm")}>
            LLM
          </button>
          <button
            aria-pressed={kind === "tool"}
            onClick={() => setKind("tool")}
          >
            Tools
          </button>
        </div>
        <div className="cu-period">
          <label>
            <span>Range</span>
            <select
              aria-label="Range"
              value={period}
              onChange={(event) => {
                const value = event.target.value as Period;
                if (value === "custom" && !from && range.value) {
                  setFrom(range.value.from.slice(0, 16));
                  setTo(range.value.to.slice(0, 16));
                }
                setPeriod(value);
                if (value === "24h") setInterval("hour");
                else if (value !== "custom") setInterval("day");
              }}
            >
              <option value="24h">Last 24 hours</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="custom">Custom range</option>
            </select>
          </label>
          <label>
            <span>Buckets · UTC</span>
            <select
              aria-label="Buckets"
              value={interval}
              onChange={(event) =>
                setInterval(event.target.value as UsageInterval)}
            >
              <option value="hour">Hourly</option>
              <option value="day">Daily</option>
              <option value="week">Weekly</option>
            </select>
          </label>
        </div>
      </div>
      <div className="cu-filters">
        {period === "custom" && (
          <>
            <label>
              <span>From · UTC</span>
              <input
                aria-label="From UTC"
                type="datetime-local"
                value={from}
                onChange={(event) => setFrom(event.target.value)}
              />
            </label>
            <label>
              <span>To · UTC</span>
              <input
                aria-label="To UTC"
                type="datetime-local"
                value={to}
                onChange={(event) => setTo(event.target.value)}
              />
            </label>
          </>
        )}
        {kind === "llm"
          ? <>{input("provider")}{input("model")}</>
          : input("resource")}
        <details className="cu-more">
          <summary>More filters</summary>
          <div>
            {(kind === "llm"
              ? ["connection", "agentId", "threadId"]
              : ["agentId", "threadId"] as (keyof FilterFields)[]).map((key) =>
                input(key as keyof FilterFields)
              )}
            <label>
              <span>Outcome</span>
              <select
                value={fields.status}
                onChange={(event) => field("status", event.target.value)}
              >
                <option value="">All outcomes</option>
                {[
                  "completed",
                  "failed",
                  "cancelled",
                  ...(kind === "tool" ? ["deferred"] : []),
                ].map((status) => <option key={status}>{status}</option>)}
              </select>
            </label>
          </div>
        </details>
      </div>
      {chipFields.length > 0 && (
        <div className="cu-chips">
          {chipFields.map(([key, value]) => (
            <button
              key={key}
              onClick={() => field(key as keyof FilterFields, "")}
              aria-label={`Remove ${labels[key as keyof FilterFields]} filter`}
            >
              {labels[key as keyof FilterFields]}: {value} ×
            </button>
          ))}
          <button onClick={() => setFields({ ...emptyFields })}>
            Clear filters
          </button>
        </div>
      )}
      {selected.error && (
        <div className="cu-error" role="alert">{selected.error}</div>
      )}
      {error && (
        <div className="cu-error" role="alert">
          {error}{" "}
          <button
            className="cu-button"
            onClick={() => setRefresh((value) => value + 1)}
          >
            Retry
          </button>
        </div>
      )}
      {!selected.error && !shown && !error && (
        <div className="cu-empty" role="status">
          Loading {kind === "llm" ? "LLM usage" : "tool executions"}…
        </div>
      )}
      {shown && !selected.error && (
        <div className={stale ? "cu-results cu-stale" : "cu-results"}>
          {(stale || loading) && (
            <p className="cu-updating" role="status">
              Updating selection. The previous result is shown below.
            </p>
          )}
          <UsageSummary metrics={shown.summary} kind={kind} />
          <div className="cu-context">
            {number(shown.summary.attempts)}{" "}
            {kind === "llm" ? "provider attempts" : "executions"} ·{" "}
            {number(shown.summary.failed)} failed ·{" "}
            {number(shown.summary.cancelled)}{" "}
            cancelled{kind === "llm" && (
              <>· Cache reuse is weighted by measured input tokens</>
            )}
          </div>
          {shown.summary.attempts === 0
            ? (
              <div className="cu-panel cu-empty">
                No usage matches this selection. Try a wider range or clear a
                filter.
              </div>
            )
            : (
              <>
                <UsageTimeline data={shown} />
                <UsageBreakdown
                  data={shown}
                  onSelect={(dimensions) =>
                    setFields((old) => ({
                      ...old,
                      ...Object.fromEntries(
                        Object.entries(dimensions).filter(([, value]) =>
                          value !== null
                        ),
                      ),
                    }))}
                />
              </>
            )}
          {!stale && selected.filters && (
            <UsageAttempts
              source={source}
              filters={selected.filters}
              onOpenThread={onOpenThread}
              refreshKey={`${refresh}:${refreshKey}`}
            />
          )}
        </div>
      )}
    </section>
  );
}
