import type {
  AdminModule,
  AdminModuleGroup,
  AdminNavItem,
  AdminPermissions,
  AdminRouteDefinition,
  CollectionEditor,
} from "./types";

export const ADMIN_GROUP_LABELS: Record<AdminModuleGroup, string> = {
  operate: "Operate",
  configure: "Configure",
  data: "Data",
  extensions: "Extensions",
};

export const ADMIN_GROUP_ORDER: AdminModuleGroup[] = [
  "operate",
  "configure",
  "data",
  "extensions",
];

export function canAccessAdminPermission(
  permissions: AdminPermissions | undefined,
  permission?: string,
  action = "view",
): boolean {
  if (!permission) return true;
  return permissions?.canAccess ? permissions.canAccess(permission, action) : true;
}

export function collectAdminRoutes(
  modules: AdminModule[],
  permissions?: AdminPermissions,
): Map<string, AdminRouteDefinition> {
  const routes = new Map<string, AdminRouteDefinition>();
  for (const module of modules) {
    for (const route of module.routes) {
      if (!canAccessAdminPermission(permissions, route.permission)) continue;
      routes.set(route.id, route);
    }
  }
  return routes;
}

export function collectAdminNavItems(
  modules: AdminModule[],
  permissions?: AdminPermissions,
): AdminNavItem[] {
  const items: AdminNavItem[] = [];
  for (const module of modules) {
    const navItems = module.navItems?.length
      ? module.navItems
      : module.routes.slice(0, 1).map((route) => ({
        id: `${module.id}:default`,
        label: module.label,
        routeId: route.id,
        group: module.group,
        icon: module.icon,
        permission: route.permission,
      }));

    for (const item of navItems) {
      if (!canAccessAdminPermission(permissions, item.permission)) continue;
      items.push({
        ...item,
        group: item.group ?? module.group ?? "extensions",
        icon: item.icon ?? module.icon,
      });
    }
  }

  return items.sort((a, b) => {
    const groupDelta = ADMIN_GROUP_ORDER.indexOf(a.group ?? "extensions") -
      ADMIN_GROUP_ORDER.indexOf(b.group ?? "extensions");
    if (groupDelta !== 0) return groupDelta;
    return (a.order ?? 100) - (b.order ?? 100) ||
      a.label.localeCompare(b.label);
  });
}

export function collectCollectionEditors(
  modules: AdminModule[],
): Record<string, CollectionEditor> {
  const editors: Record<string, CollectionEditor> = {};
  for (const module of modules) {
    Object.assign(editors, module.collectionEditors ?? {});
  }
  return editors;
}

export function firstAccessibleRoute(
  modules: AdminModule[],
  permissions?: AdminPermissions,
): string {
  const navItem = collectAdminNavItems(modules, permissions)[0];
  if (navItem) return navItem.routeId;
  for (const module of modules) {
    const route = module.routes.find((candidate) =>
      canAccessAdminPermission(permissions, candidate.permission)
    );
    if (route) return route.id;
  }
  return "overview";
}
