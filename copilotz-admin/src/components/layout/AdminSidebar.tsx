import React from "react";
import {
  LayoutDashboard,
  MessageSquare,
  Users,
  Bot,
  Activity,
  Database,
  ChevronsUpDown,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from "../ui/sidebar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import type { AdminPage, AdminRoute, ResolvedAdminConfig } from "../../types";

interface NavItem {
  page: AdminPage;
  label: string;
  icon: React.ElementType;
  featureKey?: keyof ResolvedAdminConfig["features"];
}

const NAV_ITEMS: NavItem[] = [
  { page: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { page: "threads", label: "Threads", icon: MessageSquare, featureKey: "showThreads" },
  { page: "participants", label: "Participants", icon: Users, featureKey: "showParticipants" },
  { page: "agents", label: "Agents", icon: Bot, featureKey: "showAgents" },
  { page: "events", label: "Events", icon: Activity, featureKey: "showEvents" },
];

export interface AdminSidebarProps {
  config: ResolvedAdminConfig;
  currentPage: AdminPage;
  currentRoute: AdminRoute;
  onNavigate: (page: AdminPage) => void;
  onNavigateRoute: (route: AdminRoute) => void;
  collections: string[];
  namespace: string;
  onNamespaceChange: (namespace: string) => void;
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({
  config,
  currentPage,
  currentRoute,
  onNavigate,
  onNavigateRoute,
  collections,
  namespace,
  onNamespaceChange,
}) => {
  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.featureKey || config.features[item.featureKey],
  );

  const showCollections = config.features.showCollections && collections.length > 0;

  return (
    <Sidebar collapsible={config.sidebar.collapsible}>
      <SidebarHeader>
        <div className="flex items-center gap-3 px-2 py-3">
          <div className="flex items-center justify-center shrink-0">
            {config.branding.logo || (
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <LayoutDashboard className="h-4 w-4" />
              </div>
            )}
          </div>
          <div className="flex flex-col min-w-0 group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-semibold truncate">
              {config.branding.title}
            </span>
            {config.branding.subtitle && (
              <span className="text-xs text-muted-foreground truncate">
                {config.branding.subtitle}
              </span>
            )}
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {/* Main navigation */}
        <SidebarGroup>
          <SidebarGroupLabel className="group-data-[collapsible=icon]:hidden">
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visibleItems.map((item) => {
                const Icon = item.icon;
                const label =
                  config.labels[`${item.page}Title` as keyof typeof config.labels] ||
                  item.label;
                return (
                  <SidebarMenuItem key={item.page}>
                    <SidebarMenuButton
                      isActive={currentPage === item.page}
                      onClick={() => onNavigate(item.page)}
                      tooltip={label}
                    >
                      <Icon />
                      <span>{label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Dynamic collections */}
        {showCollections && (
          <>
            <SidebarSeparator />
            <SidebarGroup>
              <SidebarGroupLabel className="group-data-[collapsible=icon]:hidden">
                {config.labels.collectionsTitle}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {collections.map((col) => (
                    <SidebarMenuItem key={col}>
                      <SidebarMenuButton
                        isActive={
                          currentRoute.page === "collection-items" &&
                          currentRoute.collection === col
                        }
                        onClick={() =>
                          onNavigateRoute({ page: "collection-items", collection: col })
                        }
                        tooltip={col}
                      >
                        <Database />
                        <span className="capitalize">{col}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>

      <SidebarFooter>
        {/* Namespace selector */}
        <div className="group-data-[collapsible=icon]:hidden">
          <label className="text-xs font-medium text-muted-foreground mb-1 block px-2">
            Namespace
          </label>
          <Select value={namespace || "__all__"} onValueChange={(v) => onNamespaceChange(v === "__all__" ? "" : v)}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="All namespaces" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All namespaces</SelectItem>
              {config.namespace && (
                <SelectItem value={config.namespace}>{config.namespace}</SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
        <div className="hidden group-data-[collapsible=icon]:flex justify-center">
          <ChevronsUpDown className="h-4 w-4 text-muted-foreground" />
        </div>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
};
