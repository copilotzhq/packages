import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const rootPackage = readJson(path.join(root, "package.json"));
const workspaces = rootPackage.workspaces ?? [];
const dryRun = process.env.DRY_RUN === "1";

if (!Array.isArray(workspaces) || workspaces.length === 0) {
  throw new Error("No npm workspaces are configured in package.json.");
}

for (const workspace of workspaces) {
  if (workspace.includes("*")) {
    throw new Error(`Workspace globs are not supported by this publisher: ${workspace}`);
  }

  const packagePath = path.join(root, workspace, "package.json");
  if (!existsSync(packagePath)) {
    throw new Error(`Missing package.json for workspace ${workspace}`);
  }

  const packageJson = readJson(packagePath);
  const { name, version, private: isPrivate } = packageJson;

  if (isPrivate) {
    console.log(`Skipping private workspace ${workspace}`);
    continue;
  }

  if (!name || !version) {
    throw new Error(`Workspace ${workspace} must define name and version.`);
  }

  const args = [
    "publish",
    "--workspace",
    workspace,
    "--access",
    packageJson.publishConfig?.access ?? "public",
    "--provenance",
  ];

  if (dryRun) {
    console.log(`[dry-run] would check ${name}@${version} and run: npm ${args.join(" ")}`);
    continue;
  }

  if (await isPublished(name, version)) {
    console.log(`Skipping ${name}@${version}; it is already published.`);
    continue;
  }

  console.log(`Publishing ${name}@${version}`);
  execFileSync("npm", args, { cwd: root, stdio: "inherit" });
}

async function isPublished(name, version) {
  const result = spawnNpm(["view", `${name}@${version}`, "version", "--json"]);

  if (result.ok) {
    return true;
  }

  const output = `${result.stdout}\n${result.stderr}`;
  if (output.includes("E404")) {
    return false;
  }

  throw new Error(`Failed to check ${name}@${version} on npm:\n${output}`);
}

function spawnNpm(args) {
  try {
    const stdout = execFileSync("npm", args, {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });

    return { ok: true, stdout, stderr: "" };
  } catch (error) {
    return {
      ok: false,
      stdout: error.stdout?.toString() ?? "",
      stderr: error.stderr?.toString() ?? "",
    };
  }
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}
