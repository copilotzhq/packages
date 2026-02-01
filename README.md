# Copilotz Packages

Public packages for the Copilotz chat system:

- `@copilotz/chat-ui`: Headless + styled chat UI components.
- `@copilotz/chat-adapter`: Copilotz API adapter and ready-to-use `CopilotzChat` wrapper.

Each package builds independently and ships TypeScript types.

## Local dev (watch mode)

To rebuild on save while a client is linked:

```
npm run dev
```

That runs both package watchers in parallel. If you prefer separate terminals:

```
cd copilotz-chat-ui
npm run dev
```

```
cd ../copilotz-chat-adapter
npm run dev
```
