#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();
const policyPath = path.join(
  repoRoot,
  "opensource/open-studio-platform/configs/license/npm-license-policy.json",
);
const policy = JSON.parse(await readFile(policyPath, "utf8"));
const args = process.argv.slice(2);
const inputArg = args.find((arg) => arg.startsWith("--input="));
const startArg = args.find((arg) => arg.startsWith("--start="));
const includeDev = args.includes("--include-dev");
const startDir = path.resolve(
  repoRoot,
  startArg?.slice("--start=".length) ?? "opensource/open-studio-platform",
);

function normalizeExpression(value) {
  return String(value ?? "UNKNOWN")
    .replace(/[()]/g, " ")
    .replace(/\s+(AND|OR)\s+/gi, " ")
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function packageBaseName(name) {
  if (name.startsWith("@")) {
    const parts = name.split("@");
    return `@${parts[1]}`;
  }
  return name.split("@")[0];
}

function evaluateLicense(name, license) {
  const effectiveLicense =
    policy.packageLicenseOverrides?.[packageBaseName(name)] ?? license;
  const tokens = normalizeExpression(effectiveLicense);
  const denied = tokens.find((token) =>
    policy.deniedLicensePatterns.some((pattern) =>
      token.toLowerCase().includes(pattern.toLowerCase()),
    ),
  );
  if (denied) {
    return `${name} uses denied license ${effectiveLicense}`;
  }

  const hasAllowedOption = tokens.some(
    (token) =>
      policy.allowedLicenses.includes(token) ||
      Object.hasOwn(policy.conditionallyAllowedLicenses, token),
  );
  if (hasAllowedOption) {
    return null;
  }

  const unknown = tokens.find((token) => {
    if (policy.allowedLicenses.includes(token)) {
      return false;
    }
    if (Object.hasOwn(policy.conditionallyAllowedLicenses, token)) {
      return false;
    }
    return true;
  });

  if (unknown) {
    return `${name} uses unreviewed license ${effectiveLicense}`;
  }

  return null;
}

let packages;
if (inputArg) {
  packages = JSON.parse(
    await readFile(
      path.resolve(repoRoot, inputArg.slice("--input=".length)),
      "utf8",
    ),
  );
} else {
  const licenseCheckerCommand = [
    "--yes",
    "license-checker-rseidelsohn",
    "--json",
    "--production",
    "--excludePrivatePackages",
    "--start",
    startDir,
  ];
  if (includeDev) {
    licenseCheckerCommand.splice(licenseCheckerCommand.indexOf("--production"), 1);
  }
  packages = JSON.parse(
    execFileSync("npx", licenseCheckerCommand, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }),
  );
  if (Object.keys(packages).length === 0) {
    const pnpmArgs = ["licenses", "list", "--json"];
    if (!includeDev) {
      pnpmArgs.push("--prod");
    }
    const grouped = JSON.parse(
      execFileSync("pnpm", pnpmArgs, {
        cwd: startDir,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
      }),
    );
    packages = {};
    for (const [license, entries] of Object.entries(grouped)) {
      for (const entry of entries) {
        packages[`${entry.name}@${entry.versions.join(",")}`] = { license };
      }
    }
  }
}

const failures = [];
for (const [name, details] of Object.entries(packages)) {
  const failure = evaluateLicense(name, details.licenses ?? details.license);
  if (failure) {
    failures.push(failure);
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(
  `npm license check passed (${Object.keys(packages).length} packages)`,
);
