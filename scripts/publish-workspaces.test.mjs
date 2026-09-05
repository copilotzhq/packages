import assert from "node:assert/strict";
import test from "node:test";
import {
  publishWorkspaces,
  registryPackage,
  waitForRegistry,
} from "./publish-workspaces.mjs";

const packages = ["ui", "adapter", "voice"].map((name) => ({
  name: `@copilotz/${name}`,
  workspace: name,
  version: "0.66.0",
  access: "public",
}));
const available = {
  versions: {
    "0.66.0": { dist: { tarball: "https://registry.npmjs.org/artifact.tgz" } },
  },
};

test("missing package prevents every publication, including earlier workspaces", async () => {
  const published = [];
  await assert.rejects(
    publishWorkspaces(packages, {
      lookup: async (name) => name.endsWith("voice") ? null : { versions: {} },
      publish: async (args) => published.push(args),
    }),
    /Packages missing from npm: @copilotz\/voice.*No packages were published/,
  );
  assert.deepEqual(published, []);
});

test("rerun publishes only missing versions, retaining provenance and access", async () => {
  const published = [];
  await publishWorkspaces(packages, {
    lookup: async (name) =>
      name.endsWith("adapter") ? { versions: {} } : available,
    publish: async (args) => published.push(args),
  });
  assert.deepEqual(published, [[
    "publish",
    "--workspace",
    "adapter",
    "--access",
    "public",
    "--provenance",
  ]]);
});

test("publish failure stops the release and preserves its error", async () => {
  let attempts = 0;
  const failure = new Error("OIDC rejected");
  await assert.rejects(
    publishWorkspaces(packages, {
      lookup: async () => ({ versions: {} }),
      publish: async () => {
        attempts++;
        throw failure;
      },
    }),
    (error) => error === failure,
  );
  assert.equal(attempts, 1);
});

test("dry run never publishes", async () => {
  await publishWorkspaces(packages, {
    lookup: async () => ({ versions: {} }),
    publish: async () => assert.fail("dry run published"),
    dryRun: true,
  });
});

test("registry check distinguishes package absence from registry errors", async () => {
  assert.equal(
    await registryPackage(
      "@copilotz/voice",
      async () => new Response(null, { status: 404 }),
    ),
    null,
  );
  await assert.rejects(
    registryPackage(
      "@copilotz/voice",
      async () => new Response(null, { status: 403 }),
    ),
    /403/,
  );
  await assert.rejects(
    registryPackage(
      "@copilotz/voice",
      async () => new Response(null, { status: 500 }),
    ),
    /500/,
  );
  assert.deepEqual(
    await registryPackage("@copilotz/ui", async (url, options) => {
      assert.equal(url, "https://registry.npmjs.org/%40copilotz%2Fui");
      assert.equal(options.headers["cache-control"], "no-cache");
      return Response.json(available);
    }),
    available,
  );
});

test("readiness waits through stale metadata and only revisits unresolved packages", async () => {
  let elapsed = 0;
  const lookups = [];
  await waitForRegistry(packages, {
    lookup: async (name) => {
      lookups.push(name);
      if (!name.endsWith("adapter") || elapsed >= 20_000) return available;
      return elapsed === 0 ? null : { versions: { "0.66.0": {} } };
    },
    now: () => elapsed,
    sleep: async (ms) => {
      elapsed += ms;
    },
  });
  assert.equal(elapsed, 20_000);
  assert.deepEqual(lookups, [
    ...packages.map((pkg) => pkg.name),
    "@copilotz/adapter",
    "@copilotz/adapter",
  ]);
});

test("readiness has a deadline and identifies the unavailable version", async () => {
  let elapsed = 0;
  await assert.rejects(
    waitForRegistry([packages[1]], {
      lookup: async () => ({ versions: {} }),
      now: () => elapsed,
      sleep: async (ms) => {
        elapsed += ms;
      },
      timeoutMs: 15_000,
    }),
    /Timed out.*@copilotz\/adapter@0.66.0/,
  );
  assert.equal(elapsed, 15_000);
});
