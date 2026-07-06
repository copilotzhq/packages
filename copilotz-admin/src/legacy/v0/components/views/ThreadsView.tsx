import React from "react";
import { Search, MessageSquare } from "lucide-react";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import type { AdminThreadSummary, ResolvedAdminConfig } from "../../types";

interface ThreadsViewProps {
  config: ResolvedAdminConfig;
  threads: AdminThreadSummary[];
  searchValue: string;
  onSearchChange: (value: string) => void;
  onThreadClick?: (threadId: string) => void;
}

export const ThreadsView: React.FC<ThreadsViewProps> = ({
  config,
  threads,
  searchValue,
  onSearchChange,
  onThreadClick,
}) => {
  return (
    <div className="space-y-4">
      {/* Search bar */}
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder={config.labels.threadSearchPlaceholder}
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      {/* Thread list */}
      {threads.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <MessageSquare className="mx-auto h-8 w-8 text-muted-foreground/50" />
          <p className="mt-3 text-sm text-muted-foreground">
            {searchValue
              ? config.labels.noResults
              : config.labels.emptyDescription}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {threads.map((thread) => (
            <div
              key={thread.threadId}
              className="flex items-center gap-4 rounded-lg border bg-card p-4 transition-colors hover:bg-muted/50 cursor-pointer"
              onClick={() => onThreadClick?.(thread.threadId)}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium truncate">{thread.name}</p>
                  <Badge
                    variant={
                      thread.status === "archived" ? "secondary" : "default"
                    }
                    className="shrink-0"
                  >
                    {thread.status === "archived"
                      ? config.labels.statusArchived
                      : config.labels.statusActive}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground truncate">
                  {thread.summary ??
                    thread.lastMessagePreview ??
                    "No summary yet"}
                </p>
              </div>
              <div className="text-right text-xs text-muted-foreground shrink-0 space-y-1">
                <p>{formatNumber(thread.messageCount)} messages</p>
                <p>{thread.participantIds.length} participants</p>
                <p>{formatDate(thread.lastActivityAt)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

function formatDate(value: string | null) {
  if (!value) return "No activity";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatNumber(value: number) {
  return new Intl.NumberFormat().format(value);
}
