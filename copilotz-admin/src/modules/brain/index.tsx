import React from "react";
import {
  BookOpen,
  Brain,
  GitBranch,
  RefreshCw,
  Search,
  Sparkles,
  UsersRound,
} from "lucide-react";
import type {
  AdminBrainCluster,
  AdminBrainMatch,
  AdminBrainNode,
  AdminBrainRelated,
  AdminBrainResponse,
  AdminBrainSearchMode,
  AdminBrainSimilar,
} from "../../api/types";
import type { AdminModule, AdminRuntimeContext } from "../../core/types";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select";
import {
  EmptyState,
  FilterBar,
  InspectorPanel,
  JsonPanel,
  MetricStrip,
  PageHeader,
  ResourceTable,
  StatusBadge,
} from "../../components/patterns";
import { cn } from "../../lib/utils";
import {
  BRAIN_VIEW_LABELS,
  ENTITY_FOCUS_RELATION_TYPES,
  getBrainViewBaseFilters,
  getKnowledgeRelationGroups,
  getWorkRelationGroups,
  groupBrainRelationsByKind,
  type AdminBrainRelationGroup,
  type AdminBrainView,
} from "./view-model";

const BRAIN_LAYERS = ["all", "knowledge", "working"] as const;
const BRAIN_SEARCH_MODES = ["hybrid", "semantic", "keyword"] as const;
const BRAIN_STATUSES = ["active", "all", "superseded", "archived"] as const;
const BRAIN_VIEWS: AdminBrainView[] = [
  "entities",
  "knowledge",
  "work",
  "map",
  "all",
];
const BRAIN_KINDS = [
  "all",
  "entity",
  "decision",
  "fact",
  "preference",
  "task",
  "constraint",
  "current_state",
  "challenge",
  "risk",
  "open_question",
  "next_action",
] as const;

export function brainModule(): AdminModule {
  return {
    group: "data",
    icon: Brain,
    id: "brain",
    label: "Brain",
    navItems: [{
      group: "data",
      icon: Brain,
      id: "brain",
      label: "Brain",
      order: 10,
      routeId: "brain",
    }],
    routes: [{
      id: "brain",
      title: "Brain",
      render: (context) => <BrainPage context={context} />,
    }],
  };
}

function BrainPage({ context }: { context: AdminRuntimeContext }) {
  const [view, setView] = React.useState<AdminBrainView>("entities");
  const [search, setSearch] = React.useState("");
  const [searchMode, setSearchMode] = React.useState<AdminBrainSearchMode>(
    "hybrid",
  );
  const [layer, setLayer] = React.useState<typeof BRAIN_LAYERS[number]>("all");
  const [status, setStatus] = React.useState<typeof BRAIN_STATUSES[number]>(
    "active",
  );
  const [kind, setKind] = React.useState<typeof BRAIN_KINDS[number]>("all");
  const [agentId, setAgentId] = React.useState("");
  const [response, setResponse] = React.useState<AdminBrainResponse | null>(
    null,
  );
  const [selectedNode, setSelectedNode] = React.useState<AdminBrainNode | null>(
    null,
  );
  const [focusNodeId, setFocusNodeId] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const loadBrain = React.useCallback(async (focusOverride?: string | null) => {
    setLoading(true);
    setError(null);
    const effectiveFocusNodeId = focusOverride === undefined
      ? focusNodeId
      : focusOverride;
    const viewFilters = getBrainViewBaseFilters(view);
    const effectiveLayer = view === "map" || view === "all"
      ? layer
      : viewFilters.layer;
    const effectiveKind = view === "entities" ? "entity" : kind;
    try {
      const next = await context.client.getBrain({
        namespace: context.scope.namespace || undefined,
        search: search.trim() || undefined,
        searchMode,
        layer: effectiveLayer,
        status,
        kind: effectiveKind,
        agentId: agentId.trim() || undefined,
        focusNodeId: effectiveFocusNodeId || undefined,
        includeRelated: Boolean(effectiveFocusNodeId),
        includeSimilar: Boolean(effectiveFocusNodeId),
        similarLimit: 24,
        minSimilarity: 0.2,
        relationTypes: effectiveFocusNodeId
          ? [...ENTITY_FOCUS_RELATION_TYPES]
          : undefined,
        limit: 180,
      });
      setResponse(next);
      setSelectedNode((current) => {
        const currentInResults = current
          ? next.nodes.find((node) => node.id === current.id) ?? current
          : null;
        if (effectiveFocusNodeId) {
          return next.nodes.find((node) => node.id === effectiveFocusNodeId) ??
            currentInResults;
        }
        if (view === "entities") {
          return current && next.nodes.some((node) => node.id === current.id)
            ? currentInResults
            : null;
        }
        return current && next.nodes.some((node) => node.id === current.id)
          ? currentInResults
          : next.nodes[0] ?? null;
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to load brain");
      setResponse(null);
      setSelectedNode(null);
    } finally {
      setLoading(false);
    }
  }, [
    agentId,
    context.client,
    context.scope.namespace,
    focusNodeId,
    kind,
    layer,
    search,
    searchMode,
    status,
    view,
  ]);

  React.useEffect(() => {
    void loadBrain();
  }, [context.refreshKey, context.scope.namespace, focusNodeId, loadBrain]);

  const data = response ?? emptyBrainResponse();
  const matches = data.matches ?? {};
  const related = data.related ?? [];
  const similar = data.similar ?? [];
  const entityCount = data.stats.byKind.entity ??
    data.nodes.filter((node) => node.kind === "entity").length;
  const knowledgeCount = data.stats.byLayer.knowledge ?? 0;
  const workingCount = data.stats.byLayer.working ?? 0;
  const selectNode = React.useCallback((node: AdminBrainNode) => {
    setSelectedNode(node);
    setFocusNodeId(node.id);
  }, []);
  const selectView = React.useCallback((nextView: AdminBrainView) => {
    setView(nextView);
    setFocusNodeId(null);
    setSelectedNode(null);
  }, []);
  const runSearch = React.useCallback(() => {
    setFocusNodeId(null);
    setSelectedNode(null);
    void loadBrain(null);
  }, [loadBrain]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Brain"
        description="Unified knowledge and working state for the active namespace."
        badges={[
          {
            label: context.scope.namespace ?? "all namespaces",
            variant: "secondary",
          },
        ]}
        actions={
          <Button
            disabled={loading}
            onClick={() => void loadBrain()}
            size="sm"
            type="button"
            variant="outline"
          >
            <RefreshCw className={cn("size-3", loading && "animate-spin")} />
            Refresh
          </Button>
        }
      />

      <MetricStrip
        items={[
          {
            label: "Entities",
            value: entityCount,
            detail: view === "entities"
              ? `${data.pageInfo.returned} shown`
              : "Stable anchors",
            icon: UsersRound,
          },
          {
            label: "Knowledge",
            value: knowledgeCount,
            detail: "Durable nodes",
            icon: BookOpen,
          },
          {
            label: "Working",
            value: workingCount,
            detail: "Current state",
            icon: Sparkles,
          },
          {
            label: selectedNode ? "Focus links" : "Brain nodes",
            value: selectedNode ? related.length + similar.length : data.stats.total,
            detail: selectedNode ? "Related and similar" : `${data.pageInfo.returned} shown`,
            icon: selectedNode ? GitBranch : Brain,
          },
        ]}
      />

      <div className="inline-flex max-w-full overflow-hidden rounded-md border bg-background">
        {BRAIN_VIEWS.map((item) => (
          <button
            className={cn(
              "min-w-0 px-3 py-2 text-xs transition-colors sm:px-4",
              view === item
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted",
            )}
            key={item}
            onClick={() => selectView(item)}
            type="button"
          >
            {BRAIN_VIEW_LABELS[item]}
          </button>
        ))}
      </div>

      <FilterBar
        actions={
          <Button
            disabled={loading}
            onClick={runSearch}
            size="sm"
            type="button"
          >
            <Search className="size-3" />
            Search
          </Button>
        }
        onSearchChange={setSearch}
        searchPlaceholder={view === "entities"
          ? "Search entities"
          : "Search brain"}
        searchValue={search}
      >
        <div className="inline-flex h-8 overflow-hidden rounded-md border bg-background">
          {BRAIN_SEARCH_MODES.map((mode) => (
            <button
              className={cn(
                "px-3 text-xs transition-colors",
                searchMode === mode
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted",
              )}
              key={mode}
              onClick={() => setSearchMode(mode)}
              type="button"
            >
              {formatLabel(mode)}
            </button>
          ))}
        </div>
        {view === "map" || view === "all"
          ? (
            <Select
              value={layer}
              onValueChange={(value) =>
                setLayer(value as typeof BRAIN_LAYERS[number])}
            >
              <SelectTrigger
                className="h-8 w-[140px] text-xs"
                aria-label="Layer"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BRAIN_LAYERS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option === "all" ? "All layers" : formatLabel(option)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )
          : null}
        <Select
          value={status}
          onValueChange={(value) =>
            setStatus(value as typeof BRAIN_STATUSES[number])}
        >
          <SelectTrigger className="h-8 w-[140px] text-xs" aria-label="Status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BRAIN_STATUSES.map((option) => (
              <SelectItem key={option} value={option}>
                {option === "all" ? "All statuses" : formatLabel(option)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {view !== "entities"
          ? (
            <Select
              value={kind}
              onValueChange={(value) =>
                setKind(value as typeof BRAIN_KINDS[number])}
            >
              <SelectTrigger
                className="h-8 w-[170px] text-xs"
                aria-label="Kind"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BRAIN_KINDS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option === "all" ? "All kinds" : formatLabel(option)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )
          : (
            <Badge className="h-8 px-3" variant="secondary">
              Entity index
            </Badge>
          )}
        <Input
          className="h-8 w-[190px]"
          onChange={(event) => setAgentId(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") runSearch();
          }}
          placeholder="Agent ID"
          value={agentId}
        />
      </FilterBar>

      {data.semantic?.requested && data.semantic.error
        ? (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            Semantic search unavailable: {data.semantic.error}
          </div>
        )
        : null}

      {error
        ? <EmptyState title="Unable to load brain" description={error} />
        : (
          <InspectorPanel
            side={selectedNode
              ? (
                <BrainNodeInspector
                  match={matches[selectedNode.id]}
                  node={selectedNode}
                  onSelectNode={selectNode}
                  related={related}
                  similar={similar}
                />
              )
              : (
                <EmptyState
                  icon={Brain}
                  title="No node selected"
                  description="Select a node from the map or table."
                />
              )}
          >
            <div className="space-y-4">
              <BrainPrimaryContent
                data={data}
                loading={loading}
                matches={matches}
                onSelectNode={selectNode}
                related={related}
                selectedNode={selectedNode}
                similar={similar}
                view={view}
              />
            </div>
          </InspectorPanel>
        )}
    </div>
  );
}

function BrainPrimaryContent({
  data,
  loading,
  matches,
  onSelectNode,
  related,
  selectedNode,
  similar,
  view,
}: {
  data: AdminBrainResponse;
  loading: boolean;
  matches: Record<string, AdminBrainMatch>;
  onSelectNode: (node: AdminBrainNode) => void;
  related: AdminBrainRelated[];
  selectedNode: AdminBrainNode | null;
  similar: AdminBrainSimilar[];
  view: AdminBrainView;
}) {
  if (view === "entities") {
    return (
      <div className="space-y-4">
        <EntityEgoGraph
          entity={selectedNode?.kind === "entity" ? selectedNode : null}
          loading={loading}
          onSelectNode={onSelectNode}
          related={related}
          similar={similar}
        />
        <BrainNodeTable
          emptyDescription="Entity nodes will appear here once the Brain has named people, tenants, projects, products, tools, policies, or concepts."
          emptyTitle={loading ? "Loading entities" : "No entities yet"}
          loading={loading}
          matches={matches}
          nodes={data.nodes}
          onSelectNode={onSelectNode}
          variant="entities"
        />
      </div>
    );
  }

  if (view === "map") {
    return (
      <div className="space-y-4">
        <BrainMap
          clusters={data.clusters}
          edges={data.edges}
          loading={loading}
          nodes={data.nodes}
          onSelectNode={onSelectNode}
          similar={similar}
          selectedNodeId={selectedNode?.id ?? null}
        />
        <BrainNodeTable
          emptyDescription="Knowledge and working-state nodes will appear here."
          emptyTitle={loading ? "Loading brain" : "No brain nodes"}
          loading={loading}
          matches={matches}
          nodes={data.nodes}
          onSelectNode={onSelectNode}
        />
      </div>
    );
  }

  return (
    <BrainNodeTable
      emptyDescription={view === "work"
        ? "Working-state nodes will appear here when the Brain captures current challenges, tasks, risks, and open questions."
        : view === "knowledge"
        ? "Durable facts, decisions, preferences, constraints, and entities will appear here."
        : "Knowledge and working-state nodes will appear here."}
      emptyTitle={loading
        ? `Loading ${BRAIN_VIEW_LABELS[view].toLowerCase()}`
        : `No ${BRAIN_VIEW_LABELS[view].toLowerCase()}`}
      loading={loading}
      matches={matches}
      nodes={data.nodes}
      onSelectNode={onSelectNode}
    />
  );
}

function BrainNodeTable({
  emptyDescription,
  emptyTitle,
  loading,
  matches,
  nodes,
  onSelectNode,
  variant = "default",
}: {
  emptyDescription: string;
  emptyTitle: string;
  loading: boolean;
  matches: Record<string, AdminBrainMatch>;
  nodes: AdminBrainNode[];
  onSelectNode: (node: AdminBrainNode) => void;
  variant?: "default" | "entities";
}) {
  return (
    <ResourceTable
      rows={nodes}
      getRowKey={(row) => row.id}
      onRowClick={onSelectNode}
      empty={
        <EmptyState
          icon={variant === "entities" ? UsersRound : Brain}
          title={emptyTitle}
          description={loading
            ? "Fetching Brain nodes for the active namespace."
            : emptyDescription}
        />
      }
      columns={[
        {
          id: "node",
          header: variant === "entities" ? "Entity" : "Node",
          className: "max-w-[420px]",
          render: (row) => (
            <div className="min-w-0">
              <div className="truncate font-medium">{row.name}</div>
              <div className="truncate text-xs text-muted-foreground">
                {row.content || "-"}
              </div>
              <MatchBadges match={matches[row.id]} />
            </div>
          ),
        },
        ...(variant === "entities"
          ? [{
            id: "updated",
            header: "Updated",
            className: "whitespace-nowrap text-xs",
            render: (row: AdminBrainNode) => formatDateTime(row.updatedAt),
          }]
          : [{
            id: "layer",
            header: "Layer",
            render: (row: AdminBrainNode) => <LayerBadge layer={row.layer} />,
          }, {
            id: "kind",
            header: "Kind",
            render: (row: AdminBrainNode) => formatLabel(row.kind),
          }]),
        {
          id: "status",
          header: "Status",
          render: (row) => <StatusBadge status={row.status} />,
        },
        {
          id: "agent",
          header: "Agent",
          className: "max-w-[160px] truncate font-mono text-xs",
          render: (row) => row.agentId ?? "-",
        },
      ]}
    />
  );
}

function EntityEgoGraph({
  entity,
  loading,
  onSelectNode,
  related,
  similar,
}: {
  entity: AdminBrainNode | null;
  loading: boolean;
  onSelectNode: (node: AdminBrainNode) => void;
  related: AdminBrainRelated[];
  similar: AdminBrainSimilar[];
}) {
  if (!entity) {
    return (
      <div className="flex min-h-[300px] items-center justify-center rounded-lg border bg-background">
        <EmptyState
          icon={UsersRound}
          title={loading ? "Loading entity workspace" : "Select an entity"}
          description={loading
            ? "Fetching entity nodes for the active namespace."
            : "Choose an entity to see its explicit relations and semantic neighbors."}
        />
      </div>
    );
  }

  const relatedItems = related.slice(0, 18);
  const similarItems = similar.slice(0, 10);
  const orbitCount = relatedItems.length + similarItems.length;
  const center = { x: 500, y: 260 };
  const radius = orbitCount > 12 ? 190 : 165;
  const orbitNodes = [
    ...relatedItems.map((item, index) => ({
      id: item.edge.id,
      index,
      node: item.node,
      tone: "relation" as const,
      label: formatLabel(item.edge.type),
    })),
    ...similarItems.map((item, index) => ({
      id: `similar-${item.node.id}`,
      index: index + relatedItems.length,
      node: item.node,
      tone: "similar" as const,
      label: formatSimilarityScore(item.similarity),
    })),
  ].map((item) => {
    const angle = orbitCount > 0
      ? (Math.PI * 2 * item.index) / orbitCount - Math.PI / 2
      : 0;
    return {
      ...item,
      x: center.x + Math.cos(angle) * radius,
      y: center.y + Math.sin(angle) * radius,
    };
  });

  return (
    <div className="overflow-hidden rounded-lg border bg-background">
      <div className="grid gap-0 lg:grid-cols-[minmax(0,1.5fr)_320px]">
        <svg
          className="block h-[380px] w-full bg-muted/20"
          role="img"
          viewBox="0 0 1000 520"
        >
          <rect fill="transparent" height="520" width="1000" />
          {orbitNodes.map((item) => (
            <line
              key={`line-${item.id}`}
              stroke={item.tone === "similar" ? "#0ea5e9" : "#64748b"}
              strokeDasharray={item.tone === "similar" ? "6 7" : undefined}
              strokeOpacity={item.tone === "similar" ? "0.48" : "0.38"}
              strokeWidth={item.tone === "similar" ? "1.8" : "2.2"}
              x1={center.x}
              x2={item.x}
              y1={center.y}
              y2={item.y}
            />
          ))}
          <circle
            cx={center.x}
            cy={center.y}
            fill={nodeColor(entity)}
            r="22"
            stroke="#0f172a"
            strokeWidth="3"
          >
            <title>{entity.name}</title>
          </circle>
          {orbitNodes.map((item) => (
            <g
              className="cursor-pointer"
              key={item.id}
              onClick={() => onSelectNode(item.node)}
            >
              <circle
                cx={item.x}
                cy={item.y}
                fill={nodeColor(item.node)}
                r={item.tone === "similar" ? 9 : 11}
                stroke={item.tone === "similar" ? "#0ea5e9" : "#ffffff"}
                strokeWidth="2"
              >
                <title>
                  {`${item.node.name} · ${formatLabel(item.node.kind)} · ${item.label}`}
                </title>
              </circle>
            </g>
          ))}
        </svg>
        <div className="border-t p-4 lg:border-l lg:border-t-0">
          <div className="flex flex-wrap items-center gap-2">
            <LayerBadge layer={entity.layer} />
            <StatusBadge status={entity.status} />
            <Badge variant="outline">Entity</Badge>
          </div>
          <h3 className="mt-3 truncate text-base font-semibold">
            {entity.name}
          </h3>
          <p className="mt-2 line-clamp-4 text-sm leading-6 text-muted-foreground">
            {entity.content || "-"}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-md border bg-muted/20 p-3">
              <div className="text-muted-foreground">Explicit</div>
              <div className="mt-1 text-lg font-semibold">
                {related.length}
              </div>
            </div>
            <div className="rounded-md border bg-muted/20 p-3">
              <div className="text-muted-foreground">Semantic</div>
              <div className="mt-1 text-lg font-semibold">
                {similar.length}
              </div>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            <div className="text-xs font-medium text-muted-foreground">
              Knowledge orbit
            </div>
            {groupBrainRelationsByKind(related).slice(0, 5).map((group) => (
              <div
                className="flex items-center justify-between gap-3 text-xs"
                key={group.id}
              >
                <span className="truncate">{group.label}</span>
                <Badge variant="secondary">{group.items.length}</Badge>
              </div>
            ))}
            {related.length === 0 && similar.length === 0
              ? (
                <p className="text-xs leading-5 text-muted-foreground">
                  Select an entity with relations or embeddings to see its
                  neighborhood.
                </p>
              )
              : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function BrainMap({
  clusters,
  edges,
  loading,
  nodes,
  onSelectNode,
  similar,
  selectedNodeId,
}: {
  clusters: AdminBrainCluster[];
  edges: AdminBrainResponse["edges"];
  loading: boolean;
  nodes: AdminBrainNode[];
  onSelectNode: (node: AdminBrainNode) => void;
  similar: AdminBrainSimilar[];
  selectedNodeId: string | null;
}) {
  const nodeById = React.useMemo(
    () => new Map(nodes.map((node) => [node.id, node])),
    [nodes],
  );

  if (nodes.length === 0) {
    return (
      <div className="flex min-h-[360px] items-center justify-center rounded-lg border bg-background">
        <EmptyState
          icon={Brain}
          title={loading ? "Loading map" : "No map data"}
          description={loading
            ? "Building the namespace brain map."
            : "The map will appear once brain nodes exist."}
        />
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border bg-background">
      <svg
        className="block h-[420px] w-full bg-muted/20"
        role="img"
        viewBox="0 0 1000 600"
      >
        <rect fill="transparent" height="600" width="1000" />
        {clusters.map((cluster) => (
          <g key={cluster.id}>
            <circle
              cx={cluster.x * 1000}
              cy={cluster.y * 600}
              fill={cluster.layer === "working" ? "#ecfeff" : "#eef2ff"}
              opacity="0.7"
              r={Math.max(46, Math.min(96, 34 + cluster.count * 8))}
              stroke={cluster.layer === "working" ? "#0891b2" : "#4f46e5"}
              strokeOpacity="0.18"
            />
            <text
              className="fill-muted-foreground text-[11px]"
              textAnchor="middle"
              x={cluster.x * 1000}
              y={cluster.y * 600 - 40}
            >
              {cluster.label}
            </text>
          </g>
        ))}
        {edges.map((edge) => {
          const source = nodeById.get(edge.sourceNodeId);
          const target = nodeById.get(edge.targetNodeId);
          if (!source || !target) return null;
          const isSelectedEdge = Boolean(
            selectedNodeId &&
              (edge.sourceNodeId === selectedNodeId ||
                edge.targetNodeId === selectedNodeId),
          );
          return (
            <line
              key={edge.id}
              stroke={edge.type === "contradicts" ? "#dc2626" : "#64748b"}
              strokeOpacity={isSelectedEdge ? "0.75" : "0.32"}
              strokeWidth={isSelectedEdge ? 2.6 : edge.type === "supports" ? 2 : 1.3}
              x1={source.x * 1000}
              x2={target.x * 1000}
              y1={source.y * 600}
              y2={target.y * 600}
            />
          );
        })}
        {selectedNodeId
          ? similar.map((item) => {
            const source = nodeById.get(selectedNodeId);
            const target = nodeById.get(item.node.id);
            if (!source || !target) return null;
            return (
              <line
                key={`similar-${item.node.id}`}
                stroke="#0ea5e9"
                strokeDasharray="5 6"
                strokeOpacity="0.42"
                strokeWidth="1.8"
                x1={source.x * 1000}
                x2={target.x * 1000}
                y1={source.y * 600}
                y2={target.y * 600}
              />
            );
          })
          : null}
        {nodes.map((node) => {
          const isSelected = node.id === selectedNodeId;
          return (
            <g
              className="cursor-pointer"
              key={node.id}
              onClick={() => onSelectNode(node)}
            >
              <circle
                cx={node.x * 1000}
                cy={node.y * 600}
                fill={nodeColor(node)}
                r={isSelected ? 9 : 6}
                stroke={isSelected ? "#0f172a" : "#ffffff"}
                strokeWidth={isSelected ? 3 : 2}
              >
                <title>{`${node.name} · ${formatLabel(node.kind)}`}</title>
              </circle>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

type InspectorTab =
  | "overview"
  | "knowledge"
  | "work"
  | "relations"
  | "similar"
  | "evidence"
  | "json";

function BrainNodeInspector({
  match,
  node,
  onSelectNode,
  related,
  similar,
}: {
  match?: AdminBrainMatch;
  node: AdminBrainNode;
  onSelectNode: (node: AdminBrainNode) => void;
  related: AdminBrainRelated[];
  similar: AdminBrainSimilar[];
}) {
  const [tab, setTab] = React.useState<InspectorTab>("overview");
  const isEntity = node.kind === "entity";
  const tabs: InspectorTab[] = isEntity
    ? ["overview", "knowledge", "work", "relations", "similar", "evidence", "json"]
    : ["overview", "relations", "similar", "evidence", "json"];

  React.useEffect(() => {
    setTab("overview");
  }, [node.id]);

  return (
    <div className="space-y-3">
      <div className="rounded-lg border bg-background p-4">
        <div className="flex flex-wrap items-center gap-2">
          <LayerBadge layer={node.layer} />
          <StatusBadge status={node.status} />
          <Badge variant="outline">{formatLabel(node.kind)}</Badge>
        </div>
        <h3 className="mt-3 text-base font-semibold">{node.name}</h3>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {node.content || "-"}
        </p>
        <MatchBadges match={match} />
      </div>

      <div className="inline-flex w-full overflow-hidden rounded-md border bg-background">
        {tabs.map((item) => (
          <button
            className={cn(
              "min-w-0 flex-1 px-2 py-2 text-xs transition-colors",
              tab === item
                ? "bg-muted font-medium text-foreground"
                : "text-muted-foreground hover:bg-muted/60",
            )}
            key={item}
            onClick={() => setTab(item)}
            type="button"
          >
            {formatLabel(item)}
          </button>
        ))}
      </div>

      {tab === "overview" ? <BrainOverview node={node} /> : null}
      {tab === "knowledge"
        ? (
          <RelationGroupsPanel
            emptyDescription="Durable decisions, facts, preferences, and constraints related to this entity will appear here."
            emptyTitle="No durable knowledge"
            groups={getKnowledgeRelationGroups(related)}
            onSelectNode={onSelectNode}
          />
        )
        : null}
      {tab === "work"
        ? (
          <RelationGroupsPanel
            emptyDescription="Tasks, risks, open questions, and current-state nodes related to this entity will appear here."
            emptyTitle="No current work"
            groups={getWorkRelationGroups(related)}
            onSelectNode={onSelectNode}
          />
        )
        : null}
      {tab === "relations"
        ? (
          <RelationGroupsPanel
            emptyDescription="Explicit relation edges will appear here when this node is connected to other concepts."
            emptyTitle="No explicit relations"
            groups={groupBrainRelationsByKind(related)}
            onSelectNode={onSelectNode}
          />
        )
        : null}
      {tab === "similar"
        ? <SimilarPanel onSelectNode={onSelectNode} similar={similar} />
        : null}
      {tab === "evidence" ? <EvidencePanel node={node} /> : null}
      {tab === "json"
        ? <JsonPanel title="Node JSON" value={node} minHeight={300} />
        : null}
    </div>
  );
}

function BrainOverview({ node }: { node: AdminBrainNode }) {
  return (
    <div className="rounded-lg border bg-background p-4">
      <dl className="grid gap-2 text-xs">
        <InspectorRow label="Agent" value={node.agentId} />
        <InspectorRow label="Thread" value={node.threadId} />
        <InspectorRow label="Memory space" value={node.memorySpaceId} />
        <InspectorRow label="Checkpoint" value={node.checkpointId} />
        <InspectorRow label="Source field" value={node.sourceField} />
        <InspectorRow label="Confidence" value={formatNullableNumber(node.confidence)} />
        <InspectorRow label="Updated" value={formatDateTime(node.updatedAt)} />
      </dl>
    </div>
  );
}

function RelationGroupsPanel({
  emptyDescription,
  emptyTitle,
  groups,
  onSelectNode,
}: {
  emptyDescription: string;
  emptyTitle: string;
  groups: AdminBrainRelationGroup[];
  onSelectNode: (node: AdminBrainNode) => void;
}) {
  if (groups.length === 0) {
    return (
      <EmptyState
        icon={GitBranch}
        title={emptyTitle}
        description={emptyDescription}
      />
    );
  }
  return (
    <div className="space-y-3">
      {groups.map((group) => (
        <section className="rounded-lg border bg-background" key={group.id}>
          <div className="border-b px-3 py-2">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h4 className="truncate text-sm font-medium">{group.label}</h4>
                <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                  {group.description}
                </p>
              </div>
              <Badge variant="secondary">{group.items.length}</Badge>
            </div>
          </div>
          <div className="divide-y">
            {group.items.map((item) => (
              <button
                className="w-full p-3 text-left transition-colors hover:bg-muted/40"
                key={item.edge.id}
                onClick={() => onSelectNode(item.node)}
                type="button"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{formatLabel(item.edge.type)}</Badge>
                  <Badge variant="secondary">
                    {item.direction === "out" ? "Outgoing" : "Incoming"}
                  </Badge>
                  <LayerBadge layer={item.node.layer} />
                </div>
                <div className="mt-2 text-sm font-medium">
                  {item.node.name}
                </div>
                <p className="mt-1 line-clamp-3 text-xs leading-5 text-muted-foreground">
                  {item.node.content || "-"}
                </p>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function SimilarPanel({
  onSelectNode,
  similar,
}: {
  onSelectNode: (node: AdminBrainNode) => void;
  similar: AdminBrainSimilar[];
}) {
  if (similar.length === 0) {
    return (
      <EmptyState
        icon={Sparkles}
        title="No semantic neighbors"
        description="Similar nodes appear here when the selected node has an embedding."
      />
    );
  }
  return (
    <div className="space-y-2">
      {similar.map((item) => (
        <button
          className="w-full rounded-lg border bg-background p-3 text-left transition-colors hover:bg-muted/40"
          key={item.node.id}
          onClick={() => onSelectNode(item.node)}
          type="button"
        >
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">
              {formatSimilarityScore(item.similarity)}
            </Badge>
            <LayerBadge layer={item.node.layer} />
            <Badge variant="outline">{formatLabel(item.node.kind)}</Badge>
          </div>
          <div className="mt-2 text-sm font-medium">{item.node.name}</div>
          <p className="mt-1 line-clamp-3 text-xs leading-5 text-muted-foreground">
            {item.node.content || "-"}
          </p>
        </button>
      ))}
    </div>
  );
}

function EvidencePanel({ node }: { node: AdminBrainNode }) {
  const sourceMessageIds = Array.isArray(node.sourceMessageIds)
    ? node.sourceMessageIds
    : [];
  return (
    <div className="rounded-lg border bg-background p-4">
      <dl className="grid gap-2 text-xs">
        <InspectorRow label="Source" value={node.sourceType} />
        <InspectorRow label="Source ID" value={node.sourceId} />
        <InspectorRow label="Thread" value={node.threadId} />
        <InspectorRow label="Checkpoint" value={node.checkpointId} />
      </dl>
      <div className="mt-4">
        <div className="text-xs font-medium text-muted-foreground">
          Source messages
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          {sourceMessageIds.length
            ? sourceMessageIds.map((id) => (
              <Badge className="max-w-full truncate" key={id} variant="outline">
                {id}
              </Badge>
            ))
            : <span className="text-xs text-muted-foreground">-</span>}
        </div>
      </div>
    </div>
  );
}

function MatchBadges({ match }: { match?: AdminBrainMatch }) {
  if (!match?.reasons.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1">
      {match.reasons.slice(0, 4).map((reason) => (
        <Badge className="text-[10px]" key={reason} variant="outline">
          {reason}
        </Badge>
      ))}
    </div>
  );
}

function InspectorRow({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="truncate font-mono">{value || "-"}</dd>
    </div>
  );
}

function LayerBadge({ layer }: { layer: string }) {
  return (
    <Badge variant={layer === "working" ? "secondary" : "default"}>
      {formatLabel(layer)}
    </Badge>
  );
}

function nodeColor(node: AdminBrainNode): string {
  if (node.layer === "working") return "#0891b2";
  if (node.kind === "decision") return "#4f46e5";
  if (node.kind === "risk") return "#dc2626";
  if (node.kind === "preference") return "#16a34a";
  return "#475569";
}

function formatLabel(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDateTime(value: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function formatNullableNumber(value: number | null) {
  return typeof value === "number" && Number.isFinite(value)
    ? value.toFixed(2)
    : "-";
}

function formatSimilarityScore(value: number) {
  return Number.isFinite(value) ? `Similarity ${value.toFixed(2)}` : "-";
}

function emptyBrainResponse(): AdminBrainResponse {
  return {
    nodes: [],
    edges: [],
    clusters: [],
    stats: {
      total: 0,
      byLayer: {},
      byKind: {},
      byStatus: {},
    },
    matches: {},
    related: [],
    similar: [],
    semantic: {
      requested: false,
      available: false,
      error: null,
    },
    pageInfo: {
      limit: 0,
      offset: 0,
      returned: 0,
    },
  };
}
