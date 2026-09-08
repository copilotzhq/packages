import React from "react";
import type {
  UsageAnalytics,
  UsageBreakdown as Row,
} from "@copilotz/copilotz/usage/client";
import { compact, duration, number, percent } from "../formatting";
type Sort =
  | "attempts"
  | "inputTokens"
  | "outputTokens"
  | "cachedInputTokens"
  | "cacheReuse"
  | "failed"
  | "completed"
  | "deferred"
  | "averageDurationMs";
export function UsageBreakdown(
  { data, onSelect }: {
    data: UsageAnalytics;
    onSelect: (dimensions: Record<string, string | null>) => void;
  },
) {
  const llm = data.filters.kind === "llm";
  const [sort, setSort] = React.useState<Sort>("attempts");
  const [descending, setDescending] = React.useState(true);
  const columns: {
    key: Sort;
    label: string;
    format: (value: number | null) => string;
  }[] = llm
    ? [
      { key: "attempts", label: "Attempts", format: number },
      { key: "inputTokens", label: "Input", format: compact },
      { key: "outputTokens", label: "Output", format: compact },
      { key: "cachedInputTokens", label: "Cached input", format: compact },
      { key: "cacheReuse", label: "Reuse", format: percent },
    ]
    : [
      { key: "attempts", label: "Executions", format: number },
      { key: "completed", label: "Completed", format: number },
      { key: "failed", label: "Failed", format: number },
      { key: "deferred", label: "Deferred", format: number },
      { key: "averageDurationMs", label: "Avg duration", format: duration },
    ];
  const effectiveSort = columns.some((c) => c.key === sort) ? sort : "attempts";
  const rows = [...data.breakdown].sort((a, b) => {
    const av = a[effectiveSort], bv = b[effectiveSort];
    if (av === null) return bv === null ? a.key.localeCompare(b.key) : 1;
    if (bv === null) return -1;
    return (descending ? bv - av : av - bv) || a.key.localeCompare(b.key);
  });
  const label = (row: Row) =>
    llm
      ? row.dimensions.model ?? "Model not reported"
      : row.dimensions.resource ?? "Tool not reported";
  return (
    <section className="cu-panel">
      <div className="cu-panel-heading">
        <div>
          <h3>{llm ? "Providers & models" : "Tools"}</h3>
          <p>Select a {llm ? "model" : "tool"} to narrow the view.</p>
        </div>
        <span className="cu-tag">{rows.length} {llm ? "groups" : "tools"}</span>
      </div>
      <div className="cu-table-scroll">
        <table className="cu-table">
          <thead>
            <tr>
              <th>{llm ? "Provider / model" : "Tool"}</th>
              {columns.map((c) => (
                <th
                  key={c.key}
                  aria-sort={effectiveSort === c.key
                    ? descending ? "descending" : "ascending"
                    : "none"}
                >
                  <button
                    onClick={() => {
                      setSort(c.key);
                      setDescending(
                        effectiveSort === c.key ? !descending : true,
                      );
                    }}
                  >
                    {c.label}
                    {effectiveSort === c.key ? descending ? " ↓" : " ↑" : ""}
                  </button>
                </th>
              ))}
              <th>{llm ? "Cache coverage" : "Timing coverage"}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                <td>
                  <button
                    className="cu-row-link"
                    onClick={() => onSelect(row.dimensions)}
                    disabled={Object.values(row.dimensions).every((v) =>
                      v === null
                    )}
                  >
                    {label(row)}
                  </button>
                  {llm && (
                    <small>
                      {row.dimensions.provider ?? "Provider not reported"}
                    </small>
                  )}
                </td>
                {columns.map((c) => (
                  <td key={c.key} title={number(row[c.key])}>
                    {c.format(row[c.key])}
                  </td>
                ))}
                <td>
                  {percent(
                    llm
                      ? row.cacheCoverage
                      : row.attempts
                      ? row.durationReported / row.attempts
                      : null,
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
