import React from "react";
import { RefreshCw } from "lucide-react";
import { Card, CardHeader } from "../ui/card";
import { Button } from "../ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { SidebarTrigger } from "../ui/sidebar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import type {
  AdminDatePreset,
  AdminActivityInterval,
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
  range: AdminDatePreset;
  interval: AdminActivityInterval;
  onRangeChange: (range: AdminDatePreset) => void;
  onIntervalChange: (interval: AdminActivityInterval) => void;
  onRefresh: () => void;
  isLoading?: boolean;
}

export const AdminHeader: React.FC<AdminHeaderProps> = ({
  config,
  currentRoute,
  range,
  interval,
  onRangeChange,
  onIntervalChange,
  onRefresh,
  isLoading,
}) => {
  let pageTitle =
    config.labels[`${currentRoute.page}Title` as keyof typeof config.labels] ||
    PAGE_TITLES[currentRoute.page] ||
    currentRoute.page;

  if (currentRoute.page === "collection-items" && currentRoute.collection) {
    pageTitle = currentRoute.collection.charAt(0).toUpperCase() + currentRoute.collection.slice(1);
  }

  return (
    <Card className="py-0 border-b rounded-none relative z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <CardHeader className="p-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <SidebarTrigger className="-ml-1" />
              </TooltipTrigger>
              <TooltipContent>Toggle Sidebar</TooltipContent>
            </Tooltip>
            <h1 className="text-sm font-medium ml-2">{pageTitle}</h1>
          </div>

          <div className="flex-1" />

          <div className="flex items-center gap-1">
            {currentRoute.page === "dashboard" && (
              <>
                <Button
                  variant={range === "24h" ? "default" : "ghost"}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => onRangeChange("24h")}
                >
                  {config.labels.range24h}
                </Button>
                <Button
                  variant={range === "7d" ? "default" : "ghost"}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => onRangeChange("7d")}
                >
                  {config.labels.range7d}
                </Button>
                <Button
                  variant={range === "30d" ? "default" : "ghost"}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => onRangeChange("30d")}
                >
                  {config.labels.range30d}
                </Button>

                <Select
                  value={interval}
                  onValueChange={(v) =>
                    onIntervalChange(v as AdminActivityInterval)
                  }
                >
                  <SelectTrigger className="h-7 w-[90px] text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hour">
                      {config.labels.intervalHour}
                    </SelectItem>
                    <SelectItem value="day">
                      {config.labels.intervalDay}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </>
            )}

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
