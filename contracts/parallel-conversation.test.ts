import { assert, assertEquals } from "@std/assert";
import { defineAction } from "@copilotz/copilotz/actions";
import { createCopilotzClient } from "@copilotz/copilotz/client";
import { createCoreClient } from "@copilotz/copilotz/core/client";
import type {
  LlmAdapter,
  LlmAdapterResult,
  LlmToolCall,
} from "@copilotz/copilotz/llm";
import { definePlugin } from "@copilotz/copilotz/plugins";
import { defineTool } from "@copilotz/copilotz/tools";
import { createChatController } from "@copilotz/chat-adapter/controller";
import { createHttpFixture } from "./http-fixture.ts";

Deno.test("parallel Agents, nested asks and pipelines retain exact identities through the facade and chat projection", async () => {
  let releaseContinuation!: () => void;
  const continuation = new Promise<void>(resolve => releaseContinuation = resolve);
  let sawLiveCompletion = false;
  const executions: string[] = [];
  const calls = new Map<string, number>();
  const mark = defineAction({
    id: "test.mark",
    execute(input: { agent: string }) {
      executions.push(`mark:${input.agent}`);
      return { agent: input.agent, marked: true };
    },
  });
  const verify = defineAction({
    id: "test.verify",
    execute(input: { agent: string; marked: boolean; expected: string }) {
      assertEquals(input.agent, input.expected);
      assertEquals(input.marked, true);
      executions.push(`verify:${input.agent}`);
      return { verified: input.agent };
    },
  });
  const tools = {
    mark: defineTool("mark", mark, {
      name: "Mark",
      description: "Mark one pipeline.",
    }),
    verify: defineTool("verify", verify, {
      name: "Verify",
      description: "Verify its pipe.",
    }),
  };
  const adapter: LlmAdapter = {
    call(input) {
      const agent = /ACTIVE_AGENT=([a-z]+)/.exec(
        input.request.instructions ?? "",
      )?.[1];
      if (!agent) throw new Error("Missing active Agent.");
      const count = (calls.get(agent) ?? 0) + 1;
      calls.set(agent, count);
      const toolCalls: LlmToolCall[] = agent !== "c" && count === 1
        ? [{
          id: "provider-reuses-this-id",
          action: "mark",
          input: { agent },
          pipeline: {
            id: "provider-reuses-this-pipeline-id",
            stages: [
              {
                type: "tool",
                id: "provider-reuses-this-id",
                action: "mark",
                input: { agent },
              },
              {
                type: "tool",
                id: "provider-reuses-this-id:verify",
                action: "verify",
                input: { expected: agent },
              },
            ],
          },
        }]
        : [];
      if (agent === "a" && count === 1) {
        toolCalls.push({
          id: "ask-c",
          action: "ask",
          input: { target: "c", message: "Nested question" },
        });
      }
      const answer = toolCalls.length ? "" : `Answer ${agent} 🌎`;
      const result: LlmAdapterResult = {
        content: answer ? { type: "text", role: "body", text: answer } : [],
        toolCalls,
        attempts: [{ status: "completed" }],
        finishReason: toolCalls.length ? "tool_calls" : "stop",
      };
      return {
        result: agent === "b" && count > 1 ? continuation.then(() => result) : Promise.resolve(result),
        frames: new ReadableStream({
          async start(controller) {
            for (const byte of new TextEncoder().encode(answer)) {
              controller.enqueue({
                lane: "content",
                mediaType: "text/plain",
                bytes: new Uint8Array([byte]),
              });
              await new Promise((resolve) => setTimeout(resolve, 1));
            }
            controller.close();
          },
        }),
      };
    },
  };
  const app = await createHttpFixture(definePlugin({
    id: "test.parallel-http",
    version: "1",
    actions: { mark, verify },
    resources: {
      agents: Object.fromEntries(["a", "b", "c"].map((id) => [id, {
        id,
        name: id.toUpperCase(),
        role: "assistant",
        instructions: `ACTIVE_AGENT=${id}`,
        models: { generate: ["test"] },
        capabilities: {
          tools: Object.keys(tools),
          ...(id === "a" ? { agents: ["c"] } : {}),
        },
      }])),
      models: { test: { adapter: "test", model: "test" } },
      tools,
    },
    adapters: { llm: { test: adapter } },
  }));
  const client = createCopilotzClient({
    baseUrl: "https://test/api",
    fetch: ((url, init) => app.fetch(new Request(url, init))) as typeof fetch,
  });
  const controller = createChatController(createCoreClient(client), {
    userId: "person",
    participants: ["a", "b", "c"],
  });
  controller.subscribe(() => {
    const state = controller.getSnapshot();
    if (state.isStreaming && state.messages.some(message => message.activity?.items.some(item => item.kind === "tool" && item.status === "complete"))) {
      sawLiveCompletion = true;
      releaseContinuation();
    }
  });
  try {
    await controller.start();
    await controller.send("Run both pipelines and a nested ask.");
    for (let index = 0; index < 1000; index++) {
      const state = controller.getSnapshot();
      if (state.error) throw state.error;
      if (
        !state.isStreaming && state.messages.some((message) =>
          message.content === "Answer a 🌎"
        ) && state.messages.some((message) => message.content === "Answer b 🌎")
      ) break;
      if (index === 999) {
        throw new Error(
          `Parallel conversation did not settle: ${
            JSON.stringify({
              calls: [...calls],
              executions,
              messages: state.messages.map((message) => ({
                content: message.content,
                role: message.role,
                sender: message.sender,
                activity: message.activity,
              })),
            })
          }`,
        );
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    assertEquals(sawLiveCompletion, true);
    assertEquals(executions.sort(), [
      "mark:a",
      "mark:b",
      "verify:a",
      "verify:b",
    ]);
    assertEquals(calls.get("c"), 2);
    const messages = controller.getSnapshot().messages;
    for (const agent of ["a", "b"]) {
      const answer = messages.filter((message) =>
        message.content === `Answer ${agent} 🌎`
      );
      assertEquals(answer.length, 1);
      assertEquals(answer[0].sender?.agentId, agent);
    }
    const activity = messages.flatMap((message) =>
      message.activity?.items ?? []
    ).filter((item) => item.kind === "tool");
    assert(activity.length >= 2);
    const ids = messages.map((message) => message.id);
    assertEquals(new Set(ids).size, ids.length);
    await controller.openThread(controller.getSnapshot().currentThreadId!);
    assertEquals(
      controller.getSnapshot().messages.map((message) => message.id),
      ids,
    );
  } finally {
    releaseContinuation();
    controller.dispose();
    await app.close();
  }
});
