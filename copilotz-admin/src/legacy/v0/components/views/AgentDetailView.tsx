import React from "react";
import { ArrowLeft, Bot } from "lucide-react";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import type { AdminAgentSummary, ResolvedAdminConfig } from "../../types";

interface AgentDetailViewProps {
  agentId: string;
  config: ResolvedAdminConfig;
  agents: AdminAgentSummary[];
  onBack: () => void;
}

export const AgentDetailView: React.FC<AgentDetailViewProps> = ({
  agentId,
  config,
  agents,
  onBack,
}) => {
  const agent = agents.find((a) => a.agentId === agentId);

  if (!agent) {
    return (
      <div className="space-y-4 py-10 text-center">
        <p className="text-muted-foreground">Agent not found: {agentId}</p>
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
      </div>
    );
  }

  const stats = [
    { label: "Messages", value: agent.messageCount },
    { label: "LLM Calls", value: agent.llmCallCount },
    { label: "Tool Calls", value: agent.toolCallMessageCount },
    { label: "Input Tokens", value: agent.inputTokens },
    { label: "Output Tokens", value: agent.outputTokens },
    { label: "Reasoning Tokens", value: agent.reasoningTokens },
    { label: "Cache Read", value: agent.cacheReadInputTokens },
    { label: "Cache Created", value: agent.cacheCreationInputTokens },
    { label: "Total Tokens", value: agent.totalTokens },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" className="mt-1 shrink-0" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-semibold">{agent.displayName}</h2>
                <Badge variant="outline">
                  {agent.isConfigured ? config.labels.configured : config.labels.unconfigured}
                </Badge>
              </div>
              {agent.description && (
                <p className="text-sm text-muted-foreground">{agent.description}</p>
              )}
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
            <span>ID: {agent.agentId}</span>
            <span>Namespace: {agent.namespace}</span>
            {agent.lastActivityAt && <span>Last active: {formatDate(agent.lastActivityAt)}</span>}
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-3">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-xl border bg-card p-5 shadow-sm">
            <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight">
              {new Intl.NumberFormat().format(stat.value)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
