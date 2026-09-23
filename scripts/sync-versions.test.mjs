import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const scriptsDirectory = path.dirname(fileURLToPath(import.meta.url));
const syncScript = path.join(scriptsDirectory, "sync-versions.mjs");

const fixture = async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "copilotz-version-sync-"));
  await mkdir(path.join(directory, "copilotz-chat-ui"), { recursive: true });
  await mkdir(path.join(directory, "copilotz-chat-adapter"), { recursive: true });
  await mkdir(path.join(directory, "contracts"), { recursive: true });

  await writeJson(path.join(directory, "package.json"), {
    name: "copilotz-packages-fixture",
    version: "0.78.0",
    private: true,
    workspaces: ["copilotz-chat-ui", "copilotz-chat-adapter"],
  });
  await writeJson(path.join(directory, "copilotz-chat-ui/package.json"), {
    name: "@copilotz/chat-ui",
    version: "0.78.0",
    exports: {
      ".": "./dist/index.js",
      "./model": "./dist/model.js",
    },
  });
  await writeJson(path.join(directory, "copilotz-chat-adapter/package.json"), {
    name: "@copilotz/chat-adapter",
    version: "0.78.0",
    dependencies: {
      "@copilotz/chat-ui": "0.78.0",
    },
  });
  await writeJson(path.join(directory, "package-lock.json"), {
    name: "copilotz-packages-fixture",
    version: "0.78.0",
    lockfileVersion: 3,
    packages: {
      "": {
        name: "copilotz-packages-fixture",
        version: "0.78.0",
      },
      "copilotz-chat-ui": {
        name: "@copilotz/chat-ui",
        version: "0.78.0",
      },
      "copilotz-chat-adapter": {
        name: "@copilotz/chat-adapter",
        version: "0.78.0",
        dependencies: {
          "@copilotz/chat-ui": "0.78.0",
        },
      },
    },
  });

  const contractConfig = {
    imports: {
      "@copilotz/copilotz": "jsr:@copilotz/copilotz@0.76.4",
      "@copilotz/copilotz/core": "jsr:@copilotz/copilotz@0.76.4/core",
      "@copilotz/chat-ui": "npm:@copilotz/chat-ui@0.76.4",
      "@copilotz/chat-ui/model": "npm:@copilotz/chat-ui@0.76.4/model",
      "@copilotz/chat-adapter/controller": "npm:@copilotz/chat-adapter@0.76.4/controller",
      unrelated: "npm:unrelated@9.1.0",
    },
    compilerOptions: { lib: ["dom"] },
    lock: false,
    minimumDependencyAge: {
      age: "P1D",
      exclude: ["npm:@copilotz/chat-ui"],
    },
  };
  await writeJson(path.join(directory, "contracts/deno.json"), contractConfig);

  return { directory, contractConfig };
};

const writeJson = (filePath, value) => writeFile(
  filePath,
  `${JSON.stringify(value, null, 2)}\n`,
);

const runSync = (directory, ...args) => spawnSync(
  process.execPath,
  [syncScript, ...args],
  { cwd: directory, encoding: "utf8" },
);

test("version check reports stale contract imports", async () => {
  const { directory } = await fixture();
  try {
    const result = runSync(directory, "--check");

    assert.equal(result.status, 1);
    assert.match(result.stderr, /contracts\/deno\.json/);
    assert.match(result.stderr, /@copilotz\/chat-ui\/model/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("version sync updates contract packages and keeps subpaths/configuration", async () => {
  const { directory, contractConfig } = await fixture();
  try {
    execFileSync(process.execPath, [syncScript, "0.79.0"], {
      cwd: directory,
      stdio: "pipe",
    });

    const synced = JSON.parse(await readFile(path.join(directory, "contracts/deno.json"), "utf8"));
    assert.deepEqual(synced.imports, {
      "@copilotz/copilotz": "jsr:@copilotz/copilotz@0.79.0",
      "@copilotz/copilotz/core": "jsr:@copilotz/copilotz@0.79.0/core",
      "@copilotz/chat-ui": "npm:@copilotz/chat-ui@0.79.0",
      "@copilotz/chat-ui/model": "npm:@copilotz/chat-ui@0.79.0/model",
      "@copilotz/chat-adapter/controller": "npm:@copilotz/chat-adapter@0.79.0/controller",
      unrelated: "npm:unrelated@9.1.0",
    });
    assert.deepEqual(synced.compilerOptions, contractConfig.compilerOptions);
    assert.equal(synced.lock, contractConfig.lock);
    assert.deepEqual(synced.minimumDependencyAge, contractConfig.minimumDependencyAge);

    const result = runSync(directory, "--check");
    assert.equal(result.status, 0, result.stderr);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("frontend release keeps an explicitly pinned Copilotz Core version", async () => {
  const { directory } = await fixture();
  try {
    const rootPath = path.join(directory, "package.json");
    const root = JSON.parse(await readFile(rootPath, "utf8"));
    root.copilotzCoreVersion = "0.78.0";
    await writeJson(rootPath, root);
    const uiPath = path.join(directory, "copilotz-chat-ui/package.json");
    const ui = JSON.parse(await readFile(uiPath, "utf8"));
    ui.dependencies = { "@copilotz/copilotz": "npm:@jsr/copilotz__copilotz@0.78.0" };
    await writeJson(uiPath, ui);
    const lockPath = path.join(directory, "package-lock.json");
    const lock = JSON.parse(await readFile(lockPath, "utf8"));
    lock.packages["copilotz-chat-ui"].dependencies = { ...ui.dependencies };
    await writeJson(lockPath, lock);

    execFileSync(process.execPath, [syncScript, "0.79.0"], { cwd: directory, stdio: "pipe" });
    const syncedUi = JSON.parse(await readFile(uiPath, "utf8"));
    const syncedContract = JSON.parse(await readFile(path.join(directory, "contracts/deno.json"), "utf8"));
    assert.equal(syncedUi.version, "0.79.0");
    assert.equal(syncedUi.dependencies["@copilotz/copilotz"], "npm:@jsr/copilotz__copilotz@0.78.0");
    assert.equal(syncedContract.imports["@copilotz/copilotz/core"], "jsr:@copilotz/copilotz@0.78.0/core");
    assert.equal(syncedContract.imports["@copilotz/chat-ui"], "npm:@copilotz/chat-ui@0.79.0");
    const check = runSync(directory, "--check");
    assert.equal(check.status, 0, check.stderr);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("invalid owned contract imports fail before package or lockfile mutation", async () => {
  const { directory } = await fixture();
  try {
    const contractPath = path.join(directory, "contracts/deno.json");
    const contract = JSON.parse(await readFile(contractPath, "utf8"));
    contract.imports["@copilotz/chat-ui/model"] = null;
    await writeJson(contractPath, contract);

    const packagePath = path.join(directory, "package.json");
    const lockPath = path.join(directory, "package-lock.json");
    const before = await Promise.all([
      readFile(packagePath, "utf8"),
      readFile(lockPath, "utf8"),
      readFile(contractPath, "utf8"),
    ]);

    const check = runSync(directory, "--check");
    assert.equal(check.status, 1);
    assert.match(check.stderr, /@copilotz\/chat-ui\/model/);

    const sync = runSync(directory, "0.79.0");
    assert.equal(sync.status, 1);
    assert.match(sync.stderr, /must reference npm:@copilotz\/chat-ui/);

    const after = await Promise.all([
      readFile(packagePath, "utf8"),
      readFile(lockPath, "utf8"),
      readFile(contractPath, "utf8"),
    ]);
    assert.deepEqual(after, before);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
