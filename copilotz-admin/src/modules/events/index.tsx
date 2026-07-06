import React from "react";
import { Activity, Search } from "lucide-react";
import type { AdminQueueEvent } from "../../api/types";
import type { AdminModule, AdminRuntimeContext } from "../../core/types";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
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

function EventsPage({ context }: { context: AdminRuntimeContext }) {
  const [threadId, setThreadId] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [type, setType] = React.useState("");
  const [traceId, setTraceId] = React.useState("");
  const [event, setEvent] = React.useState<AdminQueueEvent | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [hasSearched, setHasSearched] = React.useState(false);

  const inspect = async () => {
    if (!threadId.trim()) return;
    setHasSearched(true);
    setError(null);
    try {
      const next = await context.client.getThreadEvent(threadId.trim());
      setEvent(next ?? null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to load event");
      setEvent(null);
    }
  };

  const rows = event &&
      (!status || event.status.includes(status)) &&
      (!type || event.eventType.includes(type)) &&
      (!traceId || event.traceId?.includes(traceId))
    ? [event]
    : [];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Events"
        description="Queue and event inspection. Current backend support is thread-focused; filters are ready for broader event listing."
      />
      <FilterBar
        actions={
          <Button
            disabled={!threadId.trim()}
            onClick={() => void inspect()}
            size="sm"
            type="button"
          >
            <Search className="size-3" />
            Inspect
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
        <Input
          className="h-8 w-[150px]"
          onChange={(event) => setStatus(event.target.value)}
          placeholder="Status"
          value={status}
        />
        <Input
          className="h-8 w-[180px]"
          onChange={(event) => setType(event.target.value)}
          placeholder="Event type"
          value={type}
        />
        <Input
          className="h-8 w-[180px]"
          onChange={(event) => setTraceId(event.target.value)}
          placeholder="Trace ID"
          value={traceId}
        />
      </FilterBar>
      {error ? (
        <EmptyState title="Unable to inspect event" description={error} />
      ) : !hasSearched ? (
        <EmptyState
          icon={Activity}
          title="Choose a thread"
          description="Enter a thread ID to inspect its next pending event."
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-[1fr_420px]">
          <ResourceTable
            rows={rows}
            getRowKey={(row) => row.id}
            empty={
              <EmptyState
                title="No matching event"
                description="No pending event matched the current filters."
              />
            }
            columns={[
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
          <JsonPanel title="Event JSON" value={event} minHeight={420} />
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
