import React from "react";
import { Search, Users } from "lucide-react";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import type { AdminParticipantSummary, ResolvedAdminConfig } from "../../types";

interface ParticipantsViewProps {
  config: ResolvedAdminConfig;
  participants: AdminParticipantSummary[];
  searchValue: string;
  onSearchChange: (value: string) => void;
  onParticipantClick?: (externalId: string) => void;
}

export const ParticipantsView: React.FC<ParticipantsViewProps> = ({
  config,
  participants,
  searchValue,
  onSearchChange,
  onParticipantClick,
}) => {
  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder={config.labels.participantSearchPlaceholder}
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      {participants.length === 0 ? (
        <div className="rounded-xl border border-dashed p-10 text-center">
          <Users className="mx-auto h-8 w-8 text-muted-foreground/50" />
          <p className="mt-3 text-sm text-muted-foreground">
            {searchValue ? config.labels.noResults : config.labels.emptyDescription}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {participants.map((p) => (
            <div
              key={`${p.namespace}:${p.externalId}`}
              className="flex items-center gap-4 rounded-lg border bg-card p-4 transition-colors hover:bg-muted/50 cursor-pointer"
              onClick={() => onParticipantClick?.(p.externalId)}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium truncate">{p.displayName}</p>
                  <Badge variant="outline" className="shrink-0 text-xs">
                    {p.participantType}
                  </Badge>
                  <Badge variant={p.isGlobal ? "default" : "secondary"} className="shrink-0 text-xs">
                    {p.isGlobal ? config.labels.scopeGlobal : config.labels.scopeScoped}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {p.externalId}
                </p>
              </div>
              <div className="text-right text-xs text-muted-foreground shrink-0 space-y-1">
                <p>{formatNumber(p.messageCount)} messages</p>
                <p>{formatNumber(p.threadCount)} threads</p>
                <p>{formatDate(p.lastActivityAt)}</p>
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
  return date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function formatNumber(value: number) {
  return new Intl.NumberFormat().format(value);
}
