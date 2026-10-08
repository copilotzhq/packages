---
"@copilotz/chat-adapter": patch
---

Deliver conversation and tool-call draft updates to React at most once per task. Bursts of streamed frames, such as several tool calls streaming at once, no longer exceed React's nested update limit (error #185) and stop the chat from updating.
