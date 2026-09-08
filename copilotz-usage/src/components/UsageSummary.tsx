import React from "react";
import type { UsageMetrics } from "@copilotz/copilotz/usage/client";
import { compact, duration, number, percent } from "../formatting";
export function UsageSummary(
  { metrics: m, kind = "llm" }: {
    metrics: UsageMetrics;
    kind?: "llm" | "tool";
  },
) {
  const cells = kind === "llm"
    ? [
      {
        label: "Input tokens",
        value: compact(m.inputTokens),
        detail: `${number(m.inputReported)} of ${
          number(m.attempts)
        } attempts reported input`,
      },
      {
        label: "Output tokens",
        value: compact(m.outputTokens),
        detail: `Includes provider-reported reasoning where applicable`,
      },
      {
        label: "Cached input",
        value: compact(m.cachedInputTokens),
        detail: `${compact(m.cacheCreationInputTokens)} cache-write tokens`,
      },
      {
        label: "Cache reuse",
        value: percent(m.cacheReuse),
        detail: `${
          percent(m.cacheCoverage)
        } of attempts have input + cache measurements`,
      },
    ]
    : [
      {
        label: "Tool executions",
        value: number(m.attempts),
        detail: "One record per actual Action execution",
      },
      {
        label: "Completed",
        value: number(m.completed),
        detail: `${number(m.failed)} failed · ${number(m.cancelled)} cancelled`,
      },
      {
        label: "Deferred",
        value: number(m.deferred),
        detail: "Accepted asks awaiting a later answer",
      },
      {
        label: "Average duration",
        value: duration(m.averageDurationMs),
        detail: `${number(m.durationReported)} of ${
          number(m.attempts)
        } executions have timing`,
      },
    ];
  return (
    <div className="copilotz-usage-summary cu-summary">
      {cells.map((cell) => (
        <article className="cu-stat" key={cell.label}>
          <div className="cu-label">{cell.label}</div>
          <strong>{cell.value}</strong>
          <p>{cell.detail}</p>
        </article>
      ))}
    </div>
  );
}
