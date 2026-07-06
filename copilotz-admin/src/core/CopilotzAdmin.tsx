import React, { useMemo, useState } from "react";
import {
  Bot,
  ChevronsUpDown,
  Database,
  LayoutDashboard,
  RefreshCw,
} from "lucide-react";
import { createAdminClient } from "../api/client";
import { cn } from "../lib/utils";
import { Button } from "../components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
} from "../components/ui/sidebar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../components/ui/tooltip";
import { defaultCopilotzModules } from "../modules";
import {
  ADMIN_GROUP_LABELS,
  ADMIN_GROUP_ORDER,
  canAccessAdminPermission,
  collectAdminNavItems,
  collectAdminRoutes,
  collectCollectionEditors,
  firstAccessibleRoute,
} from "./registry";
import { AdminProvider } from "./scope";
import type {
  AdminBranding,
  AdminModuleGroup,
  AdminNavItem,
  AdminRouteState,
  CopilotzAdminProps,
} from "./types";

const DEFAULT_BRANDING: Required<AdminBranding> = {
  title: "Copilotz Admin",
  subtitle: "Operate and configure Copilotz projects",
  logo: null,
  actions: null,
};

function routeFromLegacyPage(page?: string): string | undefined {
  switch (page) {
    case "dashboard":
      return "overview";
    case "thread-detail":
      return "threads.detail";
    case "participant-detail":
      return "participants.detail";
    case "agent-detail":
      return "agents.detail";
    case "collection-items":
      return "collections";
    case "collection-item-detail":
      return "collections.detail";
    default:
      return page;
  }
}

export function CopilotzAdmin({
  branding: brandingProp,
  className,
  client,
  clientConfig,
  config,
  modules: modulesProp,
  onNavigate,
  permissions = {},
  scope: scopeProp,
}: CopilotzAdminProps) {
  const modules = useMemo(
    () => modulesProp ?? defaultCopilotzModules(),
    [modulesProp],
  );
  const adminClient = useMemo(
    () =>
      client ?? createAdminClient({
        baseUrl: clientConfig?.baseUrl ?? config?.baseUrl,
        paths: clientConfig?.paths,
        getRequestHeaders: clientConfig?.getRequestHeaders ??
          config?.getRequestHeaders,
      }),
    [client, clientConfig, config],
  );
  const branding = useMemo(
    () => ({
      ...DEFAULT_BRANDING,
      ...(config?.branding ?? {}),
      ...(brandingProp ?? {}),
    }),
    [brandingProp, config?.branding],
  );
  const [namespace, setNamespaceState] = useState(
    scopeProp?.namespace ?? config?.namespace ?? "",
  );
  const scope = useMemo(() => ({
    ...(scopeProp ?? {}),
    namespace,
  }), [namespace, scopeProp]);

  const routes = useMemo(
    () => collectAdminRoutes(modules, permissions),
    [modules, permissions],
  );
  const navItems = useMemo(
    () => collectAdminNavItems(modules, permissions),
    [modules, permissions],
  );
  const collectionEditors = useMemo(
    () => collectCollectionEditors(modules),
    [modules],
  );

  const initialRouteId = routeFromLegacyPage(config?.defaultPage) ??
    firstAccessibleRoute(modules, permissions);
  const [route, setRoute] = useState<AdminRouteState>({
    routeId: initialRouteId,
  });
  const [refreshKey, setRefreshKey] = useState(0);

  const activeRoute = routes.get(route.routeId) ??
    routes.get(firstAccessibleRoute(modules, permissions));

  const navigate = (routeId: string, params?: Record<string, string | undefined>) => {
    const next = { routeId, params };
    setRoute(next);
    onNavigate?.(next);
  };

  const runtime = {
    branding,
    canAccess: (permission?: string, action?: string) =>
      canAccessAdminPermission(permissions, permission, action),
    client: adminClient,
    collectionEditors,
    modules,
    navigate,
    permissions,
    refreshKey,
    requestRefresh: () => setRefreshKey((key) => key + 1),
    route,
    scope,
    setNamespace: setNamespaceState,
  };

  return (
    <AdminProvider value={runtime}>
      <TooltipProvider>
        <SidebarProvider defaultOpen>
          <div
            className={cn(
              "flex h-[100svh] w-full overflow-hidden bg-background text-foreground",
              className,
            )}
          >
            <AdminShellSidebar
              branding={branding}
              navItems={navItems}
              namespace={namespace}
              onNavigate={navigate}
              onNamespaceChange={setNamespaceState}
              route={route}
              scopeOptions={scope.availableNamespaces}
            />
            <SidebarInset>
              <div className="flex h-full min-h-0 flex-col">
                <AdminShellHeader
                  brandingActions={branding.actions}
                  isRefreshable={Boolean(activeRoute)}
                  onRefresh={() => setRefreshKey((key) => key + 1)}
                  title={activeRoute?.title ?? "Admin"}
                />
                <main className="min-h-0 flex-1 overflow-auto bg-muted/20">
                  <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-4 p-4 lg:p-5">
                    {activeRoute
                      ? activeRoute.render(runtime)
                      : (
                        <div className="rounded-lg border bg-background p-8 text-sm text-muted-foreground">
                          No accessible admin route is configured.
                        </div>
                      )}
                  </div>
                </main>
              </div>
            </SidebarInset>
          </div>
        </SidebarProvider>
      </TooltipProvider>
    </AdminProvider>
  );
}

function AdminShellSidebar({
  branding,
  navItems,
  namespace,
  onNavigate,
  onNamespaceChange,
  route,
  scopeOptions,
}: {
  branding: Required<AdminBranding>;
  navItems: AdminNavItem[];
  namespace: string;
  onNavigate: (routeId: string) => void;
  onNamespaceChange: (namespace: string) => void;
  route: AdminRouteState;
  scopeOptions?: Array<{ id: string; label?: string }>;
}) {
  const grouped = ADMIN_GROUP_ORDER.map((group) => ({
    group,
    items: navItems.filter((item) => (item.group ?? "extensions") === group),
  })).filter((entry) => entry.items.length > 0);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-3 px-2 py-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
            {branding.logo ?? <Bot className="size-4" />}
          </div>
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <div className="truncate text-sm font-semibold">
              {branding.title}
            </div>
            <div className="truncate text-xs text-muted-foreground">
              {branding.subtitle}
            </div>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        {grouped.map(({ group, items }, index) => (
          <React.Fragment key={group}>
            {index > 0 && <SidebarSeparator />}
            <SidebarGroup>
              <SidebarGroupLabel className="group-data-[collapsible=icon]:hidden">
                {ADMIN_GROUP_LABELS[group as AdminModuleGroup]}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {items.map((item) => {
                    const Icon = item.icon ?? LayoutDashboard;
                    return (
                      <SidebarMenuItem key={item.id}>
                        <SidebarMenuButton
                          isActive={route.routeId === item.routeId}
                          onClick={() => onNavigate(item.routeId)}
                          tooltip={item.label}
                        >
                          <Icon />
                          <span>{item.label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </React.Fragment>
        ))}
      </SidebarContent>
      <SidebarFooter>
        <div className="group-data-[collapsible=icon]:hidden">
          <label className="mb-1 block px-2 text-xs font-medium text-muted-foreground">
            Namespace
          </label>
          <Select
            value={namespace || "__all__"}
            onValueChange={(value) =>
              onNamespaceChange(value === "__all__" ? "" : value)}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="All namespaces" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All namespaces</SelectItem>
              {scopeOptions?.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.label ?? option.id}
                </SelectItem>
              ))}
              {namespace && !scopeOptions?.some((option) => option.id === namespace) && (
                <SelectItem value={namespace}>{namespace}</SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
        <div className="hidden justify-center group-data-[collapsible=icon]:flex">
          <ChevronsUpDown className="size-4 text-muted-foreground" />
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

function AdminShellHeader({
  brandingActions,
  isRefreshable,
  onRefresh,
  title,
}: {
  brandingActions?: React.ReactNode;
  isRefreshable: boolean;
  onRefresh: () => void;
  title: string;
}) {
  return (
    <header className="flex min-h-12 shrink-0 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <Tooltip>
        <TooltipTrigger asChild>
          <SidebarTrigger className="-ml-1" />
        </TooltipTrigger>
        <TooltipContent>Toggle sidebar</TooltipContent>
      </Tooltip>
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <Database className="size-4 text-muted-foreground" />
        <h1 className="truncate text-sm font-medium">{title}</h1>
      </div>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            className="size-8"
            disabled={!isRefreshable}
            onClick={onRefresh}
            size="icon"
            type="button"
            variant="ghost"
          >
            <RefreshCw className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Refresh</TooltipContent>
      </Tooltip>
      {brandingActions}
    </header>
  );
}
