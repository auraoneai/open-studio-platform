#!/usr/bin/env node
import { access, readFile } from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();
const requiredFiles = [
  "opensource/open-studio-platform/configs/cargo-deny/deny.toml",
  "opensource/open-studio-platform/configs/cargo-audit/audit.toml",
  "opensource/open-studio-platform/configs/gitleaks/gitleaks.toml",
  "opensource/open-studio-platform/configs/license/npm-license-policy.json",
  "opensource/open-studio-platform/configs/sbom/cyclonedx.json",
  "opensource/open-studio-platform/configs/osv/osv-scanner.toml",
  "opensource/open-studio-platform/configs/semgrep/security.yml",
  "opensource/open-studio-platform/.github-templates/workflows/security.yml",
  "opensource/open-studio-platform/compliance/telemetry-forbidden-fields.json",
  "opensource/open-studio-platform/compliance/intake-privacy-exclusions.json",
];

const failures = [];

for (const file of requiredFiles) {
  try {
    await access(path.join(repoRoot, file));
  } catch {
    failures.push(`missing required security artifact: ${file}`);
  }
}

const denyPath = path.join(
  repoRoot,
  "opensource/open-studio-platform/configs/cargo-deny/deny.toml",
);
const deny = await readFile(denyPath, "utf8");
for (const expected of ['copyleft = "deny"', 'default = "deny"', '"GPL"']) {
  if (expected === '"GPL"') {
    continue;
  }
  if (!deny.includes(expected)) {
    failures.push(`cargo-deny policy must include ${expected}`);
  }
}

const licensePolicy = JSON.parse(
  await readFile(
    path.join(
      repoRoot,
      "opensource/open-studio-platform/configs/license/npm-license-policy.json",
    ),
    "utf8",
  ),
);
for (const denied of ["GPL", "AGPL", "SSPL"]) {
  if (!licensePolicy.deniedLicensePatterns.includes(denied)) {
    failures.push(`npm license policy must deny ${denied}`);
  }
}

if (!licensePolicy.allowedLicenses.includes("MIT")) {
  failures.push("npm license policy must allow MIT");
}

const telemetryPolicy = JSON.parse(
  await readFile(
    path.join(
      repoRoot,
      "opensource/open-studio-platform/compliance/telemetry-forbidden-fields.json",
    ),
    "utf8",
  ),
);
for (const field of ["content", "prompt", "path", "secret", "token", "email"]) {
  if (!telemetryPolicy.forbiddenFieldNames.includes(field)) {
    failures.push(`telemetry forbidden-field policy must include ${field}`);
  }
}

const intakePolicy = JSON.parse(
  await readFile(
    path.join(
      repoRoot,
      "opensource/open-studio-platform/compliance/intake-privacy-exclusions.json",
    ),
    "utf8",
  ),
);
for (const rule of [
  "no_os_identity_autofill",
  "no_git_identity_autofill",
  "no_secret_payloads",
]) {
  if (!intakePolicy.requiredRules.includes(rule)) {
    failures.push(`intake privacy policy must include ${rule}`);
  }
}

if (failures.length > 0) {
  console.error(failures.map((failure) => `- ${failure}`).join("\n"));
  process.exit(1);
}

console.log(`security config check passed (${requiredFiles.length} artifacts)`);
