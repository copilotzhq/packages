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

## Publishing

All workspace packages ship in lockstep from the root `package.json` version.
Update every package version together before merging a package change:

```bash
npm run version:sync -- patch
```

You can also use npm's standard version command or set an explicit version:

```bash
npm version patch --no-git-tag-version
npm run version:sync -- 0.9.1
```

Both commands rewrite every workspace package version and every internal package dependency, including `@copilotz/chat-adapter`'s peer dependency on `@copilotz/chat-ui`.

GitHub Actions checks that every workspace package and internal package dependency uses the same version, then builds every workspace and publishes each package version that does not already exist on npm.

The publisher checks all public workspaces before publishing any version. A package
that has never been published fails this preflight: complete its first publication,
then configure its npm trusted publisher for `copilotzhq/packages`, workflow
`release.yml`, with permission for `npm publish`. See
[npm trusted publishing](https://docs.npmjs.com/trusted-publishers/). Already
published versions are skipped, so rerunning an interrupted release is safe.

After publishing, CI waits up to five minutes for every workspace version to appear
in npm's install metadata. It then refreshes Deno's metadata for Chat UI and Chat
Adapter before testing the actual released packages. A registry timeout identifies
the missing versions; contract failures remain failures and are not retried or
hidden. Run the release orchestration tests with
`node --test scripts/publish-workspaces.test.mjs`.
