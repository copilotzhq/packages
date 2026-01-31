# @copilotz/chat-adapter

Copilotz API adapter and ready-to-use `CopilotzChat` wrapper for the chat UI.

## Install

```bash
npm install @copilotz/chat-adapter
```

## Usage

```tsx
import { CopilotzChat } from '@copilotz/chat-adapter';
import '@copilotz/chat-ui/styles.css';

export function Example() {
  return (
    <CopilotzChat
      userId="user-1"
      config={{
        branding: { title: 'Copilotz' }
      }}
    />
  );
}
```
