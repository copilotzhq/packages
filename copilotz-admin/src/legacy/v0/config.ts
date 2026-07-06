import type { AdminConfig, ResolvedAdminConfig } from "./types";

export const defaultAdminConfig: ResolvedAdminConfig = {
  branding: {
    title: "Copilotz Admin",
    subtitle: "Operational visibility for Copilotz clients",
    logo: null,
    actions: null,
  },
  labels: {
    overviewTitle: "Overview",
    activityTitle: "Activity",
    threadsTitle: "Threads",
    participantsTitle: "Participants",
    agentsTitle: "Agents",
    range24h: "24h",
    range7d: "7d",
    range30d: "30d",
    intervalHour: "Hourly",
    intervalDay: "Daily",
    refresh: "Refresh",
    retry: "Try again",
    loading: "Loading admin data...",
    emptyTitle: "No activity yet",
    emptyDescription: "Admin metrics will appear after threads, events, and graph data start flowing.",
    threadSearchPlaceholder: "Search threads",
    participantSearchPlaceholder: "Search participants",
    agentSearchPlaceholder: "Search agents",
    messagesCard: "Messages",
    activeThreadsCard: "Active threads",
    participantsCard: "Participants",
    tokensCard: "LLM tokens",
    costCard: "LLM cost",
    queueCard: "Queued events",
    llmUsageTitle: "LLM Usage",
    usageMetricLabel: "Metric",
    usageDimensionLabel: "Usage type",
    usageMetricTokens: "Tokens",
    usageMetricCost: "Cost",
    usageTotal: "Total",
    usageInput: "Input",
    usageOutput: "Output",
    usageReasoning: "Reasoning",
    usageCacheRead: "Cache read",
    usageCacheWrite: "Cache write",
    usageCallsDetail: "LLM calls",
    usageUnavailableDetail: "Available when provider-native usage exists",
    statusActive: "Active",
    statusArchived: "Archived",
    scopeGlobal: "Global",
    scopeScoped: "Scoped",
    configured: "Configured",
    unconfigured: "Observed only",
    noResults: "No results",
    eventsTitle: "Events",
    dashboardTitle: "Dashboard",
    collectionsTitle: "Collections",
    collectionsEndpoint: "/v1/collections",
  },
  features: {
    showOverview: true,
    showActivity: true,
    showThreads: true,
    showParticipants: true,
    showAgents: true,
    showEvents: true,
    showCollections: true,
  },
  ui: {
    compact: false,
    maxActivityBars: 18,
  },
  sidebar: {
    defaultOpen: true,
    collapsible: "icon",
  },
  baseUrl: "",
  getRequestHeaders: async () => ({}),
  namespace: "",
  initialRange: "7d",
  initialInterval: "day",
  defaultPage: "dashboard",
  onNavigate: null,
};

export function mergeAdminConfig(
  _baseConfig: ResolvedAdminConfig,
  userConfig?: Partial<AdminConfig>,
): ResolvedAdminConfig {
  if (!userConfig) return defaultAdminConfig;

  return {
    branding: {
      ...defaultAdminConfig.branding,
      ...userConfig.branding,
    },
    labels: {
      ...defaultAdminConfig.labels,
      ...userConfig.labels,
    },
    features: {
      ...defaultAdminConfig.features,
      ...userConfig.features,
    },
    ui: {
      ...defaultAdminConfig.ui,
      ...userConfig.ui,
    },
    sidebar: {
      ...defaultAdminConfig.sidebar,
      ...userConfig.sidebar,
    },
    baseUrl: userConfig.baseUrl ?? defaultAdminConfig.baseUrl,
    getRequestHeaders: userConfig.getRequestHeaders ??
      defaultAdminConfig.getRequestHeaders,
    namespace: userConfig.namespace ?? defaultAdminConfig.namespace,
    initialRange: userConfig.initialRange ?? defaultAdminConfig.initialRange,
    initialInterval: userConfig.initialInterval ??
      defaultAdminConfig.initialInterval,
    defaultPage: userConfig.defaultPage ?? defaultAdminConfig.defaultPage,
    onNavigate: userConfig.onNavigate ?? defaultAdminConfig.onNavigate,
  };
}
