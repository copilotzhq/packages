import { type ActionContext, defineAction } from "@copilotz/copilotz/actions";
import { createCopilotzClient } from "@copilotz/copilotz/client";
import { usageCollection } from "@copilotz/copilotz/usage";
import { assertEquals } from "@std/assert";
import { createAdminClient } from "@copilotz/admin/client";
import { createAdminPlugin } from "@copilotz/copilotz/admin";
import { definePlugin } from "@copilotz/copilotz/plugins";
import { createHttpAdapter } from "@copilotz/copilotz/server";
import { createHttpFixture } from "./http-fixture.ts";

const actions = Object.freeze({
  overview: "copilotz.admin.overview",
  activity: "copilotz.admin.activity",
  threads: "copilotz.admin.threads",
  participants: "copilotz.admin.participants",
  usage: "copilotz.admin.usage",
  agents: "copilotz.admin.agents",
});

/** Mirrors Compass's read-only Admin adapter at the compiled HTTP boundary. */
const adminHttpPlugin = definePlugin({
  id: "test.admin-http",
  version: "1",
  collections: { usage: usageCollection },
  actions: {
    seed: defineAction({
      id: "test.admin.seed",
      inputSchema: { type: "object", properties: {} },
      async execute(_input, context: ActionContext) {
        await context.collections.participant.create({
          id: "person",
          externalId: "person",
          participantType: "human",
          name: "Admin test user",
        });
        await context.collections.thread.create({
          id: "admin-thread",
          name: "Admin history",
          participantIds: ["person"],
        });
        for (let i = 0; i < 55; i++) {
          await context.collections.message.create({
            id: `admin-message-${String(i).padStart(3, "0")}`,
            threadId: "admin-thread",
            senderId: "person",
            recipientIds: [],
            content: `Message ${i}`,
          });
          await context.collections.usage.create({
            id: `admin-usage-${String(i).padStart(3, "0")}`,
            kind: "llm",
            totalTokens: i + 1,
            occurredAt: new Date().toISOString(),
          });
        }
        return { threadId: "admin-thread" };
      },
    }),
  },
  adapters: {
    http: {
      admin: createHttpAdapter({
        routes: Object.entries(actions).map(([name, action]) => ({
          id: `test.admin.${name}`,
          method: "GET" as const,
          path: `/admin/${name}`,
          metadata: { admin: true },
          async handler(context) {
            const search = new URL(context.request.url).searchParams;
            const query = Object.fromEntries(
              [...new Set(search.keys())].map((key) => {
                const values = search.getAll(key);
                return [key, values.length === 1 ? values[0] : values];
              }),
            );
            const output = await context.invoke(action, {
              resource: "admin",
              method: "GET",
              path: [name],
              query,
            }) as { status: number; data?: unknown; pageInfo?: unknown };
            return Response.json({
              data: output.data,
              pageInfo: output.pageInfo,
            }, {
              status: output.status,
            });
          },
        })),
      }),
    },
  },
});

Deno.test("published Admin client follows the compiled Admin and Core facade contracts", async () => {
  const app = await createHttpFixture(undefined, [
    createAdminPlugin(),
    adminHttpPlugin,
  ]);
  const client = createAdminClient({
    baseUrl: "https://test/api",
    getRequestHeaders: () => ({ "x-user": "person" }),
  });
  const fetch = globalThis.fetch;
  globalThis.fetch =
    ((url, init) => app.fetch(new Request(url, init))) as typeof fetch;
  try {
    const generic = createCopilotzClient({
      baseUrl: "https://test/api",
      fetch: globalThis.fetch,
    });
    await generic.actions.invoke("test.admin.seed", {}, {
      idempotencyKey: "admin-seed",
    });
    const [overview, agents, usage] = await Promise.all([
      client.getOverview(),
      client.listAgents(),
      client.getUsage({ limit: 50 }),
    ]);
    assertEquals(overview.threadTotals.total, 1);
    assertEquals(overview.messageTotals.total, 55);
    assertEquals(agents[0]?.agentId, "support");
    assertEquals(usage.data.length, 50);
    assertEquals(usage.pageInfo.hasMore, true);
    const nextUsage = await client.getUsage({
      limit: 50,
      after: usage.pageInfo.next!,
    });
    assertEquals(nextUsage.data.length, 5);
    assertEquals(
      new Set([...usage.data, ...nextUsage.data].map((row) => row.id)).size,
      55,
    );
    const thread = await client.getThread("admin-thread");
    assertEquals(thread.id, "admin-thread");
    const first = await client.getThreadMessages(thread.id, { limit: 50 });
    assertEquals(first.pageInfo.hasMore, true);
    const second = await client.getThreadMessages(thread.id, {
      limit: 50,
      after: first.pageInfo.next!,
    });
    assertEquals(second.pageInfo.hasMore, false);
    assertEquals(
      new Set([...first.data, ...second.data].map((row) => row.id)).size,
      55,
    );
    assertEquals(second.data.length, 5);
  } finally {
    globalThis.fetch = fetch;
    await app.close();
  }
});
