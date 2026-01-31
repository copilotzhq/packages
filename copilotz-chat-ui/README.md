# @copilotz/chat-ui

Reusable Copilotz chat UI components (React + TypeScript).

## Install

```bash
npm install @copilotz/chat-ui
```

## Styles

This package ships a compiled stylesheet. Import it once in your app:

```ts
import '@copilotz/chat-ui/styles.css';
```

## Usage

```tsx
import { ChatUI, defaultChatConfig } from '@copilotz/chat-ui';

export function Example() {
  return (
    <ChatUI
      config={defaultChatConfig}
      user={{ id: 'user-1', name: 'User' }}
      assistant={{ name: 'Assistant' }}
      callbacks={{
        onSendMessage: (content, attachments) => {
          console.log(content, attachments);
        }
      }}
    />
  );
}
```
