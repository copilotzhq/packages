# HTTP release contract

`http-fixture.ts` composes a minimal application through public Copilotz
exports: a Gateway and Worker sharing an OminiPG database, Core, one
deterministic model, and the same Server facade consumed by Compass. It uses no
raw application or executor access. The fixture is test infrastructure and is
not published.

`http-round-trip.test.ts` runs the real browser client and React-independent
controller against that Fetch handler. It covers creation, follow-up, reload,
attachments, editing and stable reconciliation across reload.

After publishing the coordinated dependencies:

```sh
deno test --config contracts/deno.json --allow-all contracts
```

For prepublication validation, pass an explicit external Deno import map
pointing to the clean Copilotz checkout and the built UI declarations. Keep
those local maps outside package manifests and dependency locks. Build and check
the browser packages with TypeScript as well.

`parallel-conversation.test.ts` sends to parallel Agents, executes an Agent
consultation and two-stage Tool pipelines with reused provider IDs, and checks
independent answers and stable projected identities after reload.
