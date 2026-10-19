# PR #21 validation — 2026-10-19

Base: `copilotzhq/packages` PR #21, `feat/stream-taxonomy`,
`64d93e7c0674e48775ec571e119ac29681944f06`.
Client: `DEL`, branch `owner/deletion`,
`786c6932967f66bff78b874d46a291eee6c2a9a6` (clean checkout).
Tools: Node 24.14.0; TypeScript 5.8.2; Deno 2.9.2 / TypeScript 6.0.3.

The sandbox refused `git fetch` with `.git/FETCH_HEAD: Operation not permitted`.
The working directory is an archive of the exact PR head, not a Git worktree.
The incremental patch applies to that head. No commits or pushes were made.

## Changes

The existing PR already derives logical failure from outcome. Its tests previously
bypassed mandatory decoder checks: stream errors lacked `type`, `streamId`, and
`code`, and completed/purged fixtures disagreed on frame and terminal offsets.
The shared terminal fixture now follows the current protocol, including independent
`reason` and `availabilityReason`, and uses `stream_unavailable` for every purged
outcome. The bootstrap failure fixture is also corrected.

Projection regressions cover all six outcome/availability combinations, preservation
of visible prefixes, independent attempts, and incomplete UTF-8/NDJSON prefixes
when a completed stream's remaining bytes are unavailable. The real DEL decoder
accepts the six current combinations and rejects legacy `capture`, invalid
availability, missing availability cause, and wrong offsets, codes or stream ids.
The public observation helper exports already present in the PR are preserved.

## Results

| Check | Result |
| --- | --- |
| Clean npm install from lockfile | Passed |
| UI ESM/CJS/declarations/CSS build | Passed |
| Adapter tests | 142 passed; no failures or skips |
| Adapter `typecheck` against pinned package | Passed |
| Adapter ESM/declaration build | Passed |
| Built observation helper exports | Both verified |
| Workspace version synchronization | Passed; unchanged 0.82.7 |
| Local DEL decoder + adapter checks | 12 passed; no failures or skips |
| Direct local DEL source type check | Blocked by one upstream error below |

Reproduce with the commands in the README. `check:local-client` checks the real
local client, Core client, content exports, and all transitive source dependencies;
it uses built UI declarations because the UI has its own build/type validation.
It preserves the DEL dependency-age policy, including its existing exceptions,
and sets `noImplicitOverride: false` to match the adapter's TypeScript policy.
It does not suppress source diagnostics or substitute converted declarations.

The only direct local-source diagnostic is:

```text
DEL/runtime/actions/capability-authorization.ts:304:49 TS2345
Argument of type 'unknown' is not assignable to parameter of type
'PromiseLike<undefined> | undefined'.
await observeCleanup(iterator.return!(value));
```

No adapter diagnostics remain in that check. The command intentionally exits 1
until the upstream error is resolved; its independent protocol tests still run.
DEL was left untouched.

## Release blocker

The adapter still pins `npm:@jsr/copilotz__copilotz@0.82.0`. That decoder requires
`capture`. The latest published JSR version checked on this date, **0.88.0**, also
requires `capture` and retains the old `superseded`/`abandoned` outcomes and
`purge_pending`/`missing` availability values:

- https://jsr.io/@copilotz/copilotz/0.88.0/runtime/streams/types.ts
- https://jsr.io/@copilotz/copilotz/0.88.0/client/protocol.ts

A release containing PR #94's current contract must be published and pinned,
with synchronized package metadata and lockfile updates, before this adapter can
be released for that server protocol. No speculative version was pinned.
