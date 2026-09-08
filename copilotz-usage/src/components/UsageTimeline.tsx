import React from "react";
import type { UsageAnalytics } from "@copilotz/copilotz/usage/client";
import { compact, date, number } from "../formatting";
export function UsageTimeline({ data }: { data: UsageAnalytics }) {
  const llm = data.filters.kind === "llm";
  const series = llm
    ? [{ key: "inputTokens", label: "Input", color: "var(--cu-accent)" }, {
      key: "outputTokens",
      label: "Output",
      color: "var(--cu-secondary)",
    }] as const
    : [{ key: "attempts", label: "Executions", color: "var(--cu-accent)" }, {
      key: "failed",
      label: "Failed",
      color: "var(--cu-warning)",
    }] as const;
  const [focus, setFocus] = React.useState<number | null>(null);
  const values = data.series.flatMap((point) =>
    series.map((s) => point[s.key] ?? 0)
  );
  const max = Math.max(1, ...values);
  const width = 960, height = 230, left = 60, right = 24, top = 18, bottom = 40;
  const plotWidth = width - left - right, plotHeight = height - top - bottom;
  const start = Date.parse(data.filters.from),
    end = Date.parse(data.filters.to);
  const bucketTime = (bucket: string) => Math.max(start, Date.parse(bucket));
  const x = (bucket: string) =>
    left + ((bucketTime(bucket) - start) / (end - start)) * plotWidth;
  const y = (value: number) => top + plotHeight * (1 - value / max);
  const active = focus === null ? null : data.series[focus];
  return (
    <section className="cu-panel cu-timeline">
      <div className="cu-panel-heading">
        <div>
          <h3>{llm ? "Token consumption" : "Tool activity"}</h3>
          <p>{date(data.filters.from)} — {date(data.filters.to)} · UTC</p>
        </div>
        <div className="cu-legend">
          {series.map((s) => (
            <span key={s.key}>
              <i style={{ background: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`${
          llm ? "Input and output tokens" : "Tool executions and failures"
        } over time`}
      >
        {[0, .5, 1].map((t) => (
          <g key={t}>
            <line
              x1={left}
              x2={width - right}
              y1={y(max * t)}
              y2={y(max * t)}
              className="cu-gridline"
            />
            <text x={left - 10} y={y(max * t) + 4} textAnchor="end">
              {compact(max * t)}
            </text>
          </g>
        ))}
        {series.map((s) => {
          let connected = false;
          const path = data.series.map((point) => {
            const value = point[s.key];
            if (value === null) {
              connected = false;
              return "";
            }
            const command = connected ? "L" : "M";
            connected = true;
            return `${command}${x(point.bucket)},${y(value)}`;
          }).join(" ");
          return (
            <path
              key={s.key}
              d={path}
              fill="none"
              stroke={s.color}
              strokeWidth="2.5"
              strokeLinejoin="round"
            />
          );
        })}
        {data.series.map((point, i) => (
          <g
            key={point.bucket}
            tabIndex={0}
            role="button"
            aria-label={`${date(point.bucket)}: ${
              series.map((s) => `${s.label} ${number(point[s.key])}`).join(", ")
            }`}
            onFocus={() => setFocus(i)}
            onBlur={() => setFocus(null)}
            onMouseEnter={() => setFocus(i)}
            onMouseLeave={() => setFocus(null)}
          >
            {series.map((s) =>
              point[s.key] !== null && (
                <circle
                  key={s.key}
                  cx={x(point.bucket)}
                  cy={y(point[s.key]!)}
                  r={focus === i ? 5 : 3}
                  fill={s.color}
                />
              )
            )}
            <rect
              x={x(point.bucket) - 8}
              y={top}
              width="16"
              height={plotHeight}
              fill="transparent"
            />
          </g>
        ))}
        {[0, .5, 1].map((t) => (
          <text
            key={t}
            x={left + t * plotWidth}
            y={height - 10}
            textAnchor={t === 0 ? "start" : t === 1 ? "end" : "middle"}
          >
            {date(new Date(start + t * (end - start)).toISOString())}
          </text>
        ))}
      </svg>
      <div className="cu-chart-detail" aria-live="polite">
        {active
          ? `${date(active.bucket)} UTC · ${
            series.map((s) => `${s.label}: ${number(active[s.key])}`).join(
              " · ",
            )
          }`
          : "Hover or focus a point to inspect a bucket. Missing measurements are not plotted as zero."}
      </div>
    </section>
  );
}
