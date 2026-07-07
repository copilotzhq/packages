export { createAdminClient } from "./api/client";
export type {
  AdminClientOptions,
  AdminClientPaths,
  CopilotzAdminClient,
} from "./api/client";
export type * from "./api/types";
export { CopilotzAdmin } from "./core";
export {
  ADMIN_GROUP_LABELS,
  ADMIN_GROUP_ORDER,
  canAccessAdminPermission,
  collectAdminNavItems,
  collectAdminRoutes,
  collectCollectionEditors,
  firstAccessibleRoute,
  useAdmin,
} from "./core";
export type * from "./core";
export {
  agentsModule,
  BRAIN_RELATION_GROUP_DEFINITIONS,
  BRAIN_VIEW_LABELS,
  brainModule,
  collectionsModule,
  defaultCopilotzModules,
  ENTITY_FOCUS_RELATION_TYPES,
  eventsModule,
  getBrainViewBaseFilters,
  getKnowledgeRelationGroups,
  overviewModule,
  participantsModule,
  threadsModule,
  getWorkRelationGroups,
  groupBrainRelationsByKind,
  isEntityBrainView,
  usageModule,
} from "./modules";
export {
  addUsageTotals,
  aggregateUsageRows,
  buildUsageChartState,
  EMPTY_USAGE_TOTALS,
  formatCompactMetric,
  formatMetricValue,
  formatNumber,
  formatPercent,
  formatUsageBucket,
  getUsageDimensionLabel,
  getUsageGroupLabel,
  getUsageMetricLabel,
  getUsageRange,
  getUsageTotalValue,
} from "./modules";
export type * from "./modules";
export { defaultAdminConfig, mergeAdminConfig } from "./config";
export { useCopilotzAdmin } from "./useCopilotzAdmin";
export type {
  UseCopilotzAdminOptions,
  UseCopilotzAdminResult,
} from "./useCopilotzAdmin";
export * from "./components/patterns";
