import React from "react";
import type { LucideIcon } from "lucide-react";

export function EmptyState({
  action,
  description,
  icon: Icon,
  title,
}: {
  action?: React.ReactNode;
  description?: React.ReactNode;
  icon?: LucideIcon;
  title: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-dashed bg-background p-8 text-center">
      {Icon && (
        <Icon className="mx-auto mb-3 size-8 text-muted-foreground/60" />
      )}
      <h3 className="text-sm font-semibold">{title}</h3>
      {description && (
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
