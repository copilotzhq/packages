import test from "node:test";
import assert from "node:assert/strict";
import {
  aggregateUsageRows,
  buildUsageChartState,
  collectAdminNavItems,
  collectAdminRoutes,
  collectCollectionEditors,
  createAdminClient,
  EmptyState,
  FilterBar,
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
    totalCalls: 1,
    totalCostUsd,
    totalTokens,
  };
}
