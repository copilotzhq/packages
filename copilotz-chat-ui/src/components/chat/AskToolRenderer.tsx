import React, { memo } from 'react';
import { LoaderCircle, MessageCircle } from 'lucide-react';
import type {
  AgentOption,
  ToolRendererMap,
  ToolRendererProps,
} from '../../types/chatTypes';

const record = (value: unknown): Record<string, unknown> => (
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
);

const parseDraftArguments = (rawInput: string | undefined): Record<string, unknown> => {
  if (!rawInput) return {};
  try {
    const parsed = record(JSON.parse(rawInput));
    return record(parsed.arguments ?? parsed.args);
  } catch {
    return {};
  }
};

const agentForTarget = (
  target: string,
  agents: readonly AgentOption[] | undefined,
): AgentOption | undefined => {
  const normalized = target.trim().toLowerCase();
  return agents?.find((agent) => (
    agent.id.toLowerCase() === normalized || agent.name.toLowerCase() === normalized
  ));
};

/** Built-in conversational presentation for Copilotz's public `ask` tool. */
export const AskToolRenderer = memo(function AskToolRenderer({
  toolCall,
  draft,
  status,
  error,
  agents,
}: ToolRendererProps) {
  const input = toolCall?.arguments ?? parseDraftArguments(draft?.rawInput);
  const target = typeof input.target === 'string' ? input.target.trim() : '';
  const message = typeof input.message === 'string' ? input.message.trim() : '';
  const agent = target ? agentForTarget(target, agents) : undefined;
  const targetName = agent?.name ?? target;
  const waiting = status === 'streaming' || status === 'pending' || status === 'running';

  return (
    <div className="rounded-lg border border-border/70 bg-muted/25 px-3 py-2.5 text-sm">
      <div className="flex items-center gap-2 font-medium text-foreground">
        <MessageCircle className="h-4 w-4 text-muted-foreground" />
        {targetName ? (
          <span style={agent?.color ? { color: agent.color } : undefined}>
            @{targetName}
          </span>
        ) : (
          <span>Preparing a question…</span>
        )}
        {waiting && <LoaderCircle className="ml-auto h-3.5 w-3.5 animate-spin text-muted-foreground" />}
      </div>
      {message && (
        <div className="mt-1.5 whitespace-pre-wrap break-words leading-6 text-foreground/90">
          {message}
        </div>
      )}
      {error && <div className="mt-1.5 text-destructive">{error}</div>}
    </div>
  );
});

export const builtInToolRenderers: ToolRendererMap = Object.freeze({
  ask: AskToolRenderer,
});
