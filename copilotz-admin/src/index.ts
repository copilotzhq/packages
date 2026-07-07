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
  brainModule,
  collectionsModule,
  defaultCopilotzModules,
  eventsModule,
  overviewModule,
  participantsModule,
  threadsModule,
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
