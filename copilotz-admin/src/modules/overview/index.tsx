import React from "react";
import {
  Activity,
  AlertTriangle,
  Bot,
  MessageSquare,
  Sparkles,
  Users,
  Wallet,
} from "lucide-react";
import type {
  AdminAgentSummary,
  AdminOverview,
  AdminThreadSummary,
} from "../../api/types";
import type { AdminModule, AdminRuntimeContext } from "../../core/types";
import {
  EmptyState,
  MetricStrip,
  PageHeader,
  ResourceTable,
  StatusBadge,
} from "../../components/patterns";
import { formatMetricValue, formatNumber } from "../usage/calculations";

export function overviewModule(): AdminModule {
  return {
    group: "operate",
    icon: Activity,
    id: "overview",
    label: "Overview",
    navItems: [{
      group: "operate",
      icon: Activity,
      id: "overview",
      label: "Overview",
      order: 10,
      routeId: "overview",
    }],
    routes: [{
      id: "overview",
      title: "Overview",
      render: (context) => <OverviewPage context={context} />,
    }],
  };
}

function OverviewPage({ context }: { context: AdminRuntimeContext }) {
  const [overview, setOverview] = React.useState<AdminOverview | null>(null);
  const [threads, setThreads] = React.useState<AdminThreadSummary[]>([]);
  const [agents, setAgents] = React.useState<AdminAgentSummary[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    setIsLoading(true);
    setError(null);
    void Promise.all([
      context.client.getOverview({
        namespace: context.scope.namespace || undefined,
        range: "7d",
      }),
      context.client.listThreads({
        limit: 8,
        namespace: context.scope.namespace || undefined,
      }),
      context.client.listAgents({
        limit: 8,
        namespace: context.scope.namespace || undefined,
        range: "7d",
      }),
    ]).then(([nextOverview, nextThreads, nextAgents]) => {
      if (!active) return;
      setOverview(nextOverview);
      setThreads(nextThreads);
      setAgents(nextAgents);
    }).catch((cause) => {
      if (active) setError(cause instanceof Error ? cause.message : "Failed to load overview");
    }).finally(() => {
      if (active) setIsLoading(false);
    });
    return () => {
      active = false;
    };
  }, [context.client, context.refreshKey, context.scope.namespace]);

  if (error) {
    return <EmptyState title="Unable to load overview" description={error} />;
  }

  const queueFailures = (overview?.queueTotals.failed ?? 0) +
    (overview?.queueTotals.expired ?? 0);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Overview"
        description="Operational health, recent activity, and cost signals for the active Copilotz scope."
        badges={[
          { label: context.scope.namespace || "All namespaces" },
          ...(isLoading ? [{ label: "Loading" as const }] : []),
        ]}
      />
      <MetricStrip
        items={[
          {
            detail: `${formatNumber(overview?.threadTotals.active ?? 0)} active`,
            icon: MessageSquare,
            label: "Threads",
            value: formatNumber(overview?.threadTotals.total ?? 0),
          },
          {
            detail: `${formatNumber(overview?.participantTotals.agents ?? 0)} agents`,
            icon: Users,
            label: "Participants",
            value: formatNumber(overview?.participantTotals.total ?? 0),
          },
          {
            detail: `${formatNumber(overview?.llmTotals.totalCalls ?? 0)} LLM calls`,
            icon: Wallet,
            label: "Cost",
            value: formatMetricValue(overview?.llmTotals.totalCostUsd ?? 0, "cost"),
          },
          {
            detail: `${formatNumber(queueFailures)} failures/expired`,
            icon: queueFailures > 0 ? AlertTriangle : Sparkles,
            label: "Queue",
            value: formatNumber(overview?.queueTotals.total ?? 0),
          },
        ]}
      />
      <div className="grid gap-4 xl:grid-cols-2">
        <section className="space-y-3">
          <PageHeader title="Recent Threads" />
          <ResourceTable
            rows={threads}
            getRowKey={(thread) => thread.threadId}
            onRowClick={(thread) =>
              context.navigate("threads.detail", { threadId: thread.threadId })}
            columns={[
              {
                id: "name",
                header: "Thread",
                render: (thread) => (
                  <div>
                    <div className="max-w-md truncate font-medium">
                      {thread.name || thread.threadId}
                    </div>
                    <div className="max-w-md truncate text-xs text-muted-foreground">
                      {thread.summary ?? thread.lastMessagePreview ?? "No summary"}
                    </div>
                  </div>
                ),
              },
              {
                id: "status",
                header: "Status",
                render: (thread) => <StatusBadge status={thread.status} />,
              },
              {
                align: "right",
                id: "messages",
                header: "Messages",
                render: (thread) => formatNumber(thread.messageCount),
              },
            ]}
          />
        </section>
        <section className="space-y-3">
          <PageHeader title="Top Agents" />
          <ResourceTable
            rows={agents}
            getRowKey={(agent) => `${agent.namespace}:${agent.agentId}`}
            onRowClick={(agent) =>
              context.navigate("agents.detail", { agentId: agent.agentId })}
            columns={[
              {
                id: "agent",
                header: "Agent",
                render: (agent) => (
                  <div className="flex items-center gap-2">
                    <Bot className="size-4 text-muted-foreground" />
                    <div>
                      <div className="font-medium">{agent.displayName}</div>
                      <div className="text-xs text-muted-foreground">
                        {agent.agentId}
                      </div>
                    </div>
                  </div>
                ),
              },
              {
                align: "right",
                id: "calls",
                header: "Calls",
                render: (agent) => formatNumber(agent.llmCallCount),
              },
              {
                align: "right",
                id: "cost",
                header: "Cost",
                render: (agent) => formatMetricValue(agent.totalCostUsd, "cost"),
              },
            ]}
          />
        </section>
      </div>
    </div>
  );
}
