import React from "react";
import { Bot } from "lucide-react";
import type { AdminAgentSummary } from "../../api/types";
import type { AdminModule, AdminRuntimeContext } from "../../core/types";
import {
  EmptyState,
  FilterBar,
  JsonPanel,
  MetricStrip,
  PageHeader,
  ResourceTable,
  StatusBadge,
} from "../../components/patterns";

export function agentsModule(): AdminModule {
  return {
    group: "configure",
    icon: Bot,
    id: "agents",
    label: "Agents",
    navItems: [
      {
        group: "configure",
        icon: Bot,
        id: "agents",
        label: "Agents",
        order: 10,
        routeId: "agents",
      },
    ],
    routes: [
      {
        id: "agents",
        title: "Agents",
        render: (context) => <AgentsPage context={context} />,
      },
      {
        id: "agents.detail",
        title: "Agent Detail",
        render: (context) => <AgentDetailPage context={context} />,
      },
    ],
  };
}

function AgentsPage({ context }: { context: AdminRuntimeContext }) {
  const [search, setSearch] = React.useState("");
  const [agents, setAgents] = React.useState<AdminAgentSummary[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    setError(null);
    void context.client
      .listAgents({
        limit: 50,
        namespace: context.scope.namespace || undefined,
        range: "7d",
        search: search || undefined,
      })
      .then((next) => {
        if (active) setAgents(next);
      })
      .catch((cause) => {
        if (active)
          setError(
            cause instanceof Error ? cause.message : "Failed to load agents"
          );
      });
    return () => {
      active = false;
    };
  }, [context.client, context.refreshKey, context.scope.namespace, search]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Agents"
        description="Browse configured agents, their roles, tools, and capabilities."
      />
      <FilterBar
        onSearchChange={setSearch}
        searchPlaceholder="Search agents..."
        searchValue={search}
      />
      {error ? (
        <EmptyState title="Unable to load agents" description={error} />
      ) : (
        <ResourceTable
          rows={agents}
          getRowKey={(agent) => agent.agentId}
          onRowClick={(agent) =>
            context.navigate("agents.detail", { agentId: agent.agentId })
          }
          empty={
            <EmptyState
              icon={Bot}
              title="No agents"
              description="Configured or observed agents will appear here."
            />
          }
          columns={[
            {
              id: "agent",
              header: "Agent",
              render: (agent) => (
                <div>
                  <div className="font-medium">{agent.displayName}</div>
                  <div className="text-xs text-muted-foreground">
                    {agent.agentId}
                  </div>
                </div>
              ),
            },
            {
              id: "configured",
              header: "Config",
              render: (agent) => <StatusBadge status="configured" />,
            },
            {
              align: "right",
              id: "role",
              header: "Role",
              render: (agent) => agent.role ?? "-",
            },
            {
              align: "right",
              id: "tokens",
              header: "Capabilities",
              render: (agent) => Object.keys(agent.capabilities).length,
            },
            {
              align: "right",
              id: "cost",
              header: "Tools",
              render: (agent) =>
                Array.isArray(agent.capabilities.tools)
                  ? agent.capabilities.tools.length
                  : "-",
            },
          ]}
        />
      )}
    </div>
  );
}

function AgentDetailPage({ context }: { context: AdminRuntimeContext }) {
  const agentId = context.route.params?.agentId;
  const [agent, setAgent] = React.useState<AdminAgentSummary | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!agentId) return;
    let active = true;
    setError(null);
    void context.client
      .listAgents({
        limit: 50,
        namespace: context.scope.namespace || undefined,
        range: "7d",
        search: agentId,
      })
      .then((agents) => {
        if (active) {
          setAgent(
            agents.find((candidate) => candidate.agentId === agentId) ??
              agents[0] ??
              null
          );
        }
      })
      .catch((cause) => {
        if (active)
          setError(
            cause instanceof Error ? cause.message : "Failed to load agent"
          );
      });
    return () => {
      active = false;
    };
  }, [agentId, context.client, context.refreshKey, context.scope.namespace]);

  if (!agentId) return <EmptyState title="Agent not selected" />;
  if (error)
    return <EmptyState title="Unable to load agent" description={error} />;

  return (
    <div className="space-y-4">
      <PageHeader
        title={agent?.displayName ?? agentId}
        description={agent?.role ?? "Configured agent"}
        badges={[{ label: "Configured" }]}
        actions={
          <button
            className="text-sm text-muted-foreground hover:text-foreground"
            onClick={() => context.navigate("agents")}
            type="button"
          >
            Back to agents
          </button>
        }
      />
      <MetricStrip
        items={[
          {
            icon: Bot,
            label: "Capabilities",
            value: Object.keys(agent?.capabilities ?? {}).length,
          },
        ]}
      />
      <div className="grid gap-4 xl:grid-cols-[1fr_420px]">
        <div className="rounded-lg border bg-background p-4">
          <h3 className="text-sm font-medium">Configuration Surface</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Model, fallback, tool, memory, and instruction editors are exposed
            here for project modules to extend.
          </p>
        </div>
        <JsonPanel title="Advanced JSON" value={agent} minHeight={360} />
      </div>
    </div>
  );
}
