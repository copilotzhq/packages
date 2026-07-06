export type * from "./api/types";
export type * from "./core/types";
export type { CopilotzAdminClient, AdminClientOptions, AdminClientPaths } from "./api/client";

export type AdminPage = string;
export interface AdminRoute {
  page: string;
  resourceId?: string;
  collection?: string;
}
