import React from "react";
import { Badge } from "../ui/badge";

export function PageHeader({
  actions,
  badges = [],
  description,
  title,
}: {
  actions?: React.ReactNode;
  badges?: Array<{ label: string; variant?: "default" | "secondary" | "outline" | "destructive" }>;
  description?: React.ReactNode;
  title: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="truncate text-xl font-semibold tracking-tight">
            {title}
          </h2>
          {badges.map((badge) => (
            <Badge key={badge.label} variant={badge.variant ?? "outline"}>
              {badge.label}
            </Badge>
          ))}
        </div>
        {description && (
          <div className="mt-1 max-w-3xl text-sm text-muted-foreground">
            {description}
          </div>
        )}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
