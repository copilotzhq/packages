import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  fetchAdminActivity,
  fetchAdminAgents,
  fetchAdminOverview,
  fetchAdminParticipants,
  fetchAdminThreads,
} from "./adminService";
import type {
  AdminActivityInterval,
  AdminDatePreset,
  UseCopilotzAdminOptions,
  UseCopilotzAdminResult,
} from "./types";

export function useCopilotzAdmin(
  options: UseCopilotzAdminOptions = {},
): UseCopilotzAdminResult {
  const [range, setRange] = useState<AdminDatePreset>(options.range ?? "7d");
  const [interval, setInterval] = useState<AdminActivityInterval>(
    options.interval ?? "day",
  );
  const [overview, setOverview] = useState<UseCopilotzAdminResult["overview"]>(
    null,
  );
  const [activity, setActivity] = useState<UseCopilotzAdminResult["activity"]>(
    [],
  );
  const [threads, setThreads] = useState<UseCopilotzAdminResult["threads"]>([]);
  const [participants, setParticipants] = useState<
    UseCopilotzAdminResult["participants"]
  >([]);
  const [agents, setAgents] = useState<UseCopilotzAdminResult["agents"]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const shared = {
        baseUrl: options.baseUrl,
        getRequestHeaders: options.getRequestHeaders,
      };
      const [
        nextOverview,
        nextActivity,
        nextThreads,
        nextParticipants,
        nextAgents,
      ] = await Promise.all([
        fetchAdminOverview(range, options.namespace, shared),
        fetchAdminActivity(range, interval, options.namespace, shared),
        fetchAdminThreads(options.threadSearch, options.namespace, shared),
        fetchAdminParticipants(
          options.participantSearch,
          options.namespace,
          shared,
        ),
        fetchAdminAgents(options.agentSearch, options.namespace, shared),
      ]);

      setOverview(nextOverview);
      setActivity(nextActivity);
      setThreads(nextThreads);
      setParticipants(nextParticipants);
      setAgents(nextAgents);
    } catch (nextError) {
      setError(nextError instanceof Error
        ? nextError
        : new Error("Failed to load admin data"));
    } finally {
      setIsLoading(false);
    }
  }, [
    interval,
    options.agentSearch,
    options.baseUrl,
    options.getRequestHeaders,
    options.namespace,
    options.participantSearch,
    options.threadSearch,
    range,
  ]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  return useMemo(() => ({
    overview,
    activity,
    threads,
    participants,
    agents,
    filters: {
      namespace: options.namespace,
      threadSearch: options.threadSearch,
      participantSearch: options.participantSearch,
      agentSearch: options.agentSearch,
      range,
      interval,
    },
    isLoading,
    error,
    refresh: fetchAll,
    setRange,
    setInterval,
  }), [
    activity,
    agents,
    error,
    fetchAll,
    interval,
    isLoading,
    options.agentSearch,
    options.namespace,
    options.participantSearch,
    options.threadSearch,
    overview,
    participants,
    range,
    threads,
  ]);
}
