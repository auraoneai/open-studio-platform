import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const root = new URL("..", import.meta.url).pathname;
const script = join(root, "scripts/sync-docs-version.mjs");

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), "auraone-docs-version-"));
  const docsRoot = join(dir, "docs-template");
  mkdirSync(join(docsRoot, "docs"), { recursive: true });
  writeFileSync(join(docsRoot, "docs/intro.md"), "# Intro\n\nPinned docs.\n");
  writeFileSync(join(docsRoot, "sidebars.js"), "module.exports = { docs: ['intro'] };\n");
  writeFileSync(join(docsRoot, "versions.json"), "[]\n");
  return docsRoot;
}

function run(args) {
  return spawnSync("node", [script, ...args], {
    cwd: root,
    encoding: "utf8",
  });
}

test("docs version sync writes Docusaurus versioned docs and version metadata", () => {
  const docsRoot = fixture();

  const result = run(["--root", docsRoot, "--version", "1.2.3"]);

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(readFileSync(join(docsRoot, "versions.json"), "utf8")), ["1.2.3"]);
  assert.match(readFileSync(join(docsRoot, "versioned_docs/version-1.2.3/intro.md"), "utf8"), /# Intro/);
  assert.deepEqual(JSON.parse(readFileSync(join(docsRoot, "versioned_sidebars/version-1.2.3-sidebars.json"), "utf8")), { docs: ["intro"] });
});

test("docs version sync check blocks missing release version", () => {
  const docsRoot = fixture();

  const result = run(["--root", docsRoot, "--version", "1.2.3", "--check"]);

  assert.equal(result.status, 1);
  assert.match(result.stderr, /missing 1\.2\.3/);
});

test("docs version sync check accepts the checked-in 0.1.0 scaffold", () => {
  const result = run(["--root", "docs-template", "--version", "0.1.0", "--check"]);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /versioned docs are in sync for 0\.1\.0/);
});
