#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const root = new URL("..", import.meta.url);

const requiredFiles = [
  "scripts/sign-macos.sh",
  "scripts/build-signed-macos-flagships.sh",
  "scripts/notarize.sh",
  "scripts/sign-windows.ps1",
  "scripts/prepare-windows-msi-release.mjs",
  "scripts/prepare-winget-manifests.mjs",
  "scripts/verify-windows-msi-matrix.mjs",
  "scripts/sign-linux.sh",
  "scripts/generate-checksums.sh",
  "scripts/publish-release.sh",
  "scripts/verify-release-blocker-preflight.mjs",
  "scripts/make-updater-manifest.mjs",
  ".github-templates/workflows/release.yml",
  "services/update-server/src/index.mjs",
  "services/update-server/wrangler.toml",
  "services/intake-receiver/src/index.mjs",
  "services/intake-receiver/wrangler.toml",
  "services/telemetry-receiver/src/index.mjs",
  "services/telemetry-receiver/wrangler.toml",
  "services/install-server/src/index.mjs",
  "services/install-server/wrangler.toml",
  "installers/shared/install.sh",
  "installers/rubric-studio-open/install.sh",
  "installers/robotics-studio-open/install.sh",
  "installers/agent-studio-open/install.sh",
  "distribution/homebrew/Casks/rubric-studio-open.rb",
  "distribution/homebrew/Casks/robotics-studio-open.rb",
  "distribution/homebrew/Casks/agent-studio-open.rb",
  "distribution/winget/AuraOne.RubricStudioOpen/0.1.0/AuraOne.RubricStudioOpen.installer.yaml",
  "distribution/winget/AuraOne.RoboticsStudioOpen/0.1.0/AuraOne.RoboticsStudioOpen.installer.yaml",
  "distribution/winget/AuraOne.AgentStudioOpen/0.1.0/AuraOne.AgentStudioOpen.installer.yaml",
  "security/runbooks/hsm-signing-operations.md",
  "security/runbooks/signing-key-incident-response.md",
  "BLOCKERS.md"
];

const requiredText = new Map([
  ["scripts/sign-macos.sh", ["AURAONE_MACOS_SIGNING_IDENTITY", "codesign --verify"]],
  ["scripts/build-signed-macos-flagships.sh", ["APPLE_SIGNING_IDENTITY", "build_one rubric", "build_one robotics", "build_one agent"]],
  ["scripts/notarize.sh", ["notarytool submit", "stapler validate"]],
  ["scripts/sign-windows.ps1", ["AURAONE_WINDOWS_CERT_THUMBPRINT", "AURAONE_WINDOWS_SIGNING_PROVIDER", "AURAONE_ARTIFACT_SIGNING_DLIB_PATH", "verify /pa"]],
  ["scripts/prepare-windows-msi-release.mjs", ["windows-installer-com", "Get-AuthenticodeSignature", "wingetManifest"]],
  ["scripts/prepare-winget-manifests.mjs", ["InstallerSha256", "ProductCode", "--metadata", "--require-signed"]],
  ["scripts/sign-linux.sh", ["--detach-sign", "GPG fingerprint"]],
  ["scripts/generate-checksums.sh", ["SHA256SUMS", "SHA256SUMS.asc"]],
  ["scripts/publish-release.sh", ["gh release upload", "CLOUDFLARE_ACCOUNT_ID", "wrangler r2 object put"]],
  ["scripts/verify-release-blocker-preflight.mjs", ["readyForCredentialedRelease", "Windows winget submission verifier is not closed for all flagships", "Sentry observability verifier did not prove project/DSN provisioning"]],
  ["services/update-server/src/index.mjs", ["rolloutAllowsInstall", "kill-switch", "manifest_signature"]],
  ["services/intake-receiver/src/index.mjs", ["parseZipCentralDirectory", "validateManifest", "cloud_url"]],
  ["services/telemetry-receiver/src/index.mjs", ["validateTelemetryEvent", "TELEMETRY_BUCKET", "batch_too_large"]],
  ["services/install-server/src/index.mjs", ["renderShellInstallScript", "gpg --batch --verify", "Get-AuthenticodeSignature"]],
  ["installers/shared/install.sh", ["uname -s", "uname -m", "Verified SHA256SUMS signature fingerprint"]],
  ["security/runbooks/hsm-signing-operations.md", ["Signing Request Queue", "Requests expire after 15 minutes", "Two-Person Controls"]],
  ["security/runbooks/signing-key-incident-response.md", ["Revocation And Rotation", "Sealed-envelope backup", "Rehearsal"]],
  ["BLOCKERS.md", ["Date: 2026-05-19", "Cloudflare closure evidence", "Apple Developer and GitHub release closure evidence", "Windows signing", "Homebrew tap", "winget"]]
]);

const errors = [];

for (const file of requiredFiles) {
  if (!existsSync(new URL(file, root))) errors.push(`missing ${file}`);
}

for (const [file, snippets] of requiredText.entries()) {
  const path = new URL(file, root);
  const text = existsSync(path) ? readFileSync(path, "utf8") : "";
  for (const snippet of snippets) {
    if (!text.includes(snippet)) errors.push(`${file} missing "${snippet}"`);
  }
}

if (errors.length > 0) {
  for (const error of errors) console.error(error);
  process.exit(1);
}

const checks = [
  ["bash", ["-n", "scripts/sign-macos.sh", "scripts/build-signed-macos-flagships.sh", "scripts/notarize.sh", "scripts/sign-linux.sh", "scripts/generate-checksums.sh", "scripts/publish-release.sh", "installers/shared/install.sh", "installers/rubric-studio-open/install.sh", "installers/robotics-studio-open/install.sh", "installers/agent-studio-open/install.sh"]],
  ["node", ["--check", "scripts/make-updater-manifest.mjs"]],
  ["node", ["--check", "scripts/prepare-windows-msi-release.mjs"]],
  ["node", ["--check", "scripts/prepare-winget-manifests.mjs"]],
  ["node", ["--check", "scripts/verify-windows-msi-matrix.mjs"]],
  ["node", ["--check", "services/update-server/src/index.mjs"]],
  ["node", ["--check", "services/intake-receiver/src/index.mjs"]],
  ["node", ["--check", "services/telemetry-receiver/src/index.mjs"]],
  ["node", ["--check", "services/install-server/src/index.mjs"]],
  ["node --test services/update-server/test/*.test.mjs services/intake-receiver/test/*.test.mjs services/telemetry-receiver/test/*.test.mjs services/install-server/test/*.test.mjs scripts/test/*.test.mjs", [], true],
  ["ruby", ["-c", "distribution/homebrew/Casks/rubric-studio-open.rb"]],
  ["ruby", ["-c", "distribution/homebrew/Casks/robotics-studio-open.rb"]],
  ["ruby", ["-c", "distribution/homebrew/Casks/agent-studio-open.rb"]]
];

for (const [command, args, shell] of checks) {
  const result = spawnSync(command, args, { cwd: root, stdio: "inherit", shell: Boolean(shell) });
  if (result.status !== 0) process.exit(result.status || 1);
}

console.log("Agent 4 release/signing/install/update/intake verification passed");
