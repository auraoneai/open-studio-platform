import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = new URL("../..", import.meta.url);

function readRunbook(path) {
  return readFileSync(new URL(path, root), "utf8");
}

function commandAvailable(command) {
  return spawnSync(process.platform === "win32" ? "where" : "which", [command], {
    stdio: "ignore",
  }).status === 0;
}

function pwshUsable() {
  if (!commandAvailable("pwsh")) return false;
  return spawnSync("pwsh", ["-NoProfile", "-Command", "$PSVersionTable.PSVersion.ToString()"], {
    encoding: "utf8",
  }).status === 0;
}

test("HSM signing operations runbook covers queue, verification, ownership, and timeout controls", () => {
  const text = readRunbook("security/runbooks/hsm-signing-operations.md");

  for (const snippet of [
    "Signing Request Queue",
    "artifact name, expected SHA-256 hash",
    "Requests expire after 15 minutes",
    "Platform owner",
    "backup owner",
    "Compare the computed hash with the CI-logged hash and the queue request hash",
    "scripts/sign-macos.sh",
    "scripts/sign-windows.ps1",
    "scripts/sign-linux.sh",
    "scripts/make-updater-manifest.mjs",
    "Two-Person Controls",
    "Storage And Backup",
    "Windows Custody Evidence Gate",
    "AURAONE_WINDOWS_SIGNING_CUSTODY_EVIDENCE_DIR",
    "docs/evidence/product/windows-signing-custody",
    "Failure Handling",
  ]) {
    assert.match(text, new RegExp(snippet.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("Windows signing script keeps dry-run secret redaction wired", () => {
  const text = readRunbook("scripts/sign-windows.ps1");
  assert.match(text, /function Redact-SigningArgs/);
  assert.match(text, /<redacted-password>/);
  assert.match(text, /<redacted-pfx-path>/);
  assert.match(text, /<redacted-metadata-path>/);
  assert.match(text, /\$safeArgs = Redact-SigningArgs \$args/);
  assert.doesNotMatch(text, /DRY RUN: signtool \$\(\$args -join ' '\)/);
});

test("Windows signing dry run redacts PFX password and protected paths", { skip: !pwshUsable() }, () => {
  const tempDir = mkdtempSync(path.join(tmpdir(), "auraone-windows-signing-"));
  try {
    const artifactPath = path.join(tempDir, "sample.msi");
    const pfxPath = path.join(tempDir, "release-secret.pfx");
    const pfxPassword = "do-not-print-this-password";
    writeFileSync(artifactPath, "not a real MSI; dry-run only");
    writeFileSync(pfxPath, "not a real PFX; dry-run only");

    const result = spawnSync(
      "pwsh",
      [
        "-NoProfile",
        "-File",
        new URL("scripts/sign-windows.ps1", root).pathname,
        artifactPath,
      ],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          AURAONE_DRY_RUN: "1",
          AURAONE_WINDOWS_PFX_PATH: pfxPath,
          AURAONE_WINDOWS_PFX_PASSWORD: pfxPassword,
        },
      },
    );

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /DRY RUN: signtool/);
    assert.match(result.stdout, /<redacted-password>/);
    assert.match(result.stdout, /<redacted-pfx-path>/);
    assert.doesNotMatch(result.stdout, new RegExp(pfxPassword));
    assert.doesNotMatch(result.stdout, new RegExp(pfxPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("signing key incident runbook covers revocation, user protection, recovery, and rehearsal", () => {
  const text = readRunbook("security/runbooks/signing-key-incident-response.md");

  for (const snippet of [
    "SEV-1",
    "Immediate Containment",
    "Freeze all release workflows",
    "set the update Worker kill switch",
    "Revocation And Rotation",
    "Apple Developer ID",
    "Windows EV",
    "Linux GPG",
    "Tauri updater",
    "Sealed-envelope backup",
    "User Protection",
    "Recovery",
    "Rehearsal",
    "15-minute queue timeout",
    "Closure Criteria",
  ]) {
    assert.match(text, new RegExp(snippet.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});
