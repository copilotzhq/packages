# Copilotz Packages

Public packages for the Copilotz chat system:

- `@copilotz/chat-ui`: Headless + styled chat UI components.
- `@copilotz/chat-adapter`: Copilotz API adapter and ready-to-use `CopilotzChat` wrapper.
- `@copilotz/chat-voice-moonshine`: Optional Moonshine-based voice provider.
- `@copilotz/chat-voice-vad`: Optional VAD-only voice provider.

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

## Releases

Create a changeset for any package change that should ship:

```bash
npm run changeset
```

After the change lands on `main`, GitHub Actions will open or update a release PR. Merging that PR will publish the changed packages to npm.


