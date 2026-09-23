import { Children, type ReactNode } from "react";
import { Loader2, MoreHorizontal, Plus, RotateCw, Search } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";

export interface SpaceResourceToolbarProps {
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  searchLabel?: string;
  onCreate?: () => void;
  createLabel?: string;
  onRefresh?: () => void;
  refreshLabel?: string;
  onOptions?: () => void;
  optionsLabel?: string;
  /** Optional resource-specific menu, such as a DropdownMenu with filters. */
  options?: ReactNode;
}

function ToolbarIconButton({
  label,
  children,
  onClick,
}: {
  label: string;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-9 w-9 shrink-0"
          aria-label={label}
          onClick={onClick}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

/** A controlled, stateless toolbar for Space resource collections. */
export function SpaceResourceToolbar({
  searchValue = "",
  onSearchChange,
  searchPlaceholder = "Search",
  searchLabel = "Search resources",
  onCreate,
  createLabel = "Create",
  onRefresh,
  refreshLabel = "Refresh",
  onOptions,
  optionsLabel = "More options",
  options,
}: SpaceResourceToolbarProps) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      {onSearchChange && (
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchLabel}
            className="pl-9"
          />
        </div>
      )}
      {onCreate && (
        <ToolbarIconButton label={createLabel} onClick={onCreate}>
          <Plus className="h-4 w-4" aria-hidden="true" />
        </ToolbarIconButton>
      )}
      {onRefresh && (
        <ToolbarIconButton label={refreshLabel} onClick={onRefresh}>
          <RotateCw className="h-4 w-4" aria-hidden="true" />
        </ToolbarIconButton>
      )}
      {options}
      {!options && onOptions && (
        <ToolbarIconButton label={optionsLabel} onClick={onOptions}>
          <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
        </ToolbarIconButton>
      )}
    </div>
  );
}

export interface SpaceResourceListProps {
  loading?: boolean;
  loadingLabel?: string;
  error?: ReactNode;
  empty?: boolean;
  emptyMessage?: ReactNode;
  className?: string;
  children?: ReactNode;
}

/** State wrapper for resource rows; the host owns the data and the state. */
export function SpaceResourceList({
  loading = false,
  loadingLabel = "Loading…",
  error,
  empty = false,
  emptyMessage = "Nothing here yet.",
  className = "",
  children,
}: SpaceResourceListProps) {
  return (
    <div className={className}>
      {loading && (
        <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground" role="status">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          {loadingLabel}
        </div>
      )}
      {error && <div className="py-4 text-sm text-destructive" role="alert">{error}</div>}
      {empty && !loading && (
        <p className="py-4 text-sm text-muted-foreground" role="status">{emptyMessage}</p>
      )}
      {!empty && Children.count(children) > 0 && (
        <div className="space-y-2" role="list">{children}</div>
      )}
    </div>
  );
}

export interface SpaceResourceRowProps {
  title: ReactNode;
  subtitle?: ReactNode;
  rightLabel?: ReactNode;
  onOpen?: () => void;
  openLabel?: string;
  actions?: ReactNode;
  className?: string;
}

/** A compact resource row with its open target and action controls as siblings. */
export function SpaceResourceRow({
  title,
  subtitle,
  rightLabel,
  onOpen,
  openLabel = "Open",
  actions,
  className = "",
}: SpaceResourceRowProps) {
  const content = (
    <>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{title}</span>
        {subtitle && <span className="block truncate text-xs text-muted-foreground">{subtitle}</span>}
      </span>
      {rightLabel && <span className="shrink-0 text-xs text-muted-foreground">{rightLabel}</span>}
    </>
  );

  return (
    <div className={`flex min-w-0 items-center gap-2 rounded-md border px-3 py-2 ${className}`} role="listitem">
      {onOpen ? (
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-3 rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={onOpen}
        >
          <span className="sr-only">{openLabel}: </span>
          {content}
        </button>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-3">{content}</div>
      )}
      {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
    </div>
  );
}
