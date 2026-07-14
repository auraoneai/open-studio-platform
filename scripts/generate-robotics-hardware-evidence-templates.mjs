#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const platformRoot = path.resolve(scriptDir, "..");
const repoRoot = path.resolve(platformRoot, "../..");
const configPath = path.join(
  platformRoot,
  "distribution/robotics/robotics-hosted-hardware-readiness.json",
);
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

function argValue(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return "";
  return process.argv[index + 1] ?? "";
}

const outputArg = argValue("--out");
const force = process.argv.includes("--force");
const outputDir = outputArg
  ? path.resolve(process.cwd(), outputArg)
  : path.join(repoRoot, "docs/evidence/product/robotics-hosted-hardware/templates");

function evidencePath(key) {
  return `docs/evidence/product/robotics-hosted-hardware/${key}.md`;
}

function evidenceItems(item) {
  return (item.required_evidence ?? []).map((entry) => `- ${entry}`).join("\n");
}

function gpuRunnerLabels() {
  return config.workflows?.ci?.gpu_runner_labels?.join(", ") ?? "self-hosted, linux, x64, gpu";
}

function branchProtectionContexts() {
  return (config.branch_protection_required_contexts ?? [])
    .map((context) => `- ${context}`)
    .join("\n");
}

function templateFor(item) {
  return `# Robotics Hosted Hardware Evidence: ${item.name}

Template status: TODO - this is a capture form, not hardware evidence.

Copy this file to:

\`${evidencePath(item.key)}\`

Only after the hardware run, hosted CI run, or 14-day history capture is
actually complete. The Robotics hosted/hardware verifier rejects TODO/template
text in accepted evidence paths, so this file must be replaced with real
machine metadata, run URLs, command output, screenshots, or dashboard exports.

## Evidence Key

- Key: \`${item.key}\`
- Repository: \`${config.repository}\`
- PRD: \`${config.prd}\`
- Evidence env var: \`${config.evidence_dir_env}\`
- GPU enablement variable: \`${config.workflows?.ci?.gpu_enablement_variable ?? "ROBOTICS_GPU_CI_ENABLED"}\`
- Required GPU runner labels: \`${gpuRunnerLabels()}\`

## Required Evidence

${evidenceItems(item)}

## Capture Fields

- Captured at:
- Owner:
- Reviewer:
- Machine or runner name:
- Machine model:
- CPU:
- GPU:
- RAM:
- OS and version:
- Kernel or build:
- Commit SHA:
- App version:
- Engine version:
- Dataset or fixture:
- Command:
- Exit status:
- Public run or dashboard URL:
- Screenshot/export filename:
- Relevant metrics:
- Exceptions or retries:
- Notes:

## Runner and Branch Protection Context

- Confirm \`${config.workflows?.ci?.gpu_enablement_variable ?? "ROBOTICS_GPU_CI_ENABLED"}=true\`
  before capturing GPU CI or fourteen-day CI evidence.
- Confirm at least one online self-hosted runner has these labels:
  \`${gpuRunnerLabels()}\`.
- Confirm branch protection requires these contexts before starting the
  fourteen-day CI clock:

${branchProtectionContexts()}

## Verification Notes

- Do not include runner tokens, SSH keys, cloud credentials, Sentry DSNs,
  private hardware-access credentials, or unreleased customer data.
- For public CI evidence, prefer the GitHub run/job URL plus the exact check
  name.
- For target hardware evidence, include enough machine metadata and command
  output for another maintainer to reproduce the baseline.
- For screenshots or PDFs, attach the file at the accepted evidence path using
  the same key and a supported extension.
`;
}

function readmeFor(items) {
  const rows = items.map((item) =>
    `| \`${item.key}\` | \`${item.key}.md\` | \`${evidencePath(item.key)}\` |`,
  );
  return `# Robotics Hosted Hardware Evidence Templates

Generated from:

\`opensource/open-studio-platform/distribution/robotics/robotics-hosted-hardware-readiness.json\`

These files are capture forms, not evidence. They live under a \`templates/\`
subtree so \`verify:robotics-hosted-hardware\` does not count them as completed
hardware readiness evidence. Each template intentionally contains a TODO marker;
if copied unchanged into an accepted evidence path, the verifier rejects it.

Generate or refresh these templates with:

\`\`\`bash
pnpm --dir opensource/open-studio-platform run robotics-hardware:templates
\`\`\`

Accepted evidence paths are outside this template subtree:

\`\`\`text
docs/evidence/product/robotics-hosted-hardware/<evidence-key>.md
docs/evidence/product/robotics-hosted-hardware/<evidence-key>.json
docs/evidence/product/robotics-hosted-hardware/<evidence-key>.txt
docs/evidence/product/robotics-hosted-hardware/<evidence-key>.png
docs/evidence/product/robotics-hosted-hardware/<evidence-key>.pdf
\`\`\`

| Evidence key | Template | Accepted evidence path |
|---|---|---|
${rows.join("\n")}
`;
}

function writeFileIfAllowed(filePath, content) {
  if (fs.existsSync(filePath) && !force) {
    return { filePath, written: false, reason: "exists" };
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
  return { filePath, written: true, reason: null };
}

const items = config.required_external_evidence ?? [];
const writes = [
  writeFileIfAllowed(path.join(outputDir, "README.md"), readmeFor(items)),
  ...items.map((item) => writeFileIfAllowed(path.join(outputDir, `${item.key}.md`), templateFor(item))),
];

console.log(JSON.stringify({
  ok: true,
  checkedAt: new Date().toISOString(),
  outputDir: path.relative(repoRoot, outputDir) || ".",
  force,
  safetyRule:
    "Generated templates are capture forms under a templates subtree and intentionally include TODO text so they cannot be counted as completed Robotics hardware evidence if copied unchanged.",
  totalFiles: writes.length,
  writtenFiles: writes.filter((item) => item.written).length,
  skippedExistingFiles: writes.filter((item) => !item.written).length,
  files: writes.map((item) => ({
    path: path.relative(repoRoot, item.filePath),
    written: item.written,
    reason: item.reason,
  })),
}, null, 2));
