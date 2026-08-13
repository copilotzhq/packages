# @copilotz/chat-adapter

## 0.59.24

### Patch Changes

- Preserve each LLM attempt's agent identity through terminal stream events so
  parallel agent answers keep their sender, avatar, and independent render row
  when the originating agent resumes.

## 0.59.22

### Patch Changes

- Resolve tenant-qualified canonical asset references when downloading message
  attachments.
- Reconcile the live conversation with canonical history after settlement so
  files exported by tools appear as downloadable attachments without embedding
  their bytes in event frames.

## 0.59.21

### Patch Changes

- Preserve independently accumulated text and reasoning for interleaved,
  parallel agent attempts instead of replacing one participant's stream when
  another participant emits a delta.
- Preserve stable tool resource IDs separately from display names across live
  and persisted activity, enabling consistent built-in and custom renderers.
- Reconcile persisted public `ask` questions with their source tool execution
  so the conversational mention is rendered once after refresh.

## 0.59.20

### Patch Changes

- Consume strict canonical compound message history with participant, content,
  LLM-attempt, and tool-execution resources instead of the removed flattened
  REST message DTO.
- Restore text, reasoning, tool calls, projected tool output, failures, and
  attachments after refresh while preserving exact source-message identity.
- Keep live canonical tool-output streaming unchanged and reconcile it with the
  same persisted execution after settlement.

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
