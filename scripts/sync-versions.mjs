import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const args = process.argv.slice(2);
const checkOnly = args.includes("--check");
const requestedVersion = args.find((arg) => !arg.startsWith("--"));
const dependencySections = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
];

const rootPackagePath = path.join(root, "package.json");
const rootPackage = readJson(rootPackagePath);
const workspaces = rootPackage.workspaces ?? [];

if (!Array.isArray(workspaces) || workspaces.length === 0) {
  throw new Error("No npm workspaces are configured in package.json.");
}

if (workspaces.some((workspace) => workspace.includes("*"))) {
  throw new Error("Workspace globs are not supported by this version sync script.");
}

const currentVersion = rootPackage.version;
const targetVersion = requestedVersion
  ? resolveVersion(currentVersion, requestedVersion)
  : currentVersion;

if (!targetVersion) {
  throw new Error("Root package.json must define version, or a version must be provided.");
}

const packages = workspaces.map((workspace) => {
  const packagePath = path.join(root, workspace, "package.json");
  return {
    workspace,
    packagePath,
    packageJson: readJson(packagePath),
  };
});
const workspaceNames = new Set(packages.map(({ packageJson }) => packageJson.name));

if (checkOnly) {
  checkVersions(targetVersion, packages, workspaceNames);
} else {
  syncVersions(targetVersion, packages, workspaceNames);
}

function checkVersions(version, workspacePackages, workspacePackageNames) {
  const problems = [];

  if (rootPackage.version !== version) {
    problems.push(`package.json version is ${rootPackage.version ?? "missing"}, expected ${version}`);
  }

  for (const { workspace, packageJson } of workspacePackages) {
    if (packageJson.version !== version) {
      problems.push(`${workspace}/package.json version is ${packageJson.version}, expected ${version}`);
    }

    collectInternalDependencyProblems(
      problems,
      `${workspace}/package.json`,
      packageJson,
      workspacePackageNames,
      version,
    );
  }

  const lockPath = path.join(root, "package-lock.json");
  const lock = readJson(lockPath);

  if (lock.packages?.[""]?.version !== version) {
    problems.push(`package-lock.json root version is ${lock.packages?.[""]?.version ?? "missing"}, expected ${version}`);
  }

  for (const { workspace } of workspacePackages) {
    const lockPackage = lock.packages?.[workspace];

    if (!lockPackage) {
      problems.push(`package-lock.json is missing workspace entry ${workspace}`);
      continue;
    }

    if (lockPackage.version !== version) {
      problems.push(`package-lock.json ${workspace} version is ${lockPackage.version}, expected ${version}`);
    }

    collectInternalDependencyProblems(
      problems,
      `package-lock.json ${workspace}`,
      lockPackage,
      workspacePackageNames,
      version,
    );
  }

  if (problems.length > 0) {
    console.error("Package versions are not synchronized:");
    for (const problem of problems) {
      console.error(`- ${problem}`);
    }
    process.exit(1);
  }

  console.log(`All workspace package versions are synchronized at ${version}.`);
}

function syncVersions(version, workspacePackages, workspacePackageNames) {
  rootPackage.version = version;
  writeJson(rootPackagePath, rootPackage);

  for (const { packagePath, packageJson } of workspacePackages) {
    packageJson.version = version;
    syncInternalDependencyRanges(packageJson, workspacePackageNames, version);
    writeJson(packagePath, packageJson);
  }

  const lockPath = path.join(root, "package-lock.json");
  const lock = readJson(lockPath);
  lock.packages ??= {};
  lock.packages[""] ??= {};
  lock.packages[""].version = version;

  for (const { workspace } of workspacePackages) {
    if (!lock.packages[workspace]) {
      continue;
    }

    lock.packages[workspace].version = version;
    syncInternalDependencyRanges(lock.packages[workspace], workspacePackageNames, version);
  }

  writeJson(lockPath, lock);
  console.log(`Synchronized workspace package versions to ${version}.`);
}

function collectInternalDependencyProblems(problems, label, packageJson, workspacePackageNames, version) {
  for (const section of dependencySections) {
    const dependencies = packageJson[section];
    if (!dependencies) {
      continue;
    }

    for (const [name, range] of Object.entries(dependencies)) {
      if (workspacePackageNames.has(name) && range !== version) {
        problems.push(`${label} ${section}.${name} is ${range}, expected ${version}`);
      }
    }
  }
}

function syncInternalDependencyRanges(packageJson, workspacePackageNames, version) {
  for (const section of dependencySections) {
    const dependencies = packageJson[section];
    if (!dependencies) {
      continue;
    }

    for (const name of Object.keys(dependencies)) {
      if (workspacePackageNames.has(name)) {
        dependencies[name] = version;
      }
    }
  }
}

function resolveVersion(currentVersion, requested) {
  if (/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(requested)) {
    return requested;
  }

  if (!currentVersion) {
    throw new Error(`Cannot apply ${requested}; root package.json has no current version.`);
  }

  const match = currentVersion.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) {
    throw new Error(`Cannot apply ${requested}; current version ${currentVersion} is not simple semver.`);
  }

  const [, major, minor, patch] = match.map(Number);

  if (requested === "major") {
    return `${major + 1}.0.0`;
  }

  if (requested === "minor") {
    return `${major}.${minor + 1}.0`;
  }

  if (requested === "patch") {
    return `${major}.${minor}.${patch + 1}`;
  }

  throw new Error(`Unsupported version argument: ${requested}. Use major, minor, patch, or x.y.z.`);
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}
