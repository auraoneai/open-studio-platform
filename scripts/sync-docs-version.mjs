#!/usr/bin/env node
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";

function usage() {
  console.error(`Usage: sync-docs-version.mjs --root docs-template --version X.Y.Z [--check]

Creates or verifies Docusaurus versioned docs for a release tag.`);
  process.exit(2);
}

const args = process.argv.slice(2);
const opts = {
  root: "docs-template",
  check: false,
};

for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  if (arg === "--root") opts.root = args[++i];
  else if (arg === "--version") opts.version = args[++i];
  else if (arg === "--check") opts.check = true;
  else usage();
}

if (!opts.version || !/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(opts.version)) usage();

const root = opts.root;
const docsDir = join(root, "docs");
const sidebarsPath = join(root, "sidebars.js");
const versionsPath = join(root, "versions.json");
const versionedDocsDir = join(root, "versioned_docs", `version-${opts.version}`);
const versionedSidebarsPath = join(root, "versioned_sidebars", `version-${opts.version}-sidebars.json`);

function fail(message) {
  console.error(message);
  process.exit(1);
}

function readVersions() {
  if (!existsSync(versionsPath)) return [];
  const parsed = JSON.parse(readFileSync(versionsPath, "utf8"));
  if (!Array.isArray(parsed) || parsed.some((entry) => typeof entry !== "string")) {
    fail(`${versionsPath} must be a JSON string array`);
  }
  return parsed;
}

function assertPinnedCrossReferences() {
  if (!existsSync(versionedDocsDir)) fail(`missing ${versionedDocsDir}`);
  const disallowed = [
    "/docs/latest/",
    "/docs/next/",
    "/docs/current/",
  ];
  const stack = [versionedDocsDir];
  while (stack.length > 0) {
    const current = stack.pop();
    for (const entry of readdirSync(current)) {
      const path = join(current, entry);
      if (statSync(path).isDirectory()) stack.push(path);
      else if (/\.(md|mdx)$/.test(path)) {
        const text = readFileSync(path, "utf8");
        for (const needle of disallowed) {
          if (text.includes(needle)) fail(`${path} contains unpinned docs reference ${needle}`);
        }
      }
    }
  }
}

function verify() {
  const versions = readVersions();
  if (!versions.includes(opts.version)) fail(`${versionsPath} missing ${opts.version}`);
  if (!existsSync(versionedDocsDir)) fail(`missing ${versionedDocsDir}`);
  if (!existsSync(versionedSidebarsPath)) fail(`missing ${versionedSidebarsPath}`);
  assertPinnedCrossReferences();
}

if (opts.check) {
  verify();
  console.log(`versioned docs are in sync for ${opts.version}`);
  process.exit(0);
}

if (!existsSync(docsDir)) fail(`missing ${docsDir}`);
if (!existsSync(sidebarsPath)) fail(`missing ${sidebarsPath}`);

mkdirSync(join(root, "versioned_docs"), { recursive: true });
mkdirSync(join(root, "versioned_sidebars"), { recursive: true });
rmSync(versionedDocsDir, { recursive: true, force: true });
cpSync(docsDir, versionedDocsDir, { recursive: true });

const require = createRequire(import.meta.url);
delete require.cache[require.resolve(resolve(sidebarsPath))];
const sidebars = require(resolve(sidebarsPath));
writeFileSync(versionedSidebarsPath, JSON.stringify(sidebars, null, 2) + "\n");

const versions = readVersions();
const nextVersions = [opts.version, ...versions.filter((entry) => entry !== opts.version)];
writeFileSync(versionsPath, JSON.stringify(nextVersions, null, 2) + "\n");
verify();
console.log(`synced versioned docs for ${opts.version}`);
