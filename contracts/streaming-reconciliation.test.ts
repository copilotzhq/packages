import { assert, assertEquals } from "@std/assert";
import { createCopilotzClient } from "@copilotz/copilotz/client";
import { createCoreClient } from "@copilotz/copilotz/core/client";
import { definePlugin } from "@copilotz/copilotz/plugins";
import { createChatController } from "@copilotz/chat-adapter/controller";
import { createHttpFixture } from "./http-fixture.ts";

function gate() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => resolve = done);
  return { promise, resolve };
}
async function eventually(predicate: () => boolean) {
  for (let attempt = 0; attempt < 500; attempt++) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert(predicate(), "Expected state did not arrive within five seconds");
}

Deno.test("live tokens continue while canonical history reconciliation is slow or fails", async () => {
  const first = gate(), last = gate(), history = gate();
  const app = await createHttpFixture(definePlugin({
    id: "test.slow-history",
    version: "1",
    resources: {
      agents: {
        support: {
          id: "support",
          name: "Support",
          role: "assistant",
          instructions: "Reply",
          models: { generate: ["test"] },
          capabilities: { tools: [] },
        },
      },
      models: { test: { adapter: "test", model: "test" } },
    },
    adapters: {
      llm: {
        test: {
          call() {
            return {
              frames: new ReadableStream({
                async start(c) {
                  await first.promise;
                  c.enqueue({
                    lane: "content",
                    mediaType: "text/plain",
                    bytes: new TextEncoder().encode("First"),
                  });
                  await last.promise;
                  c.enqueue({
                    lane: "content",
                    mediaType: "text/plain",
                    bytes: new TextEncoder().encode(" second"),
                  });
                  c.close();
                },
              }),
              result: last.promise.then(() => ({
                content: "First second",
                attempts: [{ status: "completed" as const }],
              })),
            };
          },
        },
      },
    },
  }));
  let historyCalls = 0, blocked = false;
  const client = createCopilotzClient({
    baseUrl: "https://test/api",
    fetch: (async (url, init) => {
      if (
        new URL(String(url)).pathname.endsWith("/messages") &&
        ++historyCalls === 2
      ) {
        blocked = true;
        await history.promise;
        return Response.json({
          error: {
            code: "temporary_history_failure",
            message: "History unavailable",
          },
        }, { status: 503 });
      }
      return app.fetch(new Request(url, init));
    }) as typeof fetch,
  });
  const core = createCoreClient(client);
  const controller = createChatController(core, {
    userId: "person",
    participants: ["support"],
  });
  try {
    await controller.send("Go");
    await eventually(() => blocked);
    first.resolve();
    await eventually(() =>
      controller.getSnapshot().messages.some((message) =>
        message.content === "First"
      )
    );
    assertEquals(blocked, true);
    last.resolve();
    await eventually(() =>
      controller.getSnapshot().messages.some((message) =>
        message.content === "First second"
      )
    );
    history.resolve();
    await eventually(() =>
      historyCalls >= 3 && !controller.getSnapshot().isStreaming
    );
    assertEquals(controller.getSnapshot().error, null);
    assertEquals(
      controller.getSnapshot().messages.filter((message) =>
        message.role === "user"
      ).length,
      1,
    );
  } finally {
    first.resolve();
    last.resolve();
    history.resolve();
    controller.dispose();
    await app.close();
  }
});
