import React from "react";
import { Search } from "lucide-react";
import { Input } from "../ui/input";

export function FilterBar({
  actions,
  children,
  onSearchChange,
  searchPlaceholder = "Search...",
  searchValue,
}: {
  actions?: React.ReactNode;
  children?: React.ReactNode;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  searchValue?: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex min-w-[260px] flex-1 flex-wrap items-center gap-2">
        {onSearchChange && (
          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-8 pl-9"
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder={searchPlaceholder}
              value={searchValue ?? ""}
            />
          </div>
        )}
        {children}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
