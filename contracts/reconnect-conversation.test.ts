import { assert, assertEquals } from "@std/assert";
import { createCopilotzClient } from "@copilotz/copilotz/client";
import { createCoreClient } from "@copilotz/copilotz/core/client";
import { decodeOperationReplayCursor } from "@copilotz/copilotz/streams";
import { definePlugin } from "@copilotz/copilotz/plugins";
import { defineAction } from "@copilotz/copilotz/actions";
import { defineTool } from "@copilotz/copilotz/tools";
import { createChatController } from "@copilotz/chat-adapter/controller";
import { createHttpFixture } from "./http-fixture.ts";
Deno.test("refresh restores one current snapshot, retries interrupted prefixes, and pages older history", async () => {
  const prefix = "Current prefix ".repeat(90000);
  let release!: () => void, started!: () => void;
  const held = new Promise<void>((resolve) => release = resolve);
  const nextCall = new Promise<void>((resolve) => started = resolve);
  let calls = 0;
  const mark = defineAction({ id: "test.mark", execute: () => ({ ok: true }) });
  const app = await createHttpFixture(definePlugin({
    id: "test.refresh",
    version: "1",
    actions: { mark },
    resources: {
      agents: {
        support: {
          id: "support",
          name: "Support",
          role: "assistant",
          instructions: "Reply",
          models: { generate: ["test"] },
          capabilities: { tools: ["mark"] },
        },
      },
      models: { test: { adapter: "test", model: "test" } },
      tools: {
        mark: defineTool("mark", mark, { name: "Mark", description: "Mark" }),
      },
    },
    adapters: {
      llm: {
        test: {
          call() {
            const first = ++calls === 1;

            return {
              frames: new ReadableStream({
                async start(c) {
                  c.enqueue({
                    lane: "content",
                    mediaType: "text/plain",
                    bytes: new TextEncoder().encode(
                      first ? "Already persisted" : prefix,
                    ),
                  });
                  if (!first) {
                    started();
                    await held;
                    c.enqueue({
                      lane: "content",
                      mediaType: "text/plain",
                      bytes: new TextEncoder().encode(" continued"),
                    });
                  }
                  c.close();
                },
              }),
              result: (first ? Promise.resolve() : held).then(() => ({
                content: first ? "Already persisted" : prefix + " continued",
                toolCalls: first
                  ? [{ id: "call", action: "mark", input: {} }]
                  : [],
                attempts: [{ status: "completed" as const }],
              })),
            };
          },
        },
      },
    },
  }));
  let observations = 0;
  let interrupted = false;
  const client = createCopilotzClient({
    baseUrl: "https://test/api",
    fetch: (async (u, i) => {
      const response = await app.fetch(new Request(u, i));
      if (!String(u).endsWith("/observe")) return response;
      observations++;
      if (interrupted) return response;
      const reader = response.body!.getReader();
      let reads = 0;
      return new Response(
        new ReadableStream({
          async pull(c) {
            if (++reads === 4) {
              interrupted = true;
              await reader.cancel();
              c.error(new TypeError("Simulated interrupted connection"));
              return;
            }
            const value = await reader.read();
            if (value.done) c.close();
            else c.enqueue(value.value);
          },
          cancel: (reason) => reader.cancel(reason),
        }),
        { headers: response.headers },
      );
    }) as typeof fetch,
  });
  const core = createCoreClient(client);
  const controller = createChatController(core, {
    userId: "person",
    participants: ["support"],
  });
  const observedPrefixes: string[] = [];
  controller.subscribe(() => {
    for (const message of controller.getSnapshot().messages) {
      if (message.content.startsWith("Current prefix")) {
        observedPrefixes.push(message.content);
      }
    }
  });

  try {
    const receipt = await core.threads.send({
      externalThreadId: "reconnect",
      content: "Go",
      recipientIds: ["support"],
    }, { idempotencyKey: "refresh-investigation" });
    await nextCall;
    const thread = (await core.threads.list()).data[0];
    const history = await core.threads.messages(thread.id, {
      order: "desc",
      limit: 50,
    });
    assert(history.data.some((m) => m.sender.participantType === "agent"));
    const cursor = decodeOperationReplayCursor(history.pageInfo.checkpoint);
    assert(
      (cursor.operationStreamPositions?.[receipt.operationId]?.highWatermark ??
        0) >= 1,
    );
    const ids: string[] = [];
    let next: string | undefined;
    for (let page = 0; page < history.data.length; page++) {
      const older = await core.threads.messages(thread.id, {
        order: "desc",
        limit: 1,
        ...(next ? { after: next } : {}),
      });
      assertEquals(older.data.length, 1);
      ids.push(older.data[0].id);
      assertEquals(older.pageInfo.hasMore, page < history.data.length - 1);
      next = older.pageInfo.next;
    }
    assertEquals(new Set(ids).size, history.data.length);
    await controller.start(thread.id);
    for (let attempt = 0; attempt < 1000; attempt++) {
      if (controller.getSnapshot().error) throw controller.getSnapshot().error;
      if (
        controller.getSnapshot().messages.some((message) =>
          message.content === prefix
        )
      ) break;
      if (attempt === 999) throw new Error("Restored prefix did not arrive");
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    assert(interrupted);
    assert(observations >= 2);
    assert(observedPrefixes.length > 0);
    assert(observedPrefixes.every((value) => value === prefix));
    release();
    for (let attempt = 0; attempt < 1000; attempt++) {
      const state = controller.getSnapshot();
      if (state.error) throw state.error;
      if (
        !state.isStreaming &&
        state.messages.some((message) =>
          message.content === prefix + " continued"
        )
      ) break;
      if (attempt === 999) throw new Error("Continued response did not settle");
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  } finally {
    controller.dispose();
    release();
    await app.close();
  }
});

Deno.test("an agent prepares before its first byte and settles independently of its operation", async () => {
  let release!: () => void;
  const held = new Promise<void>((resolve) => release = resolve);
  const app = await createHttpFixture(definePlugin({
    id: "test.preparation",
    version: "1",
    resources: {
      agents: {
        support: {
          id: "support",
          name: "Support",
          role: "assistant",
          instructions: "Reply",
          models: { generate: ["test"] },
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
                  await held;
                  c.enqueue({
                    lane: "content",
                    mediaType: "text/plain",
                    bytes: new TextEncoder().encode("Hello"),
                  });
                  c.close();
                },
              }),
              result: held.then(() => ({
                content: "Hello",
                toolCalls: [],
                attempts: [{ status: "completed" as const }],
              })),
            };
          },
        },
      },
    },
  }));
  const core = createCoreClient(
    createCopilotzClient({
      baseUrl: "https://test/api",
      fetch: ((u, i) => app.fetch(new Request(u, i))) as typeof fetch,
    }),
  );
  const controller = createChatController(core, {
    userId: "person",
    participants: ["support"],
  });
  try {
    const sending = controller.send("Hello");
    for (let i = 0;; i++) {
      const s = controller.getSnapshot();
      if (s.error) throw s.error;
      if (
        s.messages.some((m) =>
          m.sender?.agentId === "support" &&
          m.activity?.items.some((a) =>
            a.kind === "answering" && a.status === "active"
          )
        )
      ) break;
      if (i > 500) {
        throw new Error("Preparation did not arrive before first byte");
      }
      await new Promise((r) => setTimeout(r, 10));
    }
    release();
    await sending;
    for (let i = 0;; i++) {
      const s = controller.getSnapshot();
      if (s.error) throw s.error;
      if (
        !s.isStreaming &&
        s.messages.some((m) => m.content === "Hello" && m.role === "assistant")
      ) break;
      if (i > 500) throw new Error("Response did not settle");
      await new Promise((r) => setTimeout(r, 10));
    }
    assert(
      !controller.getSnapshot().messages.some((m) =>
        m.activity?.items.some((a) => a.status === "active")
      ),
    );
  } finally {
    release();
    controller.dispose();
    await app.close();
  }
});
