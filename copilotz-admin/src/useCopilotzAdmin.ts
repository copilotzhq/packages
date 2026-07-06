import { useCallback, useEffect, useMemo, useState } from "react";
import { createAdminClient } from "./api/client";
import type {
  AdminActivityInterval,
  AdminActivityPoint,
  AdminAgentSummary,
  AdminDatePreset,
  AdminOverview,
  AdminParticipantSummary,
  AdminThreadSummary,
  RequestHeadersProvider,
} from "./api/types";

export interface UseCopilotzAdminOptions {
  agentSearch?: string;
  baseUrl?: string;
  getRequestHeaders?: RequestHeadersProvider;
  interval?: AdminActivityInterval;
  namespace?: string;
  participantSearch?: string;
  range?: AdminDatePreset;
  threadSearch?: string;
}

export interface UseCopilotzAdminResult {
  activity: AdminActivityPoint[];
  agents: AdminAgentSummary[];
  error: Error | null;
  filters: UseCopilotzAdminOptions & {
    interval: AdminActivityInterval;
    range: AdminDatePreset;
  };
  isLoading: boolean;
  overview: AdminOverview | null;
  participants: AdminParticipantSummary[];
  refresh: () => Promise<void>;
  setInterval: (interval: AdminActivityInterval) => void;
  setRange: (range: AdminDatePreset) => void;
  threads: AdminThreadSummary[];
}

/** @deprecated Prefer the module-based CopilotzAdmin shell and createAdminClient. */
export function useCopilotzAdmin(
  options: UseCopilotzAdminOptions = {},
): UseCopilotzAdminResult {
  const [range, setRange] = useState<AdminDatePreset>(options.range ?? "7d");
  const [interval, setInterval] = useState<AdminActivityInterval>(
    options.interval ?? "day",
  );
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [activity, setActivity] = useState<AdminActivityPoint[]>([]);
  const [threads, setThreads] = useState<AdminThreadSummary[]>([]);
  const [participants, setParticipants] = useState<AdminParticipantSummary[]>([]);
  const [agents, setAgents] = useState<AdminAgentSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const client = useMemo(
    () =>
      createAdminClient({
        baseUrl: options.baseUrl,
        getRequestHeaders: options.getRequestHeaders,
      }),
    [options.baseUrl, options.getRequestHeaders],
  );

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [
        nextOverview,
        nextActivity,
        nextThreads,
        nextParticipants,
        nextAgents,
      ] = await Promise.all([
        client.getOverview({ namespace: options.namespace, range }),
        client.getActivity({ interval, namespace: options.namespace, range }),
        client.listThreads({
          namespace: options.namespace,
          search: options.threadSearch,
        }),
        client.listParticipants({
          namespace: options.namespace,
          search: options.participantSearch,
        }),
        client.listAgents({
          namespace: options.namespace,
          range,
          search: options.agentSearch,
        }),
      ]);
      setOverview(nextOverview);
      setActivity(nextActivity);
      setThreads(nextThreads);
      setParticipants(nextParticipants);
      setAgents(nextAgents);
    } catch (cause) {
      setError(cause instanceof Error
        ? cause
        : new Error("Failed to load admin data"));
    } finally {
      setIsLoading(false);
    }
  }, [
    client,
    interval,
    options.agentSearch,
    options.namespace,
    options.participantSearch,
    options.threadSearch,
    range,
  ]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  return {
    activity,
    agents,
    error,
    filters: {
      ...options,
      interval,
      range,
    },
    isLoading,
    overview,
    participants,
    refresh: fetchAll,
    setInterval,
    setRange,
    threads,
  };
}
