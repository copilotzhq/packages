import { createCopilotz } from "@copilotz/copilotz";
import { openManagedOminipgDatabase } from "@copilotz/copilotz/persistence";
import { type CopilotzPlugin, definePlugin } from "@copilotz/copilotz/plugins";
import { createServerPlugin } from "@copilotz/copilotz/server";
import { createCoreServerPlugin } from "@copilotz/copilotz/core/server";
import { corePlugin } from "@copilotz/copilotz/core";
import type { LlmAdapter } from "@copilotz/copilotz/llm";

/** Minimal public Gateway/Worker composition used by the contract and browser flow. */
export async function createHttpFixture(modelPlugin?: CopilotzPlugin) {
  const database = await openManagedOminipgDatabase({ url: ":memory:" });
  const adapter: LlmAdapter = {
    call() {
      const bytes = new TextEncoder().encode("Hello 🌎");
      return {
        frames: new ReadableStream({
          start(controller) {
            for (const byte of bytes) {
              controller.enqueue({
                lane: "content",
                mediaType: "text/plain",
                bytes: new Uint8Array([byte]),
              });
            }
            controller.close();
          },
        }),
        result: Promise.resolve({
          content: { type: "text", text: "Hello 🌎", role: "body" },
          attempts: [{
            status: "completed",
            usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          }],
          finishReason: "stop",
        }),
      };
    },
  };
  const shared = {
    database: database.database,
    namespace: "tenant",
    databaseSchema: "core_http_contract",
    engine: { retryBaseMs: 0, random: () => 0 },
    plugins: [
      corePlugin,
      createCoreServerPlugin(),
      modelPlugin ?? definePlugin({
        id: "test.model",
        version: "1",
        resources: {
          agents: {
            support: {
              id: "support",
              name: "Support",
              role: "support",
              instructions: "Reply",
              models: { generate: ["test"] },
              capabilities: { tools: [] },
            },
          },
          models: { test: { adapter: "test", model: "test" } },
        },
        adapters: { llm: { test: adapter } },
      }),
      createServerPlugin({
        authenticate(request) {
          return {
            namespace: "tenant",
            actor: { id: request.headers.get("x-user") ?? "person" },
          };
        },
        authorize(_request, context) {
          return {
            operations: { metadata: { actorId: context.scope.actor!.id } },
          };
        },
      }),
    ],
  };
  const transport = {
    type: "in-process" as const,
    config: { topic: `browser-acceptance.${crypto.randomUUID()}` },
  };
  const application = await createCopilotz({
    ...shared,
    role: "gateway",
    transports: [transport],
    target: { workerId: "browser-worker" },
  });
  const worker = await createCopilotz({
    ...shared,
    role: "worker",
    id: "browser-worker",
    transport,
    capacity: 4,
  });
  await worker.ready;
  return {
    fetch: application.fetch,
    async close() {
      await Promise.allSettled([application.close(), worker.close()]);
      await database.close();
    },
  };
}
