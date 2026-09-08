import React from "react";
import { BarChart3 } from "lucide-react";
import { UsageAnalytics } from "@copilotz/usage";
import type { AdminModule, AdminRuntimeContext } from "../../core/types";

export function usageModule(): AdminModule {
  return {
    group: "operate",
    icon: BarChart3,
    id: "usage",
    label: "Usage",
    navItems: [{
      group: "operate",
      icon: BarChart3,
      id: "usage",
      label: "Usage",
      order: 20,
      routeId: "usage",
    }],
    routes: [{
      id: "usage",
      title: "Usage",
      render: (context) => <UsagePage context={context} />,
    }],
  };
}

function UsagePage({ context }: { context: AdminRuntimeContext }) {
  return (
    <UsageAnalytics
      source={context.client.getUsageDataSource()}
      refreshKey={context.refreshKey}
      onOpenThread={(threadId) =>
        context.navigate("threads.detail", { threadId })}
    />
  );
}
