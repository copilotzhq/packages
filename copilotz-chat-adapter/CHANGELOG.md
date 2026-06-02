# @copilotz/chat-adapter

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
