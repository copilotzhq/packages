import React from "react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "../ui/card";

export interface MetricStripItem {
  label: string;
  value: React.ReactNode;
  detail?: React.ReactNode;
  icon?: LucideIcon;
}

export function MetricStrip({ items }: { items: MetricStripItem[] }) {
  return (
    <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Card className="rounded-lg py-3 shadow-xs" key={item.label}>
            <CardContent className="flex items-center justify-between gap-3 px-4">
              <div className="min-w-0">
                <p className="truncate text-xs text-muted-foreground">
                  {item.label}
                </p>
                <p className="mt-1 truncate text-xl font-semibold tracking-tight">
                  {item.value}
                </p>
                {item.detail && (
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {item.detail}
                  </p>
                )}
              </div>
              {Icon && (
                <div className="rounded-md border bg-muted/50 p-2 text-muted-foreground">
                  <Icon className="size-4" />
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
