import type { ComponentType, ReactNode } from "react";
import type {
  AdminClientPaths,
  CopilotzAdminClient,
} from "../api/client";
import type {
  AdminCollectionItem,
  RequestHeadersProvider,
} from "../api/types";

export type AdminModuleGroup = "operate" | "configure" | "data" | "extensions";

export interface AdminScope {
  namespace?: string;
  schema?: string;
  availableNamespaces?: Array<{ id: string; label?: string }>;
}

export interface AdminBranding {
  title?: string;
  subtitle?: string;
  logo?: ReactNode;
  actions?: ReactNode;
}

export interface AdminPermissions {
  roles?: string[];
  canAccess?: (permission: string, action?: string) => boolean;
}

export interface AdminRouteState {
  routeId: string;
  params?: Record<string, string | undefined>;
}

export interface AdminRouteDefinition {
  id: string;
  title: string;
  permission?: string;
  render: (context: AdminRuntimeContext) => ReactNode;
}

export interface AdminNavItem {
  id: string;
  label: string;
  routeId: string;
  group?: AdminModuleGroup;
  icon?: ComponentType<{ className?: string }>;
  description?: string;
  order?: number;
  permission?: string;
}

export interface CollectionEditorProps {
  collection: string;
  itemId: string | null;
  value: AdminCollectionItem | null;
  isNew: boolean;
  context: AdminRuntimeContext;
  onSaved?: (item: AdminCollectionItem) => void;
  onDeleted?: () => void;
}

export type CollectionEditor = ComponentType<CollectionEditorProps>;

export interface AdminDetailPanel {
  id: string;
  label: string;
  routeIds?: string[];
  render: (context: AdminRuntimeContext) => ReactNode;
}

export interface AdminModule {
  id: string;
  label: string;
  group?: AdminModuleGroup;
  icon?: ComponentType<{ className?: string }>;
  routes: AdminRouteDefinition[];
  navItems?: AdminNavItem[];
  collectionEditors?: Record<string, CollectionEditor>;
  detailPanels?: AdminDetailPanel[];
}

export interface AdminRuntimeContext {
  client: CopilotzAdminClient;
  modules: AdminModule[];
  route: AdminRouteState;
  scope: AdminScope;
  branding: Required<AdminBranding>;
  permissions: AdminPermissions;
  refreshKey: number;
  collectionEditors: Record<string, CollectionEditor>;
  navigate: (routeId: string, params?: Record<string, string | undefined>) => void;
  setNamespace: (namespace: string) => void;
  requestRefresh: () => void;
  canAccess: (permission?: string, action?: string) => boolean;
}

export interface AdminClientConfig {
  baseUrl?: string;
  paths?: Partial<AdminClientPaths>;
  getRequestHeaders?: RequestHeadersProvider;
}

export interface LegacyAdminConfig {
  baseUrl?: string;
  getRequestHeaders?: RequestHeadersProvider;
  namespace?: string;
  branding?: AdminBranding;
  defaultPage?: string;
}

export interface CopilotzAdminProps {
  client?: CopilotzAdminClient;
  clientConfig?: AdminClientConfig;
  config?: LegacyAdminConfig;
  scope?: AdminScope;
  modules?: AdminModule[];
  branding?: AdminBranding;
  permissions?: AdminPermissions;
  className?: string;
  onNavigate?: (route: AdminRouteState) => void;
}
