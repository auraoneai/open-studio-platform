import { generateKeyPairSync } from "node:crypto";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import assert from "node:assert/strict";

test("make-updater-manifest writes signed platform entries", () => {
  const dir = mkdtempSync(join(tmpdir(), "auraone-manifest-"));
  const artifact = join(dir, "rubric.dmg");
  const out = join(dir, "latest.json");
  writeFileSync(artifact, "artifact-bytes");
  const { privateKey } = generateKeyPairSync("ed25519");
  const pem = privateKey.export({ type: "pkcs8", format: "pem" });

  const result = spawnSync(
    process.execPath,
    [
      "scripts/make-updater-manifest.mjs",
      "--flagship",
      "rubric-studio-open",
      "--version",
      "0.1.0",
      "--channel",
      "stable",
      "--out",
      out,
      "--artifact",
      `darwin-universal:${artifact}:https://updates.auraone.ai/rubric-studio-open/stable/0.1.0/rubric.dmg`
    ],
    {
      cwd: new URL("../..", import.meta.url),
      env: { ...process.env, AURAONE_UPDATE_SIGNING_KEY_PEM: pem },
      encoding: "utf8"
    }
  );

  assert.equal(result.status, 0, result.stderr);
  const manifest = JSON.parse(readFileSync(out, "utf8"));
  assert.equal(manifest.flagship, "rubric-studio-open");
  assert.equal(manifest.schema_version, "1.0.0");
  assert.equal(manifest.channel, "stable");
  assert.deepEqual(manifest.rollout, {
    percentage: 10,
    mandatory: false,
    min_version: "0.0.0",
    kill_switch: false
  });
  assert.equal(
    manifest.platforms["darwin-universal"].url,
    "https://updates.auraone.ai/rubric-studio-open/stable/0.1.0/rubric.dmg",
  );
  assert.match(manifest.platforms["darwin-universal"].signature, /^[A-Za-z0-9+/=]+$/);
  assert.equal(manifest.manifest_signature_algorithm, "ed25519");
  assert.match(manifest.manifest_signature, /^[A-Za-z0-9+/=]+$/);
  assert.equal(Object.keys(manifest.checksums).length, 1);
});
