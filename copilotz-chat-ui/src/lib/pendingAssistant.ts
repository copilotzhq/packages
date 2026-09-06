import type { ChatMessage, ChatSender } from "../types/chatTypes";

/** Presentation-only placeholder; it never enters the conversation history. */
export function withPendingAssistant(
  messages: ChatMessage[],
  active: boolean,
  sender?: ChatSender
): ChatMessage[] {
  if (
    !active ||
    messages.some(
      (message) => message.role === "assistant" && message.isStreaming
    )
  )
    return messages;
  const last = messages.at(-1);
  return [
    ...messages,
    {
      id: `waiting:${last?.id ?? "new"}`,
      role: "assistant",
      content: "",
      timestamp: last?.timestamp ?? 0,
      isStreaming: true,
      sender,
      activity: {
        items: [{ id: "waiting", kind: "thinking", status: "active" }],
      },
    },
  ];
}
