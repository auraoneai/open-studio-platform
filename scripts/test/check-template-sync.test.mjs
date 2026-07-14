import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const root = new URL("../..", import.meta.url).pathname;
const script = join(root, "scripts/check-template-sync.sh");

function runCheck(manifest, env = {}) {
  return spawnSync("bash", [script, manifest], {
    cwd: root,
    encoding: "utf8",
    env: {
      ...process.env,
      OPEN_STUDIO_PLATFORM_VERSION: "0.3.0",
      OPEN_STUDIO_PLATFORM_SYNC_MAX_AGE_DAYS: "5",
      ...env,
    },
  });
}

function writeManifest(body) {
  const dir = mkdtempSync(join(tmpdir(), "auraone-sync-"));
  const path = join(dir, ".open-studio-platform-sync.json");
  writeFileSync(path, JSON.stringify(body, null, 2));
  return path;
}

test("template sync gate accepts current platform version and fresh sync", () => {
  const manifest = writeManifest({
    platform_version: "0.3.0",
    synced_at: new Date(Date.now() + 86_400_000).toISOString(),
  });

  const result = runCheck(manifest);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /platform template sync manifest is current/);
});

test("template sync gate blocks release on version mismatch", () => {
  const manifest = writeManifest({
    platform_version: "0.2.0",
    synced_at: new Date(Date.now() + 86_400_000).toISOString(),
  });

  const result = runCheck(manifest);

  assert.equal(result.status, 11);
  assert.match(result.stderr, /does not match required/);
});

test("template sync gate blocks release when sync is overdue", () => {
  const manifest = writeManifest({
    platform_version: "0.3.0",
    synced_at: "2020-01-01T00:00:00.000Z",
  });

  const result = runCheck(manifest);

  assert.equal(result.status, 12);
  assert.match(result.stderr, /platform template sync is .* days old/);
});
