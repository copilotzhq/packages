# @copilotz/chat-adapter 0.66.4

Model fallback replaces provisional candidate output without mixing failed reasoning into the final response. Pending submissions keep the ordinary assistant Thinking activity visible until live output arrives.

The UI custom-component panel supports pointer and keyboard resizing. Set `customComponent.panelWidth` for its initial width and optionally `customComponent.panelWidthStorageKey` to remember a user-selected width in local storage.

The Copilotz chat integration uses the library's canonical `/api` facade and
browser client. `CopilotzChat` remains the main component; `@copilotz/chat-ui`
remains backend-agnostic.

```tsx
import { CopilotzChat } from '@copilotz/chat-adapter';
import '@copilotz/chat-ui/styles.css';

<CopilotzChat
  userId="signed-in-user"
  userName="Alex"
  baseUrl="/api"
  getRequestHeaders={getRequestHeaders}
  spaceService={spaceService}
/>;
```

`userId` and presentation options select local UI state. The authenticated server
supplies executable sender identity, namespace and database scope. Request headers
come from the application; this package does not read credentials from build-time
environment variables.

### Spaces

Spaces are supplied through an explicit host-owned service. The service must
authorize the signed-in actor and enforce conversation membership on every
request; Core's generic collection client does not grant Space access by
itself.

```ts
const spaceService = {
  list: ({ signal } = {}) => api.listSpaces({ signal }),
  create: (name, { signal } = {}) => api.createSpace({ name, signal }),
  move: (threadId, spaceId, { signal } = {}) =>
    api.moveConversation({ threadId, spaceId, signal }),
};
```

`list` returns `ChatSpace` values (`id`, `name`, optional `status`, and optional
`threadIds`). `threadIds` is a projection fallback; each conversation is
assigned from one authoritative `spaceId` when the host provides it. The
controller exposes Spaces in its snapshot, groups conversations once, and
optimistically moves them. A rejected move restores its previous placement.
Successful moves remain committed when a later refresh fails; the refresh error
is reported while Date navigation continues to work. Without `spaceService`,
the adapter keeps the ordinary Date sidebar and does not show Space controls.

For custom interfaces, `useCopilotzChat` subscribes to the same controller. For
non-React hosts:

```ts
import { createCopilotzClient } from '@copilotz/copilotz/client';
import { createCoreClient } from '@copilotz/copilotz/core/client';
import { createChatController } from '@copilotz/chat-adapter/controller';

const client = createCopilotzClient({ baseUrl: '/api', getRequestHeaders });
const controller = createChatController(createCoreClient(client), {
  userId: 'signed-in-user',
});
const unsubscribe = controller.subscribe(() => render(controller.getSnapshot()));
await controller.start();
await controller.openThread(threadId);
await controller.send('Hello');
await controller.stop();
unsubscribe();
controller.dispose();
```

The controller owns history bootstrap, pagination, observation, reconciliation,
retries and explicit cancellation. Disposing or changing threads detaches the
connection without cancelling durable work. Stop cancels operations belonging to
the selected conversation, including a submission whose receipt arrives later.

Pure projection preserves independent Action and stream identities, split UTF-8,
interleaved Agents, reasoning, tool drafts and binary outputs. Attachments upload
as raw Assets; messages carry canonical content references. Stored conversations
and Assets use their existing format.

The hook owns React lifecycle and URL state. Multipart parsing and checkpoints
live exclusively in the shared library client, whose awaited frame callback
commits progress only after successful application. There is no SSE parser,
versioned endpoint fallback or internal HTTP client in this package.

This release must be deployed with Copilotz 0.66.4 and synchronized frontend
packages. It intentionally provides no transport compatibility with older servers.

## npm installation

The canonical Copilotz client is published on JSR. Configure its npm scope in
the consuming application's `.npmrc` before installing this package:

```ini
@jsr:registry=https://npm.jsr.io
```

The adapter pins that client's npm alias and its UI peer to the synchronized
release versions. No server or model-provider modules enter the browser bundle.

`participantIds` selects the agent team; `targetAgentId` selects who receives the
next message. The controller sends both selections to Core, so a selected agent
can ask its authorized teammates without broadcasting the initial message.

Core history returns authorized content with reference metadata and resolved values.
The browser client decodes binary values through the shared content codec, and the
adapter projects those values without per-Asset HTTP requests or a byte cache.
Status-only tool bodies are excluded before content resolution. The explicit
message Asset endpoint remains available for downloads.

History checkpoints still coordinate retained stream prefixes and live observation;
resolved history does not replace stream ordering or terminal outcomes. A terminal
observation error clears the streaming indicator while preserving operation
identities for explicit cancellation.
