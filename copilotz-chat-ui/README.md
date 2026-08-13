# @copilotz/chat-ui

**The chat interface your AI agent deserves.**

Chat UI libraries give you message bubbles. Your AI agent has live activity, streaming responses, file uploads, audio recording, persistent threads, and user memories. This gives you everything else.

[![npm](https://img.shields.io/npm/v/@copilotz/chat-ui)](https://www.npmjs.com/package/@copilotz/chat-ui)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18+-61dafb?logo=react&logoColor=white)](https://react.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

---

## The Problem

You're building a frontend for your AI agent. You grab a chat UI library. It renders messages. Great.

Then you need to show assistant activity — the library doesn't support that. Streaming with a native-feeling activity state — you'll build it yourself. File uploads with previews — more custom code. Audio recording — even more. Thread management with search and archive — at this point you're maintaining your own chat UI.

**There's no shadcn for agentic chat. Just parts.**

## The Solution

`@copilotz/chat-ui` is the complete chat interface for AI agents. Everything you need to ship a production chat experience, in one package:

| What You Need | What This Gives You |
|---------------|---------------------|
| Messages | Markdown with syntax highlighting, streaming, and unified assistant activity |
| Assistant Activity | Compact summary, optional details, hidden loader mode |
| Media | Image/audio/video attachments with native playback controls |
| Input | File upload (drag & drop), audio recording, attachment previews |
| Threads | Sidebar with search, archive, date grouping, rename, delete |
| User Profile | Dynamic fields, memories (CRUD), agent vs user distinction |
| Customization | 50+ labels (i18n-ready), feature toggles, theming |

**One package. Backend-agnostic. Production-ready.**

---

## Quick Start

```bash
npm install @copilotz/chat-ui
```

Import the styles once in your app:

```tsx
import '@copilotz/chat-ui/styles.css';
```

Drop in the component:

```tsx
import { ChatUI } from '@copilotz/chat-ui';

function App() {
  const [messages, setMessages] = useState([]);

  return (
    <ChatUI
      messages={messages}
      user={{ id: 'user-1', name: 'Alex' }}
      assistant={{ name: 'Assistant' }}
      callbacks={{
        onSendMessage: (content, attachments) => {
          // Handle message — connect to your backend
        },
      }}
    />
  );
}
```

That's it. You have a full-featured chat interface.

---

## Features

### Messages That Do More

Real-time streaming with a unified assistant activity model. Markdown rendering with syntax highlighting. Activity can render in `full`, `summary`, or `hidden` modes, with detailed reasoning and tool execution folded into one activity surface.

```tsx
const message = {
  id: '1',
  role: 'assistant',
  content: 'Here is the chart you requested.',
  timestamp: Date.now(),
  isStreaming: false,
  activity: {
    isActive: false,
    isComplete: true,
    summary: { kind: 'using_tools', toolName: 'generate_chart' },
    toolCalls: [{
      id: 'tc-1',
      name: 'generate_chart',
      arguments: { type: 'bar', data: [1, 2, 3] },
      result: { url: 'https://...' },
      status: 'completed',
      startTime: 1234567890,
      endTime: 1234567891,
    }],
  },
  attachments: [{
    kind: 'image',
    dataUrl: 'data:image/png;base64,...',
    mimeType: 'image/png',
  }],
};
```

### Input That Works

File uploads with drag & drop. Audio recording with built-in MediaRecorder. Attachment previews with playback controls. Upload progress indicators. Stop generation button during streaming.

### Thread Management

Sidebar with threads grouped by date (Today, Yesterday, etc.). Search and filter. Archive toggle. Create, rename, and delete with confirmation dialogs. Collapsible icon mode for more screen space.

### User Profile

Built-in sheet panel with user info, dynamic custom fields (auto-detects icons based on field names), and a memories section. Memories support CRUD operations and distinguish between agent-created and user-created entries.

### Agent Selector

ChatGPT-style dropdown for switching between multiple agents. Displays agent avatars, names, and descriptions (truncated for long text). Consecutive messages from the same sender are automatically grouped to save screen space.

```tsx
const agents = [
  { id: 'assistant', name: 'Assistant', description: 'General purpose helper' },
  { id: 'coder', name: 'Code Expert', description: 'Specialized in programming', avatarUrl: '/coder.png' },
];

<ChatUI
  agentOptions={agents}
  selectedAgentId="assistant"
  onSelectAgent={(agentId) => setSelectedAgent(agentId)}
  // ... other props
/>
```

---

## Configuration

The configuration system lets you customize everything without touching the component internals.

### Custom Configuration

```tsx
<ChatUI
  config={{
    branding: {
      title: 'Acme Assistant',
      subtitle: 'How can I help you today?',
      logo: <AcmeLogo />,
      avatar: <BotIcon />,
    },
    labels: {
      inputPlaceholder: 'Ask me anything...',
      sendButton: 'Send',
      newChat: 'New Conversation',
      activityThinking: 'Thinking...',
      activityUsingTools: 'Using tools...',
      activityShowDetails: 'Show details',
      activityHideDetails: 'Hide details',
    },
    features: {
      enableThreads: true,
      enableFileUpload: true,
      enableAudioRecording: true,
      enableMessageEditing: true,
      enableMessageCopy: true,
      enableRegeneration: true,
      activityDisplay: 'full',
      maxAttachments: 4,
      maxFileSize: 10 * 1024 * 1024, // 10MB
    },
    ui: {
      theme: 'auto', // 'light' | 'dark' | 'auto'
      showTimestamps: true,
      showAvatars: true,
      compactMode: false,
    },
  }}
/>
```

### Markdown Extensions

By default, `@copilotz/chat-ui` renders messages with:

- `remark-gfm`
- syntax highlighting for non-streaming code blocks
- the built-in markdown component overrides used by the chat UI

If you need more control, you can extend the markdown pipeline through `config.markdown`.

```tsx
import type { Components } from 'react-markdown';

const markdownComponents: Components = {
  code: MyCustomCodeBlock,
};

<ChatUI
  config={{
    markdown: {
      remarkPlugins: [myRemarkPlugin],
      rehypePlugins: [myRehypePlugin],
      components: markdownComponents,
    },
  }}
/>
```

Notes:

- `remarkPlugins` and `rehypePlugins` are appended to the built-in defaults.
- `components` are merged with the built-in markdown component map.
- This is the recommended way to add Mermaid, custom code blocks, callouts, or project-specific markdown behavior without increasing the core `chat-ui` bundle.

Example: Mermaid via a custom `code` renderer

````tsx
function MermaidCodeBlock({ className, children, inline, ...props }) {
  const isMermaid = !inline && /\blanguage-mermaid\b/.test(className || '');

  if (isMermaid) {
    return <MyMermaidRenderer definition={String(children)} />;
  }

  return !inline ? (
    <pre>
      <code className={className} {...props}>
        {children}
      </code>
    </pre>
  ) : (
    <code {...props}>{children}</code>
  );
}

<ChatUI
  config={{
    markdown: {
      components: {
        code: MermaidCodeBlock,
      },
    },
  }}
/>
````

Recommended approach for Mermaid:

- keep Mermaid project-specific instead of bundling it into every `chat-ui` consumer
- lazy-load the Mermaid runtime inside your custom renderer
- render Mermaid only for completed code blocks, not for token-by-token streaming content

### Custom Right Sidebar

Add a custom component to the right sidebar (e.g., profile info, settings, context):

```tsx
<ChatUI
  config={{
    customComponent: {
      label: 'Profile',
      icon: <User />,
      component: ({ onClose, isMobile }) => (
        <div className="p-4">
          <h2>User Profile</h2>
          <button onClick={onClose}>Close</button>
        </div>
      ),
    },
  }}
/>
```

---

## Callbacks

All user interactions are handled through callbacks. This keeps the component purely presentational — you control the data.

```tsx
<ChatUI
  callbacks={{
    // Messages
    onSendMessage: (content, attachments, stateCallback) => {},
    onEditMessage: (messageId, newContent, stateCallback) => {},
    onDeleteMessage: (messageId, stateCallback) => {},
    onRegenerateMessage: (messageId, stateCallback) => {},
    onCopyMessage: (messageId, content, stateCallback) => {},
    onStopGeneration: (stateCallback) => {},

    // Threads
    onCreateThread: (title, stateCallback) => {},
    onSelectThread: (threadId, stateCallback) => {},
    onRenameThread: (threadId, newTitle, stateCallback) => {},
    onDeleteThread: (threadId, stateCallback) => {},
    onArchiveThread: (threadId, stateCallback) => {},

    // User Menu
    onViewProfile: () => {},
    onOpenSettings: () => {},
    onThemeChange: (theme) => {}, // 'light' | 'dark' | 'system'
    onLogout: () => {},
  }}
/>
```

---

## Props Reference

### ChatUI

| Prop | Type | Description |
|------|------|-------------|
| `messages` | `ChatMessage[]` | Array of messages to display |
| `threads` | `ChatThread[]` | Array of conversation threads |
| `currentThreadId` | `string \| null` | Currently selected thread ID |
| `config` | `ChatConfig` | Configuration object |
| `callbacks` | `ChatCallbacks` | Event handlers |
| `isGenerating` | `boolean` | Whether the assistant is generating a response |
| `user` | `{ id, name?, avatar?, email? }` | Current user info |
| `assistant` | `{ name?, avatar?, description? }` | Assistant info |
| `suggestions` | `string[]` | Suggested prompts shown when no messages |
| `agentOptions` | `AgentOption[]` | Available agents for the selector dropdown |
| `selectedAgentId` | `string \| null` | Currently selected agent ID |
| `onSelectAgent` | `(agentId: string) => void` | Called when user selects an agent |
| `initialInput` | `string` | Pre-fill the input field (e.g., from URL params) |
| `onInitialInputConsumed` | `() => void` | Called when initial input is modified/sent |
| `className` | `string` | Additional CSS classes |

### ChatConfig Markdown

```typescript
interface ChatMarkdownConfig {
  remarkPlugins?: ReactMarkdownOptions['remarkPlugins'];
  rehypePlugins?: ReactMarkdownOptions['rehypePlugins'];
  components?: Components;
}
```

```typescript
interface ChatConfig {
  // ...
  markdown?: ChatMarkdownConfig;
}
```

### ChatMessage

```typescript
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  attachments?: MediaAttachment[];
  isStreaming?: boolean;
  isComplete?: boolean;
  isEdited?: boolean;
  activity?: AssistantActivityState;
  metadata?: Record<string, any>;
}
```

```typescript
interface AssistantActivityState {
  isActive: boolean;
  isComplete?: boolean;
  summary: {
    kind: 'thinking' | 'working' | 'using_tools' | 'preparing_answer';
    toolName?: string;
    toolCount?: number;
  };
  reasoning?: string;
  toolCalls?: ToolCall[];
}
```

### MediaAttachment

```typescript
type MediaAttachment =
  | { kind: 'image'; dataUrl: string; mimeType: string; fileName?: string }
  | { kind: 'audio'; dataUrl: string; mimeType: string; durationMs?: number }
  | { kind: 'video'; dataUrl: string; mimeType: string; poster?: string };
```

### ToolCall

```typescript
interface ToolCall {
  id: string;
  toolId?: string; // Stable Copilotz resource ID used for renderer lookup
  name: string;
  arguments: Record<string, any>;
  result?: any;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime?: number;
  endTime?: number;
}
```

Tool renderers are keyed by stable `toolId`. Copilotz ships an inline renderer
for the public `ask` capability; application renderers override built-ins:

```tsx
<ChatUI
  toolRenderers={{
    ask: CustomAskRenderer,
    terminal: TerminalRenderer,
  }}
/>
```

### AgentOption

```typescript
interface AgentOption {
  id: string;
  name: string;
  description?: string;  // Shown in dropdown (truncated to 2 lines)
  avatarUrl?: string;    // Agent avatar image
}
```

---

## Exports

```tsx
// Primary components
export { ChatUI } from './components/chat/ChatUI';
export { AssistantActivity } from './components/chat/AssistantActivity';
export { AskToolRenderer, builtInToolRenderers } from './components/chat/AskToolRenderer';
export { ChatUserContextProvider, useChatUserContext } from './components/chat/UserContext';

// Configuration
export { defaultChatConfig, mergeConfig } from './config/chatConfig';

// Types
export type * from './types/chatTypes';
```

---

## Styling

The package ships with compiled CSS that includes all necessary styles. Import it once:

```tsx
import '@copilotz/chat-ui/styles.css';
```

### Theming

The component respects the `dark` class on your document root. Set `ui.theme` to `'light'`, `'dark'`, or `'auto'` (follows system preference).

### CSS Variables

Override CSS variables to customize colors (uses Tailwind/shadcn conventions):

```css
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --primary: 222.2 47.4% 11.2%;
  --primary-foreground: 210 40% 98%;
  /* ... */
}
```

---

## Requirements

- React 18+
- Tailwind CSS 4+ (for custom styling, optional)

---

## Works With Any Backend

This package is purely presentational. It doesn't make API calls or manage state. You provide the data, it renders the UI.

Works with:
- **Copilotz** — use `@copilotz/chat-adapter` for seamless integration
- **OpenAI** — connect to the Chat Completions API
- **Anthropic** — connect to Claude
- **LangChain** — use with any LangChain backend
- **Custom backends** — any API that returns messages

---

## License

MIT — see [LICENSE](./LICENSE)

---

<p align="center">
  <strong>Ship your agent's interface, not your UI backlog.</strong>
</p>
