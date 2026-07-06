import React from "react";
import { cn } from "../../lib/utils";

export function InspectorPanel({
  children,
  className,
  side,
}: {
  children: React.ReactNode;
  className?: string;
  side?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]",
        className,
      )}
    >
      <div className="min-w-0">{children}</div>
      {side && <aside className="min-w-0">{side}</aside>}
    </div>
  );
}
