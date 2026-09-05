import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { setTimeout } from "node:timers/promises";

export function readWorkspaces(root) {
  const workspaces = readJson(path.join(root, "package.json")).workspaces ?? [];
  if (!Array.isArray(workspaces) || workspaces.length === 0) {
    throw new Error("No npm workspaces are configured in package.json.");
  }
  return workspaces.flatMap((workspace) => {
    if (workspace.includes("*")) {
      throw new Error(
        `Workspace globs are not supported by this publisher: ${workspace}`,
      );
    }

    const packagePath = path.join(root, workspace, "package.json");
    if (!existsSync(packagePath)) {
      throw new Error(`Missing package.json for workspace ${workspace}`);
    }

    const packageJson = readJson(packagePath);
    const { name, version, private: isPrivate } = packageJson;

    if (isPrivate) {
      console.log(`Skipping private workspace ${workspace}`);
      return [];
    }

    if (!name || !version) {
      throw new Error(`Workspace ${workspace} must define name and version.`);
    }

    return [{
      workspace,
      name,
      version,
      access: packageJson.publishConfig?.access ?? "public",
    }];
  });
}

export async function publishWorkspaces(packages, {
  lookup = registryPackage,
  publish = (args) => execFileSync("npm", args, { stdio: "inherit" }),
  dryRun = false,
} = {}) {
  // Check every package before publishing any: OIDC requires initial package setup.
  const states = [];
  for (const pkg of packages) {
    states.push(await lookup(pkg.name));
  }
  const missing = packages.filter((_, index) => states[index] === null);
  if (missing.length) {
    throw new Error(
      `Packages missing from npm: ${
        missing.map((pkg) => pkg.name).join(", ")
      }. ` +
        "Complete their first publication and configure copilotzhq/packages release.yml as trusted publisher before retrying. No packages were published.",
    );
  }
  for (
    const [index, { workspace, name, version, access }] of packages.entries()
  ) {
    if (states[index].versions?.[version]) {
      console.log(`Skipping ${name}@${version}; it is already published.`);
      continue;
    }
    const args = [
      "publish",
      "--workspace",
      workspace,
      "--access",
      access,
      "--provenance",
    ];

    if (dryRun) {
      console.log(
        `[dry-run] would check ${name}@${version} and run: npm ${
          args.join(" ")
        }`,
      );
      continue;
    }

    console.log(`Publishing ${name}@${version}`);
    await publish(args);
  }
}

export async function registryPackage(name, request = fetch) {
  const response = await request(
    `https://registry.npmjs.org/${encodeURIComponent(name)}`,
    {
      headers: {
        accept: "application/vnd.npm.install-v1+json",
        "cache-control": "no-cache",
      },
      signal: AbortSignal.timeout(15_000),
    },
  );
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`npm registry returned ${response.status} for ${name}`);
  }
  return response.json();
}

export async function waitForRegistry(packages, {
  lookup = registryPackage,
  sleep = setTimeout,
  now = Date.now,
  timeoutMs = 300_000,
} = {}) {
  const deadline = now() + timeoutMs;
  let pending = packages;
  do {
    const missing = [];
    for (const pkg of pending) {
      const metadata = await lookup(pkg.name);
      if (!metadata?.versions?.[pkg.version]?.dist?.tarball) missing.push(pkg);
    }
    pending = missing;
    if (!pending.length) return;
    const names = pending.map((pkg) => `${pkg.name}@${pkg.version}`).join(", ");
    if (now() >= deadline) {
      throw new Error(
        `Timed out waiting for npm registry visibility: ${names}`,
      );
    }
    console.log(`Waiting for npm registry visibility: ${names}`);
    await sleep(Math.min(10_000, deadline - now()));
  } while (true);
}

if (
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href
) {
  execFileSync("node", ["scripts/sync-versions.mjs", "--check"], {
    stdio: "inherit",
  });
  const packages = readWorkspaces(process.cwd());
  if (process.argv.includes("--wait")) {
    await waitForRegistry(packages);
  } else {
    await publishWorkspaces(packages, { dryRun: process.env.DRY_RUN === "1" });
  }
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}
