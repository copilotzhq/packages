import * as React from "react";
import * as RechartsPrimitive from "recharts";

import { cn } from "../../lib/utils";

export type ChartConfig = Record<
  string,
  {
    label: string;
    color: string;
  }
>;

const ChartContext = React.createContext<ChartConfig | null>(null);

function useChart() {
  const context = React.useContext(ChartContext);
  if (!context) {
    throw new Error("useChart must be used within a ChartContainer");
  }
  return context;
}

function ChartContainer({
  id,
  className,
  config,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  config: ChartConfig;
  children: React.ComponentProps<
    typeof RechartsPrimitive.ResponsiveContainer
  >["children"];
}) {
  const uniqueId = React.useId();
  const chartId = `chart-${id ?? uniqueId.replace(/:/g, "")}`;

  return (
    <ChartContext.Provider value={config}>
      <div
        data-chart={chartId}
        className={cn(
          "flex aspect-auto justify-center text-xs text-muted-foreground [&_.recharts-cartesian-axis-tick_text]:fill-muted-foreground [&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border/70 [&_.recharts-cursor]:fill-muted [&_.recharts-legend-wrapper]:text-muted-foreground [&_.recharts-tooltip-cursor]:fill-muted",
          className,
        )}
        {...props}
      >
        <style>
          {Object.entries(config)
            .map(([key, item]) => {
              return `[data-chart=${chartId}] { --color-${key}: ${item.color}; }`;
            })
            .join("\n")}
        </style>
        <RechartsPrimitive.ResponsiveContainer>
          {children}
        </RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  );
}

function ChartTooltipContent({
  active,
  payload,
  label,
  className,
  formatter,
  labelFormatter,
}: {
  active?: boolean;
  payload?: Array<{
    color?: string;
    dataKey?: string | number;
    name?: string | number;
    value?: number | string;
  }>;
  label?: string | number;
  className?: string;
  formatter?: (value: number | string) => string;
  labelFormatter?: (value: string | number | undefined) => string;
}) {
  const config = useChart();
  if (!active || !payload?.length) return null;

  const total = payload.reduce((sum, item) => {
    const value = typeof item.value === "number"
      ? item.value
      : Number(item.value ?? 0);
    return sum + (Number.isFinite(value) ? value : 0);
  }, 0);

  return (
    <div
      className={cn(
        "min-w-44 rounded-lg border bg-popover px-3 py-2 text-popover-foreground shadow-md",
        className,
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-4 border-b pb-2">
        <p className="text-xs font-medium text-muted-foreground">
          {labelFormatter ? labelFormatter(label) : label}
        </p>
        <p className="text-xs font-semibold text-foreground">
          {formatter ? formatter(total) : total}
        </p>
      </div>
      <div className="space-y-1.5">
        {payload
          .filter((item) => Number(item.value ?? 0) > 0)
          .map((item) => {
            const key = String(item.dataKey ?? item.name ?? "");
            const itemConfig = config[key];
            const color = item.color ?? itemConfig?.color ?? "currentColor";
            return (
              <div
                className="grid grid-cols-[0.6rem_1fr_auto] items-center gap-2"
                key={key}
              >
                <span
                  className="size-2 rounded-[2px]"
                  style={{ backgroundColor: color }}
                />
                <span className="max-w-48 truncate text-muted-foreground">
                  {itemConfig?.label ?? item.name ?? key}
                </span>
                <span className="font-medium text-foreground">
                  {formatter ? formatter(item.value ?? 0) : item.value}
                </span>
              </div>
            );
          })}
      </div>
    </div>
  );
}

function ChartLegendContent({
  payload,
  className,
}: {
  payload?: Array<{
    color?: string;
    dataKey?: string | number;
    value?: string | number;
  }>;
  className?: string;
}) {
  const config = useChart();
  if (!payload?.length) return null;

  return (
    <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-2", className)}>
      {payload.map((item) => {
        const key = String(item.dataKey ?? item.value ?? "");
        const itemConfig = config[key];
        return (
          <div className="flex items-center gap-2" key={key}>
            <span
              className="size-2 rounded-[2px]"
              style={{
                backgroundColor: item.color ?? itemConfig?.color ??
                  "currentColor",
              }}
            />
            <span className="max-w-52 truncate text-xs text-muted-foreground">
              {itemConfig?.label ?? item.value ?? key}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export { ChartContainer, ChartLegendContent, ChartTooltipContent };
