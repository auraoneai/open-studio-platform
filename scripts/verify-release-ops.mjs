#!/usr/bin/env node
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const root = new URL("../../..", import.meta.url).pathname;

const requiredFiles = [
  ".github/CODEOWNERS",
  ".github/workflows/dco.yml",
  ".github/workflows/rubric-studio-open-release.yml",
  "opensource/open-studio-platform/CODEOWNERS",
  "opensource/open-studio-platform/SECURITY.md",
  "opensource/open-studio-platform/CONTRIBUTING.md",
  "opensource/open-studio-platform/distribution/homebrew/Casks/rubric-studio-open.rb",
  "opensource/open-studio-platform/distribution/winget/AuraOne.RubricStudioOpen/0.1.0/AuraOne.RubricStudioOpen.yaml",
  "opensource/open-studio-platform/distribution/winget/AuraOne.RubricStudioOpen/0.1.0/AuraOne.RubricStudioOpen.installer.yaml",
  "opensource/open-studio-platform/distribution/winget/AuraOne.RubricStudioOpen/0.1.0/AuraOne.RubricStudioOpen.locale.en-US.yaml",
  "opensource/open-studio-platform/distribution/dns/cloudflare-rubric-studio-open.tf",
  "opensource/open-studio-platform/installers/rubric-studio-open/install.sh",
  "opensource/open-studio-platform/installers/shared/verify-install-paths.sh",
  "opensource/open-studio-platform/registries/pypi/rubric-studio/pyproject.toml",
  "opensource/open-studio-platform/registries/npm/rubric-studio/package.json",
  "opensource/open-studio-platform/registries/vscode/rubric-studio/package.json",
  "opensource/open-studio-platform/configs/github/rubric-studio-open-settings.yml",
  "opensource/open-studio-platform/security/checklists/rubric-studio-open-ga.md",
  "opensource/open-studio-platform/security/threat-models/rubric-studio-open.md",
  "opensource/open-studio-platform/compliance/licensing/lgpl-dynamic-linking-register.md",
  "opensource/open-studio-platform/compliance/licensing/NOTICE.template.md",
  "opensource/open-studio-platform/compliance/privacy/rubric-studio-open-privacy.md",
  "opensource/open-studio-platform/community/github-discussions-seeds.md",
  "opensource/open-studio-platform/support/oss-support-runbook.md",
  "docs/evidence/product/rubric-studio-open-release-ops-2026-05-13.md"
];

const requiredText = [
  ["opensource/open-studio-platform/distribution/homebrew/Casks/rubric-studio-open.rb", 'cask "rubric-studio-open"'],
  ["opensource/open-studio-platform/distribution/winget/AuraOne.RubricStudioOpen/0.1.0/AuraOne.RubricStudioOpen.installer.yaml", "PackageIdentifier: AuraOne.RubricStudioOpen"],
  ["opensource/open-studio-platform/registries/pypi/rubric-studio/pyproject.toml", 'name = "rubric-studio"'],
  ["opensource/open-studio-platform/registries/npm/rubric-studio/package.json", '"name": "@auraone/rubric-studio"'],
  ["opensource/open-studio-platform/registries/vscode/rubric-studio/package.json", '"publisher": "auraone"'],
  [".github/workflows/rubric-studio-open-release.yml", "CycloneDX"],
  [".github/workflows/rubric-studio-open-release.yml", "gitleaks"],
  ["opensource/open-studio-platform/security/checklists/rubric-studio-open-ga.md", "Independent security reviewer"],
  ["docs/evidence/product/rubric-studio-open-release-ops-2026-05-13.md", "External blockers"]
];

const errors = [];

for (const file of requiredFiles) {
  const path = join(root, file);
  if (!existsSync(path)) errors.push(`missing ${file}`);
  else if (statSync(path).size === 0) errors.push(`empty ${file}`);
}

for (const [file, needle] of requiredText) {
  const path = join(root, file);
  if (!existsSync(path)) continue;
  if (!readFileSync(path, "utf8").includes(needle)) {
    errors.push(`${file} does not include ${needle}`);
  }
}

for (const file of [
  "opensource/open-studio-platform/registries/npm/rubric-studio/package.json",
  "opensource/open-studio-platform/registries/vscode/rubric-studio/package.json"
]) {
  JSON.parse(readFileSync(join(root, file), "utf8"));
}

if (errors.length > 0) {
  for (const error of errors) console.error(error);
  process.exit(1);
}

console.log("Rubric Studio Open release/security/registry evidence verified");
