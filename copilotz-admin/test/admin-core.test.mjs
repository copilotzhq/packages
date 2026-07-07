import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  aggregateUsageRows,
  ENTITY_FOCUS_RELATION_TYPES,
  brainModule,
  buildUsageChartState,
  collectAdminNavItems,
  collectAdminRoutes,
  collectCollectionEditors,
  createAdminClient,
  EmptyState,
  FilterBar,
  getBrainViewBaseFilters,
  getKnowledgeRelationGroups,
  getWorkRelationGroups,
  groupBrainRelationsByKind,
  InspectorPanel,
  JsonPanel,
  MetricStrip,
  PageHeader,
  ResourceTable,
  StatusBadge,
} from "../dist/index.js";

Object.defineProperty(globalThis, "location", {
  configurable: true,
  value: { origin: "http://localhost" },
});

test("registry orders nav groups and filters permissions", () => {
  const modules = [
    {
      id: "tenant",
      label: "Tenant",
      group: "extensions",
      routes: [{ id: "tenant", title: "Tenant", render: () => null }],
      navItems: [{ id: "tenant", label: "Tenant", routeId: "tenant", permission: "tenant:view" }],
    },
    {
      id: "usage",
      label: "Usage",
      group: "operate",
      routes: [{ id: "usage", title: "Usage", render: () => null }],
      navItems: [{ id: "usage", label: "Usage", routeId: "usage" }],
    },
  ];

  const permissions = {
    canAccess: (permission) => permission !== "tenant:view",
  };

  assert.deepEqual(
    collectAdminNavItems(modules, permissions).map((item) => item.id),
    ["usage"],
  );
  assert.deepEqual(
    Array.from(collectAdminRoutes(modules, permissions).keys()),
    ["tenant", "usage"],
  );
});

test("collection editors are collected from modules", () => {
  function TenantPolicyEditor() {
    return null;
  }

  const editors = collectCollectionEditors([
    {
      id: "tenant",
      label: "Tenant",
      routes: [{ id: "tenant", title: "Tenant", render: () => null }],
      collectionEditors: { tenantPolicy: TenantPolicyEditor },
    },
  ]);

  assert.equal(editors.tenantPolicy, TenantPolicyEditor);
});

test("root export includes reusable admin patterns", () => {
  assert.equal(typeof EmptyState, "function");
  assert.equal(typeof FilterBar, "function");
  assert.equal(typeof InspectorPanel, "function");
  assert.equal(typeof JsonPanel, "function");
  assert.equal(typeof MetricStrip, "function");
  assert.equal(typeof PageHeader, "function");
  assert.equal(typeof ResourceTable, "function");
  assert.equal(typeof StatusBadge, "function");
});

test("admin client builds configurable paths and headers", async () => {
  const seen = [];
  globalThis.fetch = async (url, init) => {
    seen.push({ url, init });
    return new Response(JSON.stringify({ data: { totalCalls: 0, points: [], rows: [], totals: {} } }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  };

  const client = createAdminClient({
    baseUrl: "/custom",
    getRequestHeaders: () => ({ Authorization: "Bearer test" }),
    paths: { adminBase: "/admin" },
  });

  await client.getUsage({ namespace: "tenant_a", provider: "openai" });

  assert.equal(seen.length, 1);
  assert.equal(
    seen[0].url,
    "http://localhost/custom/admin/usage?namespace=tenant_a&provider=openai",
  );
  assert.equal(seen[0].init.headers.Authorization, "Bearer test");
});

test("admin client sends generic usage filters", async () => {
  const seen = [];
  globalThis.fetch = async (url, init) => {
    seen.push({ url, init });
    return new Response(JSON.stringify({ data: { points: [], rows: [], totals: {} } }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  };

  const client = createAdminClient({ baseUrl: "/custom" });
  await client.getUsage({
    kind: "tool",
    operation: "tool.exec",
    resource: "sandbox.exec",
    status: "failed",
  });

  assert.equal(seen.length, 1);
  assert.equal(
    seen[0].url,
    "http://localhost/custom/v1/admin/usage?kind=tool&resource=sandbox.exec&operation=tool.exec&status=failed",
  );
});

test("admin client sends semantic brain filters", async () => {
  const seen = [];
  globalThis.fetch = async (url, init) => {
    seen.push({ url, init });
    return new Response(JSON.stringify({
      data: {
        nodes: [],
        edges: [],
        clusters: [],
        stats: { totalNodes: 0, byLayer: {}, byKind: {}, byStatus: {} },
        matches: {},
        related: [],
        similar: [],
        semantic: { requested: true, available: true, error: null },
        pageInfo: { limit: 24, offset: 0, total: 0 },
      },
    }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  };

  const client = createAdminClient({ baseUrl: "/custom" });
  const brain = await client.getBrain({
    namespace: "tenant_a",
    search: "tenant policy",
    searchMode: "hybrid",
    focusNodeId: "node-1",
    includeRelated: true,
    includeSimilar: true,
    similarLimit: 12,
    minSimilarity: 0.45,
    relationDepth: 1,
    relationTypes: ["supports", "depends_on"],
    limit: 24,
  });

  assert.equal(seen.length, 1);
  assert.equal(
    seen[0].url,
    "http://localhost/custom/v1/admin/brain?namespace=tenant_a&search=tenant+policy&searchMode=hybrid&focusNodeId=node-1&includeRelated=true&includeSimilar=true&similarLimit=12&minSimilarity=0.45&relationDepth=1&relationTypes=supports%2Cdepends_on&limit=24",
  );
  assert.deepEqual(brain.matches, {});
  assert.deepEqual(brain.related, []);
  assert.deepEqual(brain.similar, []);
});

test("admin client encodes entity focus relation filters", async () => {
  const seen = [];
  globalThis.fetch = async (url, init) => {
    seen.push({ url, init });
    return new Response(JSON.stringify({
      data: {
        nodes: [],
        edges: [],
        clusters: [],
        stats: { total: 0, byLayer: {}, byKind: {}, byStatus: {} },
        matches: {},
        related: [],
        similar: [],
        semantic: { requested: true, available: true, error: null },
        pageInfo: { limit: 24, offset: 0, returned: 0 },
      },
    }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  };

  const client = createAdminClient({ baseUrl: "/custom" });
  await client.getBrain({
    namespace: "tenant_compass",
    kind: "entity",
    layer: "knowledge",
    focusNodeId: "entity-1",
    includeRelated: true,
    includeSimilar: true,
    relationTypes: [...ENTITY_FOCUS_RELATION_TYPES],
    limit: 180,
  });

  assert.equal(seen.length, 1);
  assert.equal(
    seen[0].url,
    "http://localhost/custom/v1/admin/brain?namespace=tenant_compass&layer=knowledge&kind=entity&focusNodeId=entity-1&includeRelated=true&includeSimilar=true&relationTypes=mentions%2Crelated_to%2Csupports%2Cdepends_on%2Ccontradicts%2Csupersedes&limit=180",
  );
});

test("brain view model defaults to entity-first filters", () => {
  assert.deepEqual(getBrainViewBaseFilters("entities"), {
    kind: "entity",
    layer: "knowledge",
  });
  assert.deepEqual(getBrainViewBaseFilters("knowledge"), {
    kind: "all",
    layer: "knowledge",
  });
  assert.deepEqual(getBrainViewBaseFilters("work"), {
    kind: "all",
    layer: "working",
  });
  assert.deepEqual(getBrainViewBaseFilters("map"), {
    kind: "all",
    layer: "all",
  });
  assert.deepEqual([...ENTITY_FOCUS_RELATION_TYPES], [
    "mentions",
    "related_to",
    "supports",
    "depends_on",
    "contradicts",
    "supersedes",
  ]);
});

test("brain relation grouping separates knowledge and work around entities", () => {
  const related = [
    relatedNode("edge-decision", "decision-1", "decision", "knowledge"),
    relatedNode("edge-fact", "fact-1", "fact", "knowledge"),
    relatedNode("edge-task", "task-1", "task", "working"),
    relatedNode("edge-question", "question-1", "open_question", "working"),
    relatedNode("edge-unknown", "custom-1", "custom_kind", "knowledge"),
  ];

  assert.deepEqual(
    groupBrainRelationsByKind(related).map((group) => [
      group.id,
      group.items.map((item) => item.node.id),
    ]),
    [
      ["decisions", ["decision-1"]],
      ["facts", ["fact-1"]],
      ["tasks", ["task-1"]],
      ["openQuestions", ["question-1"]],
      ["other", ["custom-1"]],
    ],
  );
  assert.deepEqual(
    getKnowledgeRelationGroups(related).map((group) => group.id),
    ["decisions", "facts"],
  );
  assert.deepEqual(
    getWorkRelationGroups(related).map((group) => group.id),
    ["tasks", "openQuestions"],
  );
});

test("brain module renders entity-first empty state by default", () => {
  const module = brainModule();
  const route = module.routes.find((item) => item.id === "brain");
  assert.ok(route);

  const html = renderToStaticMarkup(route.render({
    client: {},
    config: {},
    permissions: {},
    refresh: () => {},
    refreshKey: 0,
    scope: { namespace: "tenant_a" },
  }));

  assert.match(html, />Entities</);
  assert.match(html, />Knowledge</);
  assert.match(html, />Work</);
  assert.match(html, />Map</);
  assert.match(html, />All nodes</);
  assert.match(html, />Entity index</);
  assert.match(html, /tenant_a/);
  assert.match(html, /Select an entity/);
  assert.match(html, /No node selected/);
  assert.doesNotMatch(html, /All layers/);
});

test("admin client lists events through the admin events endpoint", async () => {
  const seen = [];
  const event = {
    id: "event-1",
    threadId: "thread-1",
    eventType: "TOOL_CALL",
    payload: { toolName: "sandbox.exec" },
    parentEventId: null,
    traceId: "trace-1",
    priority: 5,
    status: "completed",
    namespace: "tenant_a",
    metadata: null,
    createdAt: "2026-07-07T00:00:00.000Z",
    updatedAt: "2026-07-07T00:00:01.000Z",
  };

  globalThis.fetch = async (url, init) => {
    seen.push({ url, init });
    return new Response(JSON.stringify({ data: [event] }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  };

  const client = createAdminClient({ baseUrl: "/custom" });
  const events = await client.listEvents({
    namespace: "tenant_a",
    threadId: "thread-1",
    status: "completed",
    eventType: "TOOL_CALL",
    traceId: "trace-1",
    limit: 10,
  });

  assert.equal(seen.length, 1);
  assert.equal(
    seen[0].url,
    "http://localhost/custom/v1/admin/events?namespace=tenant_a&threadId=thread-1&status=completed&eventType=TOOL_CALL&traceId=trace-1&limit=10",
  );
  assert.equal(events.length, 1);
  assert.equal(events[0].id, "event-1");
  assert.deepEqual(events[0].payload, { toolName: "sandbox.exec" });
});

test("admin client treats empty thread event responses as no event", async () => {
  const seen = [];
  globalThis.fetch = async (url, init) => {
    seen.push({ url, init });
    return new Response(JSON.stringify({}), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  };

  const client = createAdminClient({ baseUrl: "/custom" });
  const event = await client.getThreadEvent("thread-1");

  assert.equal(seen.length, 1);
  assert.equal(
    seen[0].url,
    "http://localhost/custom/v1/threads/thread-1/events",
  );
  assert.equal(event, undefined);
});

test("admin client preserves thread message pagination envelope", async () => {
  const seen = [];
  const message = {
    id: "msg-1",
    threadId: "thread 1",
    senderUserId: null,
    senderId: "agent-a",
    senderType: "agent",
    targetId: null,
    content: "Hello",
    toolCallId: null,
    toolCalls: null,
    reasoning: null,
    metadata: null,
    createdAt: "2026-07-07T00:00:00.000Z",
    updatedAt: null,
  };

  globalThis.fetch = async (url, init) => {
    seen.push({ url, init });
    return new Response(JSON.stringify({
      data: [message],
      pageInfo: {
        hasMoreBefore: true,
        oldestMessageId: "msg-1",
        newestMessageId: "msg-1",
      },
    }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  };

  const client = createAdminClient({
    baseUrl: "/custom",
    getRequestHeaders: () => ({ Authorization: "Bearer test" }),
  });
  const page = await client.getThreadMessages("thread 1", {
    before: "msg-0",
    limit: 50,
  });

  assert.equal(seen.length, 1);
  assert.equal(
    seen[0].url,
    "http://localhost/custom/v1/threads/thread%201/messages?limit=50&before=msg-0",
  );
  assert.equal(seen[0].init.headers.Authorization, "Bearer test");
  assert.equal(page.data.length, 1);
  assert.equal(page.data[0].id, "msg-1");
  assert.equal(page.pageInfo.hasMoreBefore, true);
  assert.equal(page.pageInfo.oldestMessageId, "msg-1");
});

test("usage calculations aggregate and build chart state", () => {
  const points = [
    usagePoint("2026-01-01T00:00:00.000Z", "agent-a", "Agent A", 10, 0.05),
    usagePoint("2026-01-01T00:00:00.000Z", "agent-a", "Agent A", 15, 0.08),
    usagePoint("2026-01-02T00:00:00.000Z", "agent-b", "Agent B", 5, 0.01),
  ];

  const rows = aggregateUsageRows(points, "tokens", "total");
  assert.equal(rows[0].groupKey, "agent-a");
  assert.equal(rows[0].totalTokens, 25);

  const chart = buildUsageChartState(points, "cost", "total", "day");
  assert.equal(chart.series.length, 2);
  assert.equal(chart.data.length, 2);
});

test("usage calculations aggregate generic metering fields", () => {
  const points = [
    {
      ...usagePoint("2026-01-01T00:00:00.000Z", "tool-a", "Tool A", 0, 0),
      failedCalls: 1,
      totalCalls: 2,
      totalDurationMs: 1500,
      unpricedCalls: 1,
    },
    {
      ...usagePoint("2026-01-01T00:00:00.000Z", "tool-a", "Tool A", 0, 0),
      totalCalls: 1,
      totalCredits: 3,
      totalDurationMs: 500,
    },
  ];

  const durationRows = aggregateUsageRows(points, "duration", "total");
  assert.equal(durationRows[0].totalDurationMs, 2000);
  assert.equal(durationRows[0].value, 2000);

  const failureRows = aggregateUsageRows(points, "failures", "total");
  assert.equal(failureRows[0].failedCalls, 1);
  assert.equal(failureRows[0].unpricedCalls, 1);
  assert.equal(failureRows[0].totalCredits, 3);
});

function usagePoint(bucket, groupKey, groupLabel, totalTokens, totalCostUsd) {
  return {
    bucket,
    cacheCreationInputCostUsd: 0,
    cacheCreationInputTokens: 0,
    cacheReadInputCostUsd: 0,
    cacheReadInputTokens: 0,
    groupKey,
    groupLabel,
    inputCostUsd: totalCostUsd / 2,
    inputTokens: totalTokens / 2,
    outputCostUsd: totalCostUsd / 2,
    outputTokens: totalTokens / 2,
    reasoningCostUsd: 0,
    reasoningTokens: 0,
    failedCalls: 0,
    totalCalls: 1,
    totalCostUsd,
    totalCredits: 0,
    totalDurationMs: 0,
    totalTokens,
    unpricedCalls: 0,
  };
}

function relatedNode(edgeId, nodeId, kind, layer) {
  return {
    direction: "in",
    edge: {
      id: edgeId,
      sourceNodeId: nodeId,
      targetNodeId: "entity-1",
      type: "mentions",
      weight: null,
      createdAt: null,
      data: null,
    },
    node: brainNode(nodeId, kind, layer),
  };
}

function brainNode(id, kind, layer) {
  return {
    id,
    namespace: "tenant_a",
    name: id,
    content: `${kind} content`,
    layer,
    kind,
    status: "active",
    memorySpaceId: null,
    checkpointId: null,
    agentId: null,
    threadId: null,
    confidence: null,
    sourceMessageIds: [],
    sourceField: null,
    sourceType: null,
    sourceId: null,
    createdAt: null,
    updatedAt: null,
    clusterId: kind,
    x: 0,
    y: 0,
    data: {},
  };
}
