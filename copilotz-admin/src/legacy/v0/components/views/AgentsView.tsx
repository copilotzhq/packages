import React from "react";
import { Search, Bot } from "lucide-react";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import type { AdminAgentSummary, ResolvedAdminConfig } from "../../types";

interface AgentsViewProps {
  config: ResolvedAdminConfig;
  agents: AdminAgentSummary[];
  searchValue: string;
  onSearchChange: (value: string) => void;
  onAgentClick?: (agentId: string) => void;
}

export const AgentsView: React.FC<AgentsViewProps> = ({
  config,
  agents,
  searchValue,
  onSearchChange,
  onAgentClick,
}) => {
  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder={config.labels.agentSearchPlaceholder}
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      {agents.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <Bot className="mx-auto h-8 w-8 text-muted-foreground/50" />
          <p className="mt-3 text-sm text-muted-foreground">
            {searchValue ? config.labels.noResults : config.labels.emptyDescription}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent) => (
            <div
              key={`${agent.namespace}:${agent.agentId}`}
              className="rounded-lg border bg-card p-5 transition-colors hover:bg-muted/50 cursor-pointer"
              onClick={() => onAgentClick?.(agent.agentId)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium truncate">{agent.displayName}</p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {agent.description ?? agent.agentId}
                  </p>
                </div>
                <Badge variant="outline" className="shrink-0">
                  {agent.isConfigured ? config.labels.configured : config.labels.unconfigured}
                </Badge>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                <span>{formatNumber(agent.messageCount)} messages</span>
                <span>{formatNumber(agent.llmCallCount)} LLM calls</span>
                <span>{formatNumber(agent.toolCallMessageCount)} tool calls</span>
                <span>{formatNumber(agent.totalTokens)} tokens</span>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                {formatDate(agent.lastActivityAt)}
              </p>
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
  return date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function formatNumber(value: number) {
  return new Intl.NumberFormat().format(value);
}
