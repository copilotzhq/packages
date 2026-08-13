# @copilotz/chat-adapter

## 0.59.19

### Patch Changes

- Consume the canonical event-native `/channels/web` stream directly instead
  of relying on uppercase compatibility events.
- Reconstruct streamed tool calls from canonical deltas and settle them from
  `tool_execution.*` lifecycle events.
- Accumulate named `tool_output.delta` channels so tool renderers receive live
  output while execution is still running.
- Keep renderer lookup bound to the stable tool ID rather than replacing it
  with a human-readable OpenAPI operation label.
- Replace the tool-call draft class with a factory-based store.

## 0.59.18

### Patch Changes

- Omit the legacy `status=all` wildcard when loading thread history so the
  event-native API returns threads across every status.

## 0.9.50

### Patch Changes

- Send chat input through Copilotz's event-native Web channel envelope.
- Keep the authenticated human as the ingress participant when tool metadata is
  present instead of impersonating the selected agent.
- Send attachment bytes as canonical content using `mediaType`, without copying
  base64 payloads into message metadata.

## 0.9.0

### Minor Changes

- 2e34715: Switch the chat adapter thread and message transport to the new domain API
  surface.

  - use `/v1/threads` instead of `/v1/rest/threads`
  - use `/v1/threads/:id/messages` instead of `/v1/messages`
  - remove the legacy frontend-side thread deletion flow that manually deleted
    messages first

  Clients using `@copilotz/chat-adapter` should expose the domain routes before
  upgrading.
