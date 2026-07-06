import React from "react";
import { Users } from "lucide-react";
import type {
  AdminParticipantDetail,
  AdminParticipantSummary,
} from "../../api/types";
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
import { formatNumber } from "../usage/calculations";

export function participantsModule(): AdminModule {
  return {
    group: "data",
    icon: Users,
    id: "participants",
    label: "Participants",
    navItems: [{
      group: "data",
      icon: Users,
      id: "participants",
      label: "Participants",
      order: 10,
      routeId: "participants",
    }],
    routes: [
      {
        id: "participants",
        title: "Participants",
        render: (context) => <ParticipantsPage context={context} />,
      },
      {
        id: "participants.detail",
        title: "Participant Detail",
        render: (context) => <ParticipantDetailPage context={context} />,
      },
    ],
  };
}

function ParticipantsPage({ context }: { context: AdminRuntimeContext }) {
  const [search, setSearch] = React.useState("");
  const [participants, setParticipants] = React.useState<AdminParticipantSummary[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let active = true;
    setError(null);
    void context.client.listParticipants({
      limit: 50,
      namespace: context.scope.namespace || undefined,
      search: search || undefined,
    }).then((next) => {
      if (active) setParticipants(next);
    }).catch((cause) => {
      if (active) setError(cause instanceof Error ? cause.message : "Failed to load participants");
    });
    return () => {
      active = false;
    };
  }, [context.client, context.refreshKey, context.scope.namespace, search]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Participants"
        description="Humans, agents, and jobs observed by Copilotz across conversations."
      />
      <FilterBar
        onSearchChange={setSearch}
        searchPlaceholder="Search participants..."
        searchValue={search}
      />
      {error ? (
        <EmptyState title="Unable to load participants" description={error} />
      ) : (
        <ResourceTable
          rows={participants}
          getRowKey={(participant) =>
            `${participant.namespace}:${participant.externalId}`}
          onRowClick={(participant) =>
            context.navigate("participants.detail", {
              participantId: participant.externalId,
            })}
          empty={
            <EmptyState
              icon={Users}
              title="No participants"
              description="Participants appear after messages or jobs are processed."
            />
          }
          columns={[
            {
              id: "participant",
              header: "Participant",
              render: (participant) => (
                <div>
                  <div className="max-w-md truncate font-medium">
                    {participant.displayName}
                  </div>
                  <div className="max-w-md truncate text-xs text-muted-foreground">
                    {participant.externalId}
                  </div>
                </div>
              ),
            },
            {
              id: "type",
              header: "Type",
              render: (participant) => (
                <StatusBadge status={participant.participantType} />
              ),
            },
            {
              id: "scope",
              header: "Scope",
              render: (participant) =>
                participant.isGlobal ? "Global" : participant.namespace,
            },
            {
              align: "right",
              id: "messages",
              header: "Messages",
              render: (participant) => formatNumber(participant.messageCount),
            },
            {
              align: "right",
              id: "threads",
              header: "Threads",
              render: (participant) => formatNumber(participant.threadCount),
            },
          ]}
        />
      )}
    </div>
  );
}

function ParticipantDetailPage({ context }: { context: AdminRuntimeContext }) {
  const participantId = context.route.params?.participantId;
  const [participant, setParticipant] = React.useState<AdminParticipantDetail | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!participantId) return;
    let active = true;
    setError(null);
    void context.client.getCollectionItem("participant", participantId, {
      namespace: context.scope.namespace || undefined,
    }).then((next) => {
      if (active) setParticipant(next);
    }).catch((cause) => {
      if (active) setError(cause instanceof Error ? cause.message : "Failed to load participant");
    });
    return () => {
      active = false;
    };
  }, [context.client, context.refreshKey, context.scope.namespace, participantId]);

  if (!participantId) {
    return <EmptyState title="Participant not selected" />;
  }
  if (error) {
    return <EmptyState title="Unable to load participant" description={error} />;
  }

  const memories = Array.isArray(participant?.memories)
    ? participant.memories.length
    : 0;

  return (
    <div className="space-y-4">
      <PageHeader
        title={String(participant?.displayName ?? participantId)}
        description="Participant profile, activity-ready metrics, and advanced record data."
        actions={
          <button
            className="text-sm text-muted-foreground hover:text-foreground"
            onClick={() => context.navigate("participants")}
            type="button"
          >
            Back to participants
          </button>
        }
      />
      <MetricStrip
        items={[
          { label: "Type", value: String(participant?.participantType ?? "unknown") },
          { label: "Namespace", value: String(participant?.namespace ?? context.scope.namespace ?? "global") },
          { label: "Memories", value: formatNumber(memories) },
        ]}
      />
      <JsonPanel title="Advanced JSON" value={participant} minHeight={460} />
    </div>
  );
}
