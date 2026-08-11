# @copilotz/chat-adapter

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
