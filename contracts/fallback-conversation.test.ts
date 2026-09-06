import { assert, assertEquals } from "@std/assert";
import { createCopilotzClient } from "@copilotz/copilotz/client";
import { createCoreClient } from "@copilotz/copilotz/core/client";
import { definePlugin } from "@copilotz/copilotz/plugins";
import type { LlmAdapterResult } from "@copilotz/copilotz/llm";
import { createChatController } from "@copilotz/chat-adapter/controller";
import { createHttpFixture } from "./http-fixture.ts";

Deno.test("reasoning failure recovers through the real facade and controller without retaining failed output", async () => {
  let release!: () => void;
  const visible = new Promise<void>((resolve) => release = resolve);
  let backupCalls = 0;
  const app = await createHttpFixture(definePlugin({
    id: "test.fallback",
    version: "1",
    resources: {
      agents: {
        support: {
          id: "support",
          name: "Support",
          role: "support",
          instructions: "Reply",
          models: { generate: ["primary", "backup"] },
          capabilities: { tools: [] },
        },
      },
      models: {
        primary: { adapter: "primary", model: "primary" },
        backup: { adapter: "backup", model: "backup" },
      },
    },
    adapters: {
      llm: {
        primary: {
          call() {
            return {
              frames: new ReadableStream({
                start(stream) {
                  stream.enqueue({
                    lane: "reasoning",
                    mediaType: "text/plain",
                    bytes: new TextEncoder().encode("discarded candidate"),
                  });
                  stream.close();
                },
              }),
              result: visible.then(
                () => ({
                  content: "",
                  toolCalls: [{ id: "", action: "ask", input: {} }],
                  attempts: [{ status: "completed" }],
                } as unknown as LlmAdapterResult),
              ),
            };
          },
        },
        backup: {
          call() {
            backupCalls++;
            return {
              frames: new ReadableStream({
                start(stream) {
                  stream.enqueue({
                    lane: "content",
                    mediaType: "text/plain",
                    bytes: new TextEncoder().encode("Recovered answer"),
                  });
                  stream.close();
                },
              }),
              result: Promise.resolve({
                content: "Recovered answer",
                attempts: [{ status: "completed" as const }],
              }),
            };
          },
        },
      },
    },
  }));
  const client = createCopilotzClient({
    baseUrl: "https://test/api",
    fetch: ((url, init) => app.fetch(new Request(url, init))) as typeof fetch,
  });
  const controller = createChatController(createCoreClient(client), {
    userId: "person",
    participants: ["support"],
  });
  let sawReasoning = false;
  let sawFailure = false;
  controller.subscribe(() => {
    sawFailure ||= controller.getSnapshot().messages.some(message => message.activity?.items.some(item => item.status === "failed"));
    if (
      JSON.stringify(controller.getSnapshot().messages).includes(
        "discarded candidate",
      )
    ) {
      sawReasoning = true;
      release();
    }
  });
  try {
    await controller.start();
    await controller.send("Reply after recovery");
    for (let index = 0; index < 1000; index++) {
      const state = controller.getSnapshot();
      if (state.error) throw state.error;
      if (
        !state.isStreaming &&
        state.messages.some((message) => message.content === "Recovered answer")
      ) break;
      if (index === 999) throw new Error("Fallback did not settle");
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    assert(sawReasoning);
    assertEquals(backupCalls, 1);
    assertEquals(sawFailure, false);
    const messages = controller.getSnapshot().messages;
    assertEquals(
      messages.filter((message) => message.role === "assistant").length,
      1,
    );
    assert(!JSON.stringify(messages).includes("discarded candidate"));
    await controller.openThread(controller.getSnapshot().currentThreadId!);
    assertEquals(
      controller.getSnapshot().messages.map((message) => message.id),
      messages.map((message) => message.id),
    );
  } finally {
    release();
    controller.dispose();
    await app.close();
  }
});
