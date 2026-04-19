import React, { useCallback, useState } from "react";
import { Activity, Loader2, Search } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { fetchThreadEvents } from "../../adminService";
import type { AdminQueueEvent, ResolvedAdminConfig } from "../../types";

interface EventsViewProps {
  config: ResolvedAdminConfig;
}

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "outline",
  processing: "default",
  completed: "secondary",
  failed: "destructive",
  expired: "secondary",
  overwritten: "secondary",
};

export const EventsView: React.FC<EventsViewProps> = ({ config }) => {
  const [threadId, setThreadId] = useState("");
  const [event, setEvent] = useState<AdminQueueEvent | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOptions = {
    baseUrl: config.baseUrl,
    getRequestHeaders: config.getRequestHeaders,
  };

  const handleSearch = useCallback(async () => {
    if (!threadId.trim()) return;
    setIsLoading(true);
    setError(null);
    setHasSearched(true);
    try {
      const result = await fetchThreadEvents(threadId.trim(), fetchOptions);
      setEvent(result ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load events");
    } finally {
      setIsLoading(false);
    }
  }, [threadId, config.baseUrl, config.getRequestHeaders]);

  return (
    <div className="space-y-6">
      <div className="flex items-end gap-3 max-w-lg">
        <div className="flex-1">
          <label className="text-sm font-medium mb-1 block">Thread ID</label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Enter thread ID to inspect events..."
              value={threadId}
              onChange={(e) => setThreadId(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void handleSearch()}
            />
          </div>
        </div>
        <Button onClick={() => void handleSearch()} disabled={isLoading || !threadId.trim()}>
          {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Inspect
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {!hasSearched ? (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <Activity className="mx-auto h-8 w-8 text-muted-foreground/50" />
          <p className="mt-3 text-sm text-muted-foreground">
            Enter a thread ID to inspect its next pending queue event.
          </p>
        </div>
      ) : isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !event ? (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <Activity className="mx-auto h-8 w-8 text-muted-foreground/50" />
          <p className="mt-3 text-sm text-muted-foreground">
            No pending events found for this thread.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border bg-card p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-medium">{event.eventType}</p>
              <p className="text-xs text-muted-foreground font-mono mt-1">{event.id}</p>
            </div>
            <Badge variant={STATUS_VARIANTS[event.status] ?? "outline"}>
              {event.status}
            </Badge>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 text-sm">
            {event.traceId && (
              <div>
                <span className="text-muted-foreground">Trace:</span>{" "}
                <span className="font-mono text-xs">{event.traceId}</span>
              </div>
            )}
            {event.parentEventId && (
              <div>
                <span className="text-muted-foreground">Parent:</span>{" "}
                <span className="font-mono text-xs">{event.parentEventId}</span>
              </div>
            )}
            {event.priority != null && (
              <div>
                <span className="text-muted-foreground">Priority:</span> {event.priority}
              </div>
            )}
            {event.createdAt && (
              <div>
                <span className="text-muted-foreground">Created:</span> {formatTimestamp(event.createdAt)}
              </div>
            )}
          </div>

          {event.payload != null && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Payload</p>
              <pre className="rounded-md bg-muted p-3 text-xs overflow-auto max-h-60">
                {JSON.stringify(event.payload, null, 2)}
              </pre>
            </div>
          )}

          {event.metadata != null && Object.keys(event.metadata).length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Metadata</p>
              <pre className="rounded-md bg-muted p-3 text-xs overflow-auto max-h-40">
                {JSON.stringify(event.metadata, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

function formatTimestamp(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit", second: "2-digit",
  });
}
