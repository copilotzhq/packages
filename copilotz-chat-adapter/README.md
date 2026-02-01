# @copilotz/chat-adapter

**From zero to agentic chat in one component.**

You built your AI with [Copilotz](https://github.com/copilotzhq/ts-lib). Now you need a frontend. You could wire up SSE streaming, thread persistence, tool call status updates, asset resolution, audio conversion, and context management. Or you could ship today.

[![npm](https://img.shields.io/npm/v/@copilotz/chat-adapter)](https://www.npmjs.com/package/@copilotz/chat-adapter)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18+-61dafb?logo=react&logoColor=white)](https://react.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

---

## The Problem

Your Copilotz backend handles memory, RAG, tool calling, and multi-tenancy. Now you need to connect it to a chat interface.

You could:
- Set up SSE streaming and parse token events
- Manage thread state and sync with the server
- Track tool call status in real-time (pending → running → completed)
- Convert browser-recorded audio to a format the API accepts
- Resolve `asset://` references to displayable data URLs
- Handle optimistic updates for instant feedback
- Wire up user context and memory sync

Or you could use one component.

## The Solution

`@copilotz/chat-adapter` is the official frontend binding for Copilotz. It wraps `@copilotz/chat-ui` with full API integration:

| What You'd Build | What This Gives You |
|------------------|---------------------|
| SSE parsing | Token-by-token streaming with cursor animation |
| Thread sync | Automatic fetch, create, rename, archive, delete |
| Tool status | Real-time updates as tools run |
| Audio handling | WebM/Opus → WAV conversion for API compatibility |
| Asset resolution | `asset://` refs → data URLs automatically |
| Context management | Shared user context across components |
| Error handling | Graceful fallbacks and retry logic |

**One component. Full Copilotz integration.**

---

## Quick Start

```bash
npm install @copilotz/chat-adapter
```

Import the styles (from the UI package):

```tsx
import '@copilotz/chat-ui/styles.css';
```

Drop in the component:

```tsx
import { CopilotzChat } from '@copilotz/chat-adapter';

function App() {
  return (
    <CopilotzChat
      userId="user-123"
      userName="Alex"
      config={{
        branding: {
          title: 'Acme Assistant',
          subtitle: 'How can I help you today?',
        },
      }}
    />
  );
}
```

That's it. You have a production chat interface connected to your Copilotz backend.

---

## Environment Variables

Configure the API connection:

```bash
# Base URL for the Copilotz API (default: /api)
VITE_API_URL=https://api.example.com

# Optional: API key for authenticated requests
VITE_API_KEY=your-api-key
# or
VITE_COPILOTZ_API_KEY=your-api-key
```

---

## Features

### Real-Time Streaming

Messages stream token-by-token with a thinking indicator while waiting for the first token. No configuration needed — it just works.

```tsx
<CopilotzChat userId="user-123" />
```

### Tool Calls with Live Status

When your agent calls tools, the UI shows real-time status updates:

1. **Pending** — Tool call received
2. **Running** — Tool is executing
3. **Completed/Failed** — Result displayed with execution time

All automatic. Just enable tool display in config:

```tsx
<CopilotzChat
  userId="user-123"
  config={{
    features: { enableToolCallsDisplay: true },
  }}
/>
```

### Bootstrap Conversations

Start conversations with an initial message or trigger tool calls immediately:

```tsx
<CopilotzChat
  userId="user-123"
  bootstrap={{
    initialMessage: "Hello! I'm looking for help with my order.",
    initialToolCalls: [
      { name: 'get_user_orders', args: { limit: 5 } },
    ],
  }}
/>
```

### Audio Recording

Record voice messages directly in the chat. The adapter automatically converts browser-recorded audio (WebM/Opus) to WAV format for API compatibility.

### Asset Resolution

When your agent generates images or files, they're stored as `asset://` references. The adapter automatically resolves these to displayable data URLs.

### User Context

Share context across your app and sync with the Copilotz backend:

```tsx
<CopilotzChat
  userId="user-123"
  initialContext={{
    profile: { subscription: 'pro', preferences: { theme: 'dark' } },
    customFields: [
      { key: 'company', label: 'Company', value: 'Acme Corp' },
    ],
  }}
  onToolOutput={(output) => {
    // React to tool outputs (e.g., context updates)
    console.log('Tool output:', output);
  }}
/>
```

### Agent Selector

Switch between multiple agents with a ChatGPT-style dropdown. The selected agent's name is passed to the Copilotz backend via `preferredAgentName`.

```tsx
const [selectedAgent, setSelectedAgent] = useState('assistant');

const agents = [
  { id: 'assistant', name: 'Assistant', description: 'General purpose helper' },
  { id: 'coder', name: 'Code Expert', description: 'Specialized in programming' },
];

<CopilotzChat
  userId="user-123"
  agentOptions={agents}
  selectedAgentId={selectedAgent}
  onSelectAgent={setSelectedAgent}
/>
```

### URL State Sync

Persist chat state in URL parameters for shareable links, bookmarks, and deep linking from external sources.

**Features:**
- `?thread=abc123` — Open a specific conversation
- `?agent=support-bot` — Pre-select an agent
- `?prompt=Hello` — Pre-fill or auto-send a message

```tsx
// Basic usage - enable URL sync
<CopilotzChat
  userId="user-123"
  urlSync={{ enabled: true }}
/>

// With custom parameter names
<CopilotzChat
  userId="user-123"
  urlSync={{
    enabled: true,
    params: { thread: 't', agent: 'a', prompt: 'q' },
  }}
/>

// Auto-send the prompt instead of pre-filling
<CopilotzChat
  userId="user-123"
  urlSync={{
    enabled: true,
    promptBehavior: 'auto-send',
  }}
/>
```

**URL Sync Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | `boolean` | `true` | Enable/disable URL sync |
| `mode` | `'push' \| 'replace' \| 'read-only'` | `'replace'` | How to update URL |
| `params.thread` | `string` | `'thread'` | URL param name for thread ID |
| `params.agent` | `string` | `'agent'` | URL param name for agent ID |
| `params.prompt` | `string` | `'prompt'` | URL param name for initial prompt |
| `promptBehavior` | `'prefill' \| 'auto-send'` | `'prefill'` | How to handle the prompt param |
| `clearPromptAfterRead` | `boolean` | `true` | Remove prompt from URL after use |

**Example URLs:**
```
/chat?thread=abc123                      # Open specific thread
/chat?agent=support-bot                  # Pre-select agent
/chat?prompt=How%20do%20I%20reset...     # Pre-fill message
/chat?thread=abc123&agent=support&prompt=Hi  # Combined
```

---

## Props Reference

### CopilotzChat

| Prop | Type | Description |
|------|------|-------------|
| `userId` | `string` | Required. User identifier for thread filtering |
| `userName` | `string` | Display name for the user |
| `userAvatar` | `string` | URL to user's avatar image |
| `userEmail` | `string` | User's email address |
| `initialContext` | `ChatUserContext` | Initial context to seed the conversation |
| `bootstrap` | `{ initialMessage?, initialToolCalls? }` | Start conversation with message/tools |
| `config` | `ChatConfig` | UI configuration (same as `@copilotz/chat-ui`) |
| `callbacks` | `Partial<ChatCallbacks>` | Additional event handlers |
| `customComponent` | `ReactNode \| Function` | Custom right sidebar panel |
| `onToolOutput` | `(output) => void` | Called when a tool produces output |
| `onLogout` | `() => void` | Called when user clicks logout |
| `onViewProfile` | `() => void` | Called when user clicks view profile |
| `onAddMemory` | `(content, category?) => void` | Called when user adds a memory |
| `onUpdateMemory` | `(memoryId, content) => void` | Called when user updates a memory |
| `onDeleteMemory` | `(memoryId) => void` | Called when user deletes a memory |
| `suggestions` | `string[]` | Suggested prompts shown when no messages |
| `agentOptions` | `AgentOption[]` | Available agents for the selector dropdown |
| `selectedAgentId` | `string \| null` | Currently selected agent ID |
| `onSelectAgent` | `(agentId: string) => void` | Called when user selects an agent |
| `urlSync` | `UrlSyncConfig` | URL state synchronization config (see URL State Sync section) |
| `className` | `string` | Additional CSS classes |

---

## Hooks

### useCopilotz

For custom integrations, use the hook directly:

```tsx
import { useCopilotz } from '@copilotz/chat-adapter';

function CustomChat() {
  const {
    messages,
    threads,
    currentThreadId,
    isStreaming,
    userContextSeed,
    sendMessage,
    createThread,
    selectThread,
    renameThread,
    archiveThread,
    deleteThread,
    stopGeneration,
    reset,
  } = useCopilotz({
    userId: 'user-123',
    initialContext: { /* ... */ },
    bootstrap: { initialMessage: 'Hello!' },
    defaultThreadName: 'Support Chat',
    onToolOutput: (output) => console.log(output),
  });

  return (
    <div>
      {messages.map((msg) => (
        <div key={msg.id}>{msg.content}</div>
      ))}
      <button onClick={() => sendMessage('Hello!')}>Send</button>
    </div>
  );
}
```

### Hook Options

| Option | Type | Description |
|--------|------|-------------|
| `userId` | `string \| null` | User identifier (null resets state) |
| `initialContext` | `ChatUserContext` | Initial context seed |
| `bootstrap` | `{ initialMessage?, initialToolCalls? }` | Auto-start conversation |
| `defaultThreadName` | `string` | Name for bootstrap thread |
| `onToolOutput` | `(output) => void` | Tool output callback |
| `preferredAgentName` | `string \| null` | Agent name to use for requests |
| `urlSync` | `UrlSyncConfig` | URL state synchronization config |

### Hook Returns

| Property | Type | Description |
|----------|------|-------------|
| `messages` | `ChatMessage[]` | Current thread messages |
| `threads` | `ChatThread[]` | All user threads |
| `currentThreadId` | `string \| null` | Selected thread ID |
| `isStreaming` | `boolean` | Whether response is streaming |
| `userContextSeed` | `ChatUserContext` | Current user context |
| `sendMessage` | `(content, attachments?) => Promise` | Send a message |
| `createThread` | `(title?) => void` | Create new thread |
| `selectThread` | `(threadId) => Promise` | Switch threads |
| `renameThread` | `(threadId, title) => Promise` | Rename thread |
| `archiveThread` | `(threadId) => Promise` | Archive/unarchive |
| `deleteThread` | `(threadId) => Promise` | Delete thread |
| `stopGeneration` | `() => void` | Stop streaming |
| `reset` | `() => void` | Clear all state |
| `initialPrompt` | `string \| null` | Initial prompt from URL (if urlSync enabled) |
| `clearInitialPrompt` | `() => void` | Clear initial prompt from URL |
| `urlAgentId` | `string \| null` | Agent ID from URL (if urlSync enabled) |
| `setUrlAgentId` | `(agentId) => void` | Update agent ID in URL |

---

## Services

### copilotzService

Low-level API client for direct backend communication:

```tsx
import { 
  runCopilotzStream, 
  fetchThreads, 
  fetchThreadMessages,
  updateThread,
  deleteThread,
} from '@copilotz/chat-adapter';

// Stream a message
const result = await runCopilotzStream({
  content: 'Hello!',
  user: { externalId: 'user-123', name: 'Alex' },
  threadExternalId: 'thread-456',
  onToken: (text, isComplete) => console.log(text),
  onMessageEvent: (event) => console.log(event),
  onAssetEvent: (asset) => console.log(asset),
});

// Fetch threads
const threads = await fetchThreads('user-123');

// Fetch messages
const messages = await fetchThreadMessages('thread-456');
```

### assetsService

Resolve asset references to data URLs:

```tsx
import { getAssetDataUrl, resolveAssetsInMessages } from '@copilotz/chat-adapter';

// Single asset
const { dataUrl, mime } = await getAssetDataUrl('asset://abc123');

// Batch resolve in messages
const messagesWithAssets = await resolveAssetsInMessages(messages);
```

---

## Exports

```tsx
// Components
export { CopilotzChat } from './CopilotzChat';

// Hooks
export { useCopilotz } from './useCopilotzChat';
export { useUrlState } from './useUrlState';

// Services
export { 
  runCopilotzStream, 
  fetchThreads, 
  fetchThreadMessages, 
  updateThread, 
  deleteThread,
  copilotzService,
} from './copilotzService';

export { 
  getAssetDataUrl, 
  resolveAssetsInMessages,
} from './assetsService';

// Re-exported types from @copilotz/chat-ui
export type { 
  ChatConfig, 
  ChatCallbacks, 
  ChatUserContext, 
  ChatMessage, 
  ChatThread, 
  MediaAttachment, 
  MemoryItem,
} from '@copilotz/chat-ui';

// URL state types
export type { 
  UrlSyncConfig, 
  UrlParamsConfig, 
  UrlState, 
  UseUrlStateReturn,
} from './useUrlState';
```

---

## Full Example

```tsx
import { CopilotzChat } from '@copilotz/chat-adapter';
import '@copilotz/chat-ui/styles.css';

function App() {
  const handleLogout = () => {
    // Clear session, redirect to login
  };

  const handleToolOutput = (output) => {
    // React to tool outputs
    if (output.userContext) {
      // Context was updated by a tool
    }
  };

  return (
    <CopilotzChat
      userId="user-123"
      userName="Alex"
      userEmail="alex@example.com"
      initialContext={{
        customFields: [
          { key: 'plan', label: 'Plan', value: 'Pro' },
        ],
      }}
      bootstrap={{
        initialMessage: 'Hello! I need help with my account.',
      }}
      config={{
        branding: {
          title: 'Acme Support',
          subtitle: 'We typically reply in a few seconds',
        },
        features: {
          enableToolCallsDisplay: true,
          enableFileUpload: true,
          enableAudioRecording: true,
        },
        labels: {
          inputPlaceholder: 'Describe your issue...',
        },
      }}
      customComponent={({ onClose, isMobile }) => (
        <div className="p-4">
          <h2>Account Details</h2>
          <button onClick={onClose}>Close</button>
        </div>
      )}
      onToolOutput={handleToolOutput}
      onLogout={handleLogout}
    />
  );
}
```

---

## Requirements

- React 18+
- Copilotz backend with `/v1/providers/web` endpoint
- Environment variables configured

---

## Related Packages

- **[@copilotz/chat-ui](../copilotz-chat-ui)** — The underlying UI components (backend-agnostic)
- **[copilotz](https://github.com/copilotzhq/ts-lib)** — The full-stack framework for AI applications

---

## License

MIT — see [LICENSE](./LICENSE)

---

<p align="center">
  <strong>Your agent is ready. Your UI should be too.</strong>
</p>
