import React from "react";
import {
  Brain,
  CircleDot,
  GitBranch,
  Network,
  RefreshCw,
  Search,
  Sparkles,
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

const BRAIN_LAYERS = ["all", "knowledge", "working"] as const;
const BRAIN_SEARCH_MODES = ["hybrid", "semantic", "keyword"] as const;
const BRAIN_STATUSES = ["active", "all", "superseded", "archived"] as const;
const BRAIN_KINDS = [
  "all",
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
    try {
      const next = await context.client.getBrain({
        namespace: context.scope.namespace || undefined,
        search: search.trim() || undefined,
        searchMode,
        layer,
        status,
        kind,
        agentId: agentId.trim() || undefined,
        focusNodeId: effectiveFocusNodeId || undefined,
        includeRelated: Boolean(effectiveFocusNodeId),
        includeSimilar: Boolean(effectiveFocusNodeId),
        similarLimit: 24,
        minSimilarity: 0.2,
        limit: 180,
      });
      setResponse(next);
      setSelectedNode((current) =>
        effectiveFocusNodeId
          ? next.nodes.find((node) => node.id === effectiveFocusNodeId) ??
            current
          : current && next.nodes.some((node) => node.id === current.id)
          ? next.nodes.find((node) => node.id === current.id) ?? current
          : next.nodes[0] ?? null
      );
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
  ]);

  React.useEffect(() => {
    void loadBrain();
  }, [context.refreshKey, context.scope.namespace, focusNodeId, loadBrain]);

  const data = response ?? emptyBrainResponse();
  const matches = data.matches ?? {};
  const related = data.related ?? [];
  const similar = data.similar ?? [];
  const knowledgeCount = data.stats.byLayer.knowledge ?? 0;
  const workingCount = data.stats.byLayer.working ?? 0;
  const selectNode = React.useCallback((node: AdminBrainNode) => {
    setSelectedNode(node);
    setFocusNodeId(node.id);
  }, []);
  const runSearch = React.useCallback(() => {
    setFocusNodeId(null);
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
            label: "Brain nodes",
            value: data.stats.total,
            detail: `${data.pageInfo.returned} shown`,
            icon: Brain,
          },
          {
            label: "Knowledge",
            value: knowledgeCount,
            detail: "Durable nodes",
            icon: CircleDot,
          },
          {
            label: "Working",
            value: workingCount,
            detail: "Current state",
            icon: Sparkles,
          },
          {
            label: "Clusters",
            value: data.clusters.length,
            detail: "Layer and kind",
            icon: Network,
          },
        ]}
      />

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
        searchPlaceholder="Search brain"
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
        <Select
          value={layer}
          onValueChange={(value) =>
            setLayer(value as typeof BRAIN_LAYERS[number])}
        >
          <SelectTrigger className="h-8 w-[140px] text-xs" aria-label="Layer">
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
        <Select
          value={kind}
          onValueChange={(value) =>
            setKind(value as typeof BRAIN_KINDS[number])}
        >
          <SelectTrigger className="h-8 w-[170px] text-xs" aria-label="Kind">
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
              <BrainMap
                clusters={data.clusters}
                edges={data.edges}
                loading={loading}
                nodes={data.nodes}
                onSelectNode={selectNode}
                similar={similar}
                selectedNodeId={selectedNode?.id ?? null}
              />
              <ResourceTable
                rows={data.nodes}
                getRowKey={(row) => row.id}
                onRowClick={selectNode}
                empty={
                  <EmptyState
                    icon={Brain}
                    title={loading ? "Loading brain" : "No brain nodes"}
                    description={loading
                      ? "Fetching brain nodes for the active namespace."
                      : "Knowledge and working-state nodes will appear here."}
                  />
                }
                columns={[
                  {
                    id: "node",
                    header: "Node",
                    className: "max-w-[360px]",
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
                  {
                    id: "layer",
                    header: "Layer",
                    render: (row) => <LayerBadge layer={row.layer} />,
                  },
                  {
                    id: "kind",
                    header: "Kind",
                    render: (row) => formatLabel(row.kind),
                  },
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
            </div>
          </InspectorPanel>
        )}
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

type InspectorTab = "overview" | "related" | "similar" | "evidence" | "json";

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
        {(["overview", "related", "similar", "evidence", "json"] as const)
          .map((item) => (
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
      {tab === "related"
        ? <RelatedPanel onSelectNode={onSelectNode} related={related} />
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

function RelatedPanel({
  onSelectNode,
  related,
}: {
  onSelectNode: (node: AdminBrainNode) => void;
  related: AdminBrainRelated[];
}) {
  if (related.length === 0) {
    return (
      <EmptyState
        icon={GitBranch}
        title="No explicit relations"
        description="Relation edges will appear here when this node is connected to other concepts."
      />
    );
  }
  return (
    <div className="space-y-2">
      {related.map((item) => (
        <button
          className="w-full rounded-lg border bg-background p-3 text-left transition-colors hover:bg-muted/40"
          key={item.edge.id}
          onClick={() => onSelectNode(item.node)}
          type="button"
        >
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{formatLabel(item.edge.type)}</Badge>
            <Badge variant="secondary">
              {item.direction === "out" ? "Outgoing" : "Incoming"}
            </Badge>
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
          {node.sourceMessageIds.length
            ? node.sourceMessageIds.map((id) => (
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
