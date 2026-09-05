import { assertEquals } from "@std/assert";
import { createCopilotzClient } from "@copilotz/copilotz/client";
import { createCoreClient } from "@copilotz/copilotz/core/client";
import { createChatController } from "@copilotz/chat-adapter/controller";
import { createHttpFixture } from "./http-fixture.ts";

Deno.test("public facade, browser client, and controller reconcile send, reload, follow-up, editing, and attachments", async () => {
  const application = await createHttpFixture();
  const handler = application.fetch;
  const client = createCopilotzClient({
    baseUrl: "https://test/api",
    fetch: ((url, init) => handler(new Request(url, init))) as typeof fetch,
  });
  const core = createCoreClient(client);
  const controller = createChatController(core, {
    userId: "person",
    preferredAgentName: "support",
  });
  const waitFor = async (predicate: () => boolean) => {
    for (let attempt = 0; attempt < 200; attempt++) {
      if (predicate()) return;
      if (controller.getSnapshot().error) throw controller.getSnapshot().error;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    throw new Error(
      `Controller did not settle: ${JSON.stringify(controller.getSnapshot())}`,
    );
  };
  try {
    await controller.start();
    await controller.send("Hi");
    await waitFor(() =>
      controller.getSnapshot().messages.some((message) =>
        message.role === "assistant" && message.content === "Hello 🌎"
      ) && !controller.getSnapshot().isStreaming
    );
    const threadId = controller.getSnapshot().currentThreadId!;
    assertEquals(typeof threadId, "string");
    assertEquals(controller.getSnapshot().messages.length, 2);
    await controller.openThread(threadId);
    assertEquals(controller.getSnapshot().messages.length, 2);
    await controller.send("Follow up");
    await waitFor(() =>
      controller.getSnapshot().messages.length === 4 &&
      !controller.getSnapshot().isStreaming
    );
    assertEquals(
      controller.getSnapshot().messages.filter((message) =>
        message.content === "Follow up"
      ).length,
      1,
    );
    await controller.send("Attachment", [{
      kind: "file",
      mimeType: "text/plain",
      fileName: "note.txt",
      dataUrl: "data:text/plain;base64,aGVsbG8=",
    }]);
    await waitFor(() =>
      controller.getSnapshot().messages.length === 6 &&
      !controller.getSnapshot().isStreaming
    );
    await controller.openThread(threadId);
    const attached = controller.getSnapshot().messages.find((message) =>
      message.content === "Attachment"
    );
    assertEquals(attached?.attachments?.[0].fileName, "note.txt");
    assertEquals(
      attached?.attachments?.[0].dataUrl,
      "data:text/plain;base64,aGVsbG8=",
    );
    const original = controller.getSnapshot().messages.find((message) =>
      message.role === "user"
    )!;
    await controller.editMessage(original.id, "Edited first message");
    await waitFor(() =>
      !controller.getSnapshot().isStreaming &&
      controller.getSnapshot().messages.some((message) =>
        message.content === "Edited first message"
      )
    );
    const beforeReload = controller.getSnapshot().messages.map((message) =>
      message.id
    );
    await controller.openThread(threadId);
    assertEquals(
      controller.getSnapshot().messages.map((message) => message.id),
      beforeReload,
    );
  } finally {
    controller.dispose();
    await new Promise((resolve) => setTimeout(resolve, 50));
    await application.close();
  }
});
