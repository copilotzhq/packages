import React from "react";
import { Activity, Search } from "lucide-react";
import type { AdminQueueEvent } from "../../api/types";
import type { AdminModule, AdminRuntimeContext } from "../../core/types";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import {
  EmptyState,
  FilterBar,
  JsonPanel,
  PageHeader,
  ResourceTable,
  StatusBadge,
} from "../../components/patterns";

export function eventsModule(): AdminModule {
  return {
    group: "operate",
    icon: Activity,
    id: "events",
    label: "Events",
    navItems: [{
      group: "operate",
      icon: Activity,
      id: "events",
      label: "Events",
      order: 30,
      routeId: "events",
    }],
    routes: [{
      id: "events",
      title: "Events",
      render: (context) => <EventsPage context={context} />,
    }],
  };
}

const EVENT_STATUSES = [
  "all",
  "pending",
  "processing",
  "completed",
  "failed",
  "expired",
  "overwritten",
] as const;

function EventsPage({ context }: { context: AdminRuntimeContext }) {
  const [threadId, setThreadId] = React.useState("");
  const [status, setStatus] = React.useState<typeof EVENT_STATUSES[number]>(
    "all",
  );
  const [eventType, setEventType] = React.useState("");
  const [traceId, setTraceId] = React.useState("");
  const [events, setEvents] = React.useState<AdminQueueEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = React.useState<
    AdminQueueEvent | null
  >(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [hasLoaded, setHasLoaded] = React.useState(false);

  const inspect = async () => {
    setHasLoaded(true);
    setLoading(true);
    setError(null);
    try {
      const next = await context.client.listEvents({
        namespace: context.scope.namespace || undefined,
        threadId: threadId.trim() || undefined,
        status: status === "all" ? undefined : status,
        eventType: eventType.trim() || undefined,
        traceId: traceId.trim() || undefined,
        limit: 50,
      });
      setEvents(next);
      setSelectedEvent((current) =>
        current && next.some((event) => event.id === current.id)
          ? current
          : next[0] ?? null
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to load event");
      setEvents([]);
      setSelectedEvent(null);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    void inspect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context.client, context.refreshKey, context.scope.namespace]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Events"
        description="Queue and event inspection across the active namespace."
      />
      <FilterBar
        actions={
          <Button
            disabled={loading}
            onClick={() => void inspect()}
            size="sm"
            type="button"
          >
            <Search className="size-3" />
            {loading ? "Loading" : "Inspect"}
          </Button>
        }
      >
        <Input
          className="h-8 w-[220px]"
          onChange={(event) => setThreadId(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") void inspect();
          }}
          placeholder="Thread ID"
          value={threadId}
        />
        <Select
          value={status}
          onValueChange={(value) =>
            setStatus(value as typeof EVENT_STATUSES[number])}
        >
          <SelectTrigger className="h-8 w-[150px] text-xs" aria-label="Status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {EVENT_STATUSES.map((option) => (
              <SelectItem key={option} value={option}>
                {option === "all" ? "All statuses" : option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          className="h-8 w-[180px]"
          onChange={(event) => setEventType(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") void inspect();
          }}
          placeholder="Event type"
          value={eventType}
        />
        <Input
          className="h-8 w-[180px]"
          onChange={(event) => setTraceId(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") void inspect();
          }}
          placeholder="Trace ID"
          value={traceId}
        />
      </FilterBar>
      {error ? (
        <EmptyState title="Unable to inspect event" description={error} />
      ) : !hasLoaded && loading ? (
        <EmptyState
          icon={Activity}
          title="Loading events"
          description="Fetching recent queue events for the active namespace."
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-[1fr_420px]">
          <ResourceTable
            rows={events}
            getRowKey={(row) => row.id}
            onRowClick={(event: AdminQueueEvent) => setSelectedEvent(event)}
            empty={
              <EmptyState
                title="No matching events"
                description="No event rows matched the current filters."
              />
            }
            columns={[
              {
                id: "thread",
                header: "Thread",
                className: "max-w-[180px] truncate font-mono text-xs",
                render: (row) => row.threadId,
              },
              {
                id: "type",
                header: "Type",
                render: (row) => row.eventType,
              },
              {
                id: "status",
                header: "Status",
                render: (row) => <StatusBadge status={row.status} />,
              },
              {
                id: "trace",
                header: "Trace",
                render: (row) => row.traceId ?? "-",
              },
              {
                id: "created",
                header: "Created",
                render: (row) => formatDateTime(row.createdAt),
              },
            ]}
          />
          {selectedEvent ? (
            <JsonPanel
              title="Event JSON"
              value={selectedEvent}
              minHeight={420}
            />
          ) : (
            <EmptyState
              title="No event selected"
              description="Select an event row to inspect its payload."
            />
          )}
        </div>
      )}
    </div>
  );
}

function formatDateTime(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, {
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    month: "short",
  });
}
