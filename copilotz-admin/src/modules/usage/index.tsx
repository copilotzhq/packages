import React from "react";
import { BarChart3, ChevronRight } from "lucide-react";
import type { AdminUsageKind, AdminUsageResponse } from "../../api/types";
import type { AdminModule, AdminRuntimeContext } from "../../core/types";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import {
  EmptyState,
  FilterBar,
  PageHeader,
  ResourceTable,
  StatusBadge,
} from "../../components/patterns";

export function usageModule(): AdminModule {
  return {
    group: "operate",
    icon: BarChart3,
    id: "usage",
    label: "Usage",
    navItems: [
      {
        group: "operate",
        icon: BarChart3,
        id: "usage",
        label: "Usage",
        order: 20,
        routeId: "usage",
      },
    ],
    routes: [
      {
        id: "usage",
        title: "Usage",
        render: (context) => <UsagePage context={context} />,
      },
    ],
  };
}

function UsagePage({ context }: { context: AdminRuntimeContext }) {
  const [kind, setKind] = React.useState<AdminUsageKind>("all");
  const [provider, setProvider] = React.useState("");
  const [model, setModel] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [page, setPage] = React.useState<AdminUsageResponse | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const generation = React.useRef(0);

  const load = React.useCallback(
    async (after?: string) => {
      const requestGeneration = ++generation.current;
      setLoading(true);
      setError(null);
      try {
        const next = await context.client.getUsage({
          after,
          kind,
          limit: 50,
          model: model.trim() || undefined,
          provider: provider.trim() || undefined,
          status: status.trim() || undefined,
        });
        if (requestGeneration !== generation.current) return;
        setPage((current) =>
          after && current
            ? { data: [...current.data, ...next.data], pageInfo: next.pageInfo }
            : next
        );
      } catch (cause) {
        if (requestGeneration !== generation.current) return;
        setError(
          cause instanceof Error
            ? cause.message
            : "Failed to load usage records"
        );
      } finally {
        if (requestGeneration === generation.current) setLoading(false);
      }
    },
    [context.client, kind, model, provider, status]
  );

  React.useEffect(() => {
    void load();
    return () => {
      generation.current++;
    };
  }, [load, context.refreshKey]);
  return (
    <div className="space-y-4">
      <PageHeader
        title="Usage"
        description="Browse usage records by kind, provider, model, and status."
      />
      <FilterBar
        actions={
          <Button
            disabled={loading}
            onClick={() => void load()}
            size="sm"
            type="button"
          >
            Refresh
          </Button>
        }
      >
        <Input
          aria-label="Kind"
          onChange={(event) => setKind(event.target.value || "all")}
          placeholder="Kind (llm, tool)"
          value={kind}
        />
        <Input
          aria-label="Provider"
          onChange={(event) => setProvider(event.target.value)}
          placeholder="Provider"
          value={provider}
        />
        <Input
          aria-label="Model"
          onChange={(event) => setModel(event.target.value)}
          placeholder="Model"
          value={model}
        />
        <Input
          aria-label="Status"
          onChange={(event) => setStatus(event.target.value)}
          placeholder="Status"
          value={status}
        />
      </FilterBar>
      {error ? (
        <EmptyState title="Unable to load usage" description={error} />
      ) : (
        <>
          <ResourceTable
            rows={page?.data ?? []}
            getRowKey={(row) => row.id}
            empty={
              <EmptyState
                title={loading ? "Loading usage records" : "No usage records"}
              />
            }
            columns={[
              {
                id: "occurred",
                header: "Occurred",
                render: (row) => formatDate(row.occurredAt ?? row.createdAt),
              },
              { id: "kind", header: "Kind", render: (row) => row.kind ?? "-" },
              {
                id: "resource",
                header: "Resource",
                render: (row) => row.resource ?? row.model ?? "-",
              },
              {
                id: "status",
                header: "Status",
                render: (row) =>
                  row.status ? <StatusBadge status={row.status} /> : "-",
              },
              {
                id: "tokens",
                header: "Tokens",
                align: "right",
                render: (row) => formatNumber(row.totalTokens),
              },
              {
                id: "cost",
                header: "Cost",
                align: "right",
                render: (row) => formatUsd(row.totalCostUsd),
              },
            ]}
          />
          {page?.pageInfo.hasMore && page.pageInfo.next && (
            <Button
              disabled={loading}
              onClick={() => void load(page.pageInfo.next!)}
              size="sm"
              type="button"
            >
              Load next page <ChevronRight className="size-3" />
            </Button>
          )}
        </>
      )}
    </div>
  );
}

function formatNumber(value: number | null) {
  return value === null ? "-" : new Intl.NumberFormat().format(value);
}
function formatUsd(value: number | null) {
  return value === null
    ? "-"
    : new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: "USD",
      }).format(value);
}
function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString() : "-";
}
