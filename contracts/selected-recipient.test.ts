import { assert, assertEquals } from "@std/assert";
import { createCopilotzClient } from "@copilotz/copilotz/client";
import { createCoreClient } from "@copilotz/copilotz/core/client";
import { definePlugin } from "@copilotz/copilotz/plugins";
import type { LlmAdapter, LlmAdapterResult } from "@copilotz/copilotz/llm";
import { createChatController } from "@copilotz/chat-adapter/controller";
import { createHttpFixture } from "./http-fixture.ts";

for (const existing of [false, true]) {
  Deno.test(`selected recipient delegates with a full team (${existing ? "repair existing thread" : "new thread"})`, async () => {
    const calls = new Map<string, number>();
    let delegate = false;
    const adapter: LlmAdapter = {
      call(input) {
        const agent =
          /ACTIVE_AGENT=([a-z]+)/.exec(input.request.instructions ?? "")![1];
        const count = (calls.get(agent) ?? 0) + 1;
        calls.set(agent, count);
        const target = delegate && count === 1
          ? ({ north: "west", west: "east" } as Record<string, string>)[agent]
          : undefined;
        const answer = target ? "" : `Answer ${agent}`;
        const result: LlmAdapterResult = {
          content: answer ? { type: "text", role: "body", text: answer } : [],
          toolCalls: target
            ? [{
              id: "reused-ask-id",
              action: "ask",
              input: { target, message: "Introduce yourself" },
            }]
            : [],
          attempts: [{ status: "completed" }],
          finishReason: target ? "tool_calls" : "stop",
        };
        return {
          result: Promise.resolve(result),
          frames: new ReadableStream({
            start(controller) {
              if (answer) {
                controller.enqueue({
                  lane: "content",
                  mediaType: "text/plain",
                  bytes: new TextEncoder().encode(answer),
                });
              }
              controller.close();
            },
          }),
        };
      },
    };
    const participants = ["north", "west", "east", "south"];
    const app = await createHttpFixture(definePlugin({
      id: "test.selected-recipient",
      version: "1",
      resources: {
        agents: Object.fromEntries(participants.map((id) => [id, {
          id,
          name: id,
          role: "assistant",
          instructions: `ACTIVE_AGENT=${id}`,
          models: { generate: ["test"] },
          capabilities: {
            tools: [],
            agents: participants.filter((other) => other !== id),
          },
        }])),
        models: { test: { adapter: "test", model: "test" } },
      },
      adapters: { llm: { test: adapter } },
    }));
    const client = createCopilotzClient({
      baseUrl: "https://test/api",
      fetch: ((url, init) => app.fetch(new Request(url, init))) as typeof fetch,
    });
    const core = createCoreClient(client);
    const controller = createChatController(core, {
      userId: "person",
      participants,
      targetAgentName: "north",
    });
    try {
      let threadId: string | undefined;
      if (existing) {
        const receipt = await core.threads.send({
          externalThreadId: "old",
          content: "Seed",
          recipientIds: ["north"],
        }, { idempotencyKey: "seed" });
        await client.operations.observe({
          operationIds: [receipt.operationId],
          onFrame() {},
        });
        threadId = (await client.operations.result(receipt.operationId) as {
          threadId: string;
        }).threadId;
        assertEquals(
          (await core.threads.get(threadId)).participants.filter((p) =>
            p.participantType === "agent"
          ).map((p) => p.agentId),
          ["north"],
        );
        calls.clear();
      }
      delegate = true;
      await controller.start(threadId);
      await controller.send("Ask the team to introduce themselves");
      for (let attempt = 0; attempt < 1000; attempt++) {
        const state = controller.getSnapshot();
        if (state.error) throw state.error;
        if (!state.isStreaming && calls.get("north") === 2) break;
        if (attempt === 999) {
          throw new Error(
            `Delegation did not settle: ${JSON.stringify([...calls])}`,
          );
        }
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      assertEquals(Object.fromEntries(calls), { north: 2, west: 2, east: 1 });
      threadId = controller.getSnapshot().currentThreadId!;
      assertEquals(
        (await core.threads.get(threadId)).participants.filter((p) =>
          p.participantType === "agent"
        ).map((p) => p.agentId).sort(),
        [...participants].sort(),
      );
      const history = await core.threads.messages(threadId);
      const question = history.data.filter((message) =>
        message.sender.participantType === "human"
      ).at(-1)!;
      assertEquals(question.recipientIds.length, 1);
      const north = (await core.threads.get(threadId)).participants.find((p) =>
        p.agentId === "north"
      )!;
      assertEquals(question.recipientIds, [north.id]);
      await controller.openThread(threadId);
      const messages = controller.getSnapshot().messages;
      assert(messages.some((message) => message.content === "Answer west"));
      assert(messages.some((message) => message.content === "Answer east"));
      delegate = false;
      await controller.send("Follow up after reload");
      for (
        let attempt = 0;
        attempt < 1000 && controller.getSnapshot().isStreaming;
        attempt++
      ) {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      assertEquals(calls.get("north"), 3);
      assertEquals(calls.get("west"), 2);
      assertEquals(calls.has("south"), false);
    } finally {
      controller.dispose();
      await app.close();
    }
  });
}
