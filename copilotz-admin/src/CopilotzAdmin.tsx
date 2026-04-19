import React, {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";
import { defaultAdminConfig, mergeAdminConfig } from "./config";
import { useCopilotzAdmin } from "./useCopilotzAdmin";
import { fetchCollectionNames } from "./adminService";
import { cn } from "./lib/utils";
import { Card, CardContent } from "./components/ui/card";
import { Button } from "./components/ui/button";
import { TooltipProvider } from "./components/ui/tooltip";
import { SidebarProvider, SidebarInset } from "./components/ui/sidebar";
import { AdminSidebar } from "./components/layout/AdminSidebar";
import { AdminHeader } from "./components/layout/AdminHeader";
import { DashboardView } from "./components/views/DashboardView";
import { ThreadsView } from "./components/views/ThreadsView";
import { ThreadDetailView } from "./components/views/ThreadDetailView";
import { ParticipantsView } from "./components/views/ParticipantsView";
import { ParticipantDetailView } from "./components/views/ParticipantDetailView";
import { AgentsView } from "./components/views/AgentsView";
import { AgentDetailView } from "./components/views/AgentDetailView";
import { CollectionItemsView } from "./components/views/CollectionItemsView";
import { CollectionItemDetailView } from "./components/views/CollectionItemDetailView";
import { EventsView } from "./components/views/EventsView";
import type {
  AdminConfig,
  AdminPage,
  AdminRoute,
} from "./types";

export interface CopilotzAdminProps {
  config?: Partial<AdminConfig>;
  className?: string;
}

export const CopilotzAdmin: React.FC<CopilotzAdminProps> = ({
  config: userConfig,
  className,
}) => {
  const config = useMemo(
    () => mergeAdminConfig(defaultAdminConfig, userConfig),
    [userConfig],
  );

  const [route, setRoute] = useState<AdminRoute>({ page: config.defaultPage });
  const [namespace, setNamespace] = useState(config.namespace);
  const [collections, setCollections] = useState<string[]>([]);

  const [threadSearch, setThreadSearch] = useState("");
  const [participantSearch, setParticipantSearch] = useState("");
  const [agentSearch, setAgentSearch] = useState("");
  const deferredThreadSearch = useDeferredValue(threadSearch);
  const deferredParticipantSearch = useDeferredValue(participantSearch);
  const deferredAgentSearch = useDeferredValue(agentSearch);

  const admin = useCopilotzAdmin({
    baseUrl: config.baseUrl,
    getRequestHeaders: config.getRequestHeaders,
    namespace,
    range: config.initialRange,
    interval: config.initialInterval,
    threadSearch: deferredThreadSearch,
    participantSearch: deferredParticipantSearch,
    agentSearch: deferredAgentSearch,
  });

  useEffect(() => {
    if (!config.features.showCollections) return;
    fetchCollectionNames({
      baseUrl: config.baseUrl,
      getRequestHeaders: config.getRequestHeaders,
    })
      .then(setCollections)
      .catch(() => setCollections([]));
  }, [config.baseUrl, config.getRequestHeaders, config.features.showCollections]);

  const navigate = useCallback(
    (next: AdminRoute) => {
      setRoute(next);
      config.onNavigate?.(next);
    },
    [config],
  );

  const handleSidebarNavigate = useCallback(
    (page: AdminPage) => navigate({ page }),
    [navigate],
  );

  const handleSidebarRouteNavigate = useCallback(
    (r: AdminRoute) => navigate(r),
    [navigate],
  );

  // --- Navigation helpers ---
  const handleThreadClick = useCallback(
    (threadId: string) => navigate({ page: "thread-detail", resourceId: threadId }),
    [navigate],
  );
  const handleBackToThreads = useCallback(() => navigate({ page: "threads" }), [navigate]);

  const handleParticipantClick = useCallback(
    (id: string) => navigate({ page: "participant-detail", resourceId: id }),
    [navigate],
  );
  const handleBackToParticipants = useCallback(() => navigate({ page: "participants" }), [navigate]);

  const handleAgentClick = useCallback(
    (id: string) => navigate({ page: "agent-detail", resourceId: id }),
    [navigate],
  );
  const handleBackToAgents = useCallback(() => navigate({ page: "agents" }), [navigate]);

  const handleCollectionItemClick = useCallback(
    (itemId: string) => navigate({ page: "collection-item-detail", resourceId: itemId, collection: route.collection }),
    [navigate, route.collection],
  );
  const handleCollectionCreateNew = useCallback(
    () => navigate({ page: "collection-item-detail", resourceId: undefined, collection: route.collection }),
    [navigate, route.collection],
  );
  const handleBackToCollectionItems = useCallback(
    () => navigate({ page: "collection-items", collection: route.collection }),
    [navigate, route.collection],
  );

  // Sidebar highlighting — detail pages highlight their parent
  const sidebarPage = (() => {
    switch (route.page) {
      case "thread-detail": return "threads" as AdminPage;
      case "participant-detail": return "participants" as AdminPage;
      case "agent-detail": return "agents" as AdminPage;
      case "collection-item-detail": return "collection-items" as AdminPage;
      default: return route.page;
    }
  })();

  if (admin.isLoading && !admin.overview) {
    return (
      <Card className={cn("border-border", className)}>
        <CardContent className="text-muted-foreground flex items-center justify-center min-h-[200px]">
          {config.labels.loading}
        </CardContent>
      </Card>
    );
  }

  if (admin.error && !admin.overview) {
    return (
      <Card className={cn("border-destructive/50 bg-destructive/10", className)}>
        <CardContent className="space-y-4">
          <p className="text-base font-semibold text-destructive">{admin.error.message}</p>
          <Button variant="destructive" onClick={() => void admin.refresh()}>
            {config.labels.retry}
          </Button>
        </CardContent>
      </Card>
    );
  }

  const renderCurrentView = () => {
    switch (route.page) {
      case "dashboard":
        return (
          <DashboardView
            config={config}
            overview={admin.overview}
            activity={admin.activity}
            threads={admin.threads}
            participants={admin.participants}
            agents={admin.agents}
            interval={admin.filters.interval}
            threadSearch={threadSearch}
            participantSearch={participantSearch}
            agentSearch={agentSearch}
            onThreadSearchChange={setThreadSearch}
            onParticipantSearchChange={setParticipantSearch}
            onAgentSearchChange={setAgentSearch}
            onThreadClick={handleThreadClick}
          />
        );

      case "threads":
        return (
          <ThreadsView
            config={config}
            threads={admin.threads}
            searchValue={threadSearch}
            onSearchChange={setThreadSearch}
            onThreadClick={handleThreadClick}
          />
        );

      case "thread-detail":
        return route.resourceId ? (
          <ThreadDetailView threadId={route.resourceId} config={config} onBack={handleBackToThreads} />
        ) : null;

      case "participants":
        return (
          <ParticipantsView
            config={config}
            participants={admin.participants}
            searchValue={participantSearch}
            onSearchChange={setParticipantSearch}
            onParticipantClick={handleParticipantClick}
          />
        );

      case "participant-detail":
        return route.resourceId ? (
          <ParticipantDetailView participantId={route.resourceId} config={config} onBack={handleBackToParticipants} />
        ) : null;

      case "agents":
        return (
          <AgentsView
            config={config}
            agents={admin.agents}
            searchValue={agentSearch}
            onSearchChange={setAgentSearch}
            onAgentClick={handleAgentClick}
          />
        );

      case "agent-detail":
        return route.resourceId ? (
          <AgentDetailView agentId={route.resourceId} config={config} agents={admin.agents} onBack={handleBackToAgents} />
        ) : null;

      case "collection-items":
        return route.collection ? (
          <CollectionItemsView
            collection={route.collection}
            config={config}
            namespace={namespace}
            onItemClick={handleCollectionItemClick}
            onCreateNew={handleCollectionCreateNew}
          />
        ) : null;

      case "collection-item-detail":
        return route.collection ? (
          <CollectionItemDetailView
            collection={route.collection}
            itemId={route.resourceId ?? null}
            config={config}
            namespace={namespace}
            onBack={handleBackToCollectionItems}
          />
        ) : null;

      case "events":
        return <EventsView config={config} />;

      default:
        return null;
    }
  };

  return (
    <TooltipProvider>
      <SidebarProvider defaultOpen={config.sidebar.defaultOpen}>
        <div
          className={cn(
            "flex h-[100svh] md:h-screen bg-background w-full overflow-hidden",
            className,
          )}
        >
          <AdminSidebar
            config={config}
            currentPage={sidebarPage}
            currentRoute={route}
            onNavigate={handleSidebarNavigate}
            onNavigateRoute={handleSidebarRouteNavigate}
            collections={collections}
            namespace={namespace}
            onNamespaceChange={setNamespace}
          />

          <SidebarInset>
            <div className="flex flex-col h-full min-h-0">
              <AdminHeader
                config={config}
                currentRoute={route}
                range={admin.filters.range}
                interval={admin.filters.interval}
                onRangeChange={admin.setRange}
                onIntervalChange={admin.setInterval}
                onRefresh={() => void admin.refresh()}
                isLoading={admin.isLoading}
              />

              <div className="flex-1 overflow-auto p-6">
                {renderCurrentView()}
              </div>
            </div>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </TooltipProvider>
  );
};
