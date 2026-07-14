import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

test("make-tauri-updater-manifest preserves Tauri artifact signatures", () => {
  const directory = mkdtempSync(join(tmpdir(), "tauri-updater-manifest-"));
  try {
    const artifact = join(directory, "Agent.Studio.Open.app.tar.gz");
    const manifestPath = join(directory, "latest.json");
    const signature = Buffer.from("minisign signature fixture").toString("base64");
    writeFileSync(artifact, "updater artifact");
    writeFileSync(`${artifact}.sig`, signature);

    const result = spawnSync(
      process.execPath,
      [
        "scripts/make-tauri-updater-manifest.mjs",
        "--version",
        "0.2.0",
        "--out",
        manifestPath,
        "--artifact",
        `darwin-aarch64:${artifact}:https://example.com/Agent.Studio.Open.app.tar.gz`,
      ],
      {
        cwd: new URL("../..", import.meta.url),
        encoding: "utf8",
      },
    );

    assert.equal(result.status, 0, result.stderr);
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    assert.equal(manifest.version, "0.2.0");
    assert.equal(
      manifest.platforms["darwin-aarch64"].signature,
      signature,
    );
    assert.equal(
      manifest.platforms["darwin-aarch64"].url,
      "https://example.com/Agent.Studio.Open.app.tar.gz",
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
