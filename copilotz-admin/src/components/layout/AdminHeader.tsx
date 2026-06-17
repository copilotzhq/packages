import React from "react";
import { RefreshCw } from "lucide-react";
import { Card, CardHeader } from "../ui/card";
import { Button } from "../ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { SidebarTrigger } from "../ui/sidebar";
import type {
  AdminPage,
  AdminRoute,
  ResolvedAdminConfig,
} from "../../types";

const PAGE_TITLES: Record<string, string> = {
  dashboard: "Dashboard",
  threads: "Threads",
  "thread-detail": "Thread Detail",
  participants: "Participants",
  "participant-detail": "Participant Detail",
  agents: "Agents",
  "agent-detail": "Agent Detail",
  "collection-items": "Collection",
  "collection-item-detail": "Item Detail",
  events: "Events",
};

export interface AdminHeaderProps {
  config: ResolvedAdminConfig;
  currentRoute: AdminRoute;
  onRefresh: () => void;
  isLoading?: boolean;
  controls?: React.ReactNode;
}

export const AdminHeader: React.FC<AdminHeaderProps> = ({
  config,
  currentRoute,
  onRefresh,
  isLoading,
  controls,
}) => {
  let pageTitle =
    config.labels[`${currentRoute.page}Title` as keyof typeof config.labels] ||
    PAGE_TITLES[currentRoute.page] ||
    currentRoute.page;

  if (currentRoute.page === "collection-items" && currentRoute.collection) {
    pageTitle = currentRoute.collection.charAt(0).toUpperCase() + currentRoute.collection.slice(1);
  }

  return (
    <Card className="py-0 border-b rounded-none relative z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 shadow-none">
      <CardHeader className="px-3 py-2">
        <div className="flex min-h-10 flex-wrap items-center gap-2">
          <div className="flex min-w-0 items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <SidebarTrigger className="-ml-1" />
              </TooltipTrigger>
              <TooltipContent>Toggle Sidebar</TooltipContent>
            </Tooltip>
            <h1 className="ml-2 whitespace-nowrap text-sm font-medium">
              {pageTitle}
            </h1>
          </div>

          {controls && (
            <div className="flex min-w-[240px] flex-1 items-center justify-end gap-2 overflow-x-auto">
              {controls}
            </div>
          )}

          <div className="ml-auto flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={onRefresh}
                  disabled={isLoading}
                >
                  <RefreshCw
                    className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
                  />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{config.labels.refresh}</TooltipContent>
            </Tooltip>

            {config.branding.actions}
          </div>
        </div>
      </CardHeader>
    </Card>
  );
};
