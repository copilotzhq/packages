# @copilotz/chat-ui

## 0.65.1

### Patch Changes

- Synchronize the frontend package suite with Copilotz tool-result handling.

## 0.65.0

### Minor Changes

- Synchronize the frontend package suite with Copilotz 0.65.0.

## 0.64.2

### Patch Changes

- Synchronize the frontend package suite with Copilotz 0.64.2.

## 0.64.1

### Patch Changes

- Synchronize the frontend package suite with Copilotz 0.64.1.

## 0.64.0

### Minor Changes

- Surface reconnecting and durable stopping states without discarding streamed
  messages, Tool calls, Ask mentions, or reasoning progress.

## 0.60.19

### Patch Changes

- Retain a browser `Blob` for generic file uploads instead of converting those
  files to base64 data URLs before the chat adapter publishes their Asset.

## 0.59.24

### Patch Changes

- Keep adjacent completed answers from different agents in independent message
  groups so each participant retains its own header and avatar.

## 0.59.22

### Patch Changes

- Align the UI package release with Copilotz and the canonical exported-asset
  contract.

## 0.59.21

### Patch Changes

- Add a built-in, inline `ask` renderer that presents public agent questions as
  `@agent` mentions and resolves participant names and colors when available.
- Let applications override built-in tool renderers by stable tool resource ID.

## 0.59.20

### Patch Changes

- Align the UI package release with the canonical history adapter contract.

## 0.59.19

### Patch Changes

- Expose named progressive tool-output channels to custom tool renderers.
- Render live tool output in the generic activity view when no custom renderer
  is registered.
