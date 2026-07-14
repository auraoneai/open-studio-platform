#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const platformRoot = path.resolve(scriptDir, "..");
const repoRoot = path.resolve(platformRoot, "../..");
const configPath = path.join(platformRoot, "distribution/launch/open-studio-launch-ops.json");
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
  : path.join(repoRoot, "docs/evidence/product/open-studio-launch-ops/templates");
const captureFields = [
  "Evidence type",
  "External system or service",
  "Public/private URL",
  "Captured at",
  "Owner",
  "Reviewer",
  "Account used",
  "Artifact/version",
  "Verification command or screenshot filename",
  "Notes",
];

function evidencePath(productId, actionKey) {
  return `docs/evidence/product/open-studio-launch-ops/${productId}/${actionKey}.md`;
}

function sourcePath(relativePath) {
  return path.join(repoRoot, relativePath);
}

function sourcePreview(relativePath) {
  const absolutePath = sourcePath(relativePath);
  if (!fs.existsSync(absolutePath)) return "Source draft is missing in this checkout.";
  const stat = fs.statSync(absolutePath);
  if (stat.isDirectory()) return "Source draft is a directory; attach the relevant rendered/captured artifact.";
  const text = fs.readFileSync(absolutePath, "utf8");
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !line.startsWith("#"))
    .slice(0, 4);
  return lines.length > 0 ? lines.join("\n") : "Source draft has no previewable body text.";
}

function templateFor(product, action) {
  const evidenceItems = (action.required_evidence ?? [])
    .map((item) => `- ${item}`)
    .join("\n");
  const evidenceChecklist = (action.required_evidence ?? [])
    .map((item) => `- [ ] ${item}:`)
    .join("\n");
  const fieldRows = captureFields
    .map((field) => `- ${field}:`)
    .join("\n");
  const prdRows = (action.prd_rows ?? []).join(", ");
  const preview = sourcePreview(action.source_draft)
    .split(/\r?\n/)
    .map((line) => `> ${line}`)
    .join("\n");

  return `# ${product.name} Launch Evidence: ${action.name}

Template status: TODO - this is a capture form, not launch evidence.

Copy this file to:

\`${evidencePath(product.id, action.key)}\`

Only after the external action is actually complete. The launch verifier rejects
TODO/template text in accepted evidence paths, so this file must be replaced
with real timestamps, URLs, exports, screenshots, approvals, or send records.

## Action

- Product: \`${product.id}\`
- Action key: \`${action.key}\`
- PRD row(s): ${prdRows || "none listed"}
- Required status: \`${action.result_status}\`
- Public blocker issue: ${action.public_issue?.url ?? "none configured"}
- Source draft: \`${action.source_draft}\`
- Template path: \`docs/evidence/product/open-studio-launch-ops/templates/${product.id}/${action.key}.md\`
- Preferred fill-in artifact path: \`${evidencePath(product.id, action.key)}\`

## Required Evidence

${evidenceItems}

## Required Evidence Checklist

Replace every blank below with real external proof before moving this capture
to the accepted evidence path.

${evidenceChecklist}

## Capture Fields

${fieldRows}

## Source Draft Preview

${preview}

## Verification Notes

- Do not include auth tokens, raw email credentials, private keys, PFX files,
  Sentry DSNs, HSM tokens, or unreleased customer data.
- Prefer a public URL when the action is public.
- For private systems, attach a redacted screenshot/PDF or export that includes
  the action, timestamp, owner, and target system.
- For sent email/CRM evidence, include the recipient list or export ID plus a
  hash of the final message body rather than private mailbox contents.
`;
}

function readmeFor(products) {
  const rows = [];
  for (const product of products) {
    for (const action of product.external_actions ?? []) {
      rows.push(
        `| \`${product.id}\` | \`${action.key}\` | \`${product.id}/${action.key}.md\` | \`${evidencePath(product.id, action.key)}\` |`,
      );
    }
  }
  return `# Open Studio Launch Evidence Templates

Generated from:

\`opensource/open-studio-platform/distribution/launch/open-studio-launch-ops.json\`

These files are capture forms, not evidence. They live under a \`templates/\`
subtree so \`verify:launch-ops\` does not count them as completed launch
actions. Each template intentionally contains a TODO marker; if it is copied
unchanged into an accepted evidence path, the verifier rejects it.

Generate or refresh these templates with:

\`\`\`bash
pnpm --dir opensource/open-studio-platform run launch-ops:templates
\`\`\`

Accepted evidence paths are outside this template subtree:

\`\`\`text
docs/evidence/product/open-studio-launch-ops/<product-id>/<action-key>.md
\`\`\`

Each template includes the preferred fill-in artifact path, the source draft,
the public blocker issue, every required evidence item from the launch-ops
manifest, and the standard capture fields that the verifier reports through
\`missingExternalEvidenceInstructions\`.

| Product | Action key | Template | Accepted evidence path |
|---|---|---|---|
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

const writes = [];
writes.push(writeFileIfAllowed(path.join(outputDir, "README.md"), readmeFor(config.products ?? [])));

for (const product of config.products ?? []) {
  for (const action of product.external_actions ?? []) {
    writes.push(
      writeFileIfAllowed(
        path.join(outputDir, product.id, `${action.key}.md`),
        templateFor(product, action),
      ),
    );
  }
}

console.log(JSON.stringify({
  ok: true,
  checkedAt: new Date().toISOString(),
  outputDir: path.relative(repoRoot, outputDir) || ".",
  force,
  safetyRule:
    "Generated templates are capture forms under a templates subtree and intentionally include TODO text so they cannot be counted as completed launch evidence if copied unchanged.",
  totalFiles: writes.length,
  writtenFiles: writes.filter((item) => item.written).length,
  skippedExistingFiles: writes.filter((item) => !item.written).length,
  files: writes.map((item) => ({
    path: path.relative(repoRoot, item.filePath),
    written: item.written,
    reason: item.reason,
  })),
}, null, 2));
