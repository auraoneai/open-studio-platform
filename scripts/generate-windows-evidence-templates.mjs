#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const platformRoot = path.resolve(scriptDir, "..");
const repoRoot = path.resolve(platformRoot, "../..");
const configPath = path.join(platformRoot, "distribution/windows/windows-package-identity-readiness.json");
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));

function argValue(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return "";
  return process.argv[index + 1] ?? "";
}

const force = process.argv.includes("--force");
const outputRootArg = argValue("--out-root");
const outputRoot = outputRootArg
  ? path.resolve(process.cwd(), outputRootArg)
  : path.join(repoRoot, "docs/evidence/product");
const windowsTemplateDir = path.join(outputRoot, "windows-package-identity/templates");
const wingetTemplateDir = path.join(outputRoot, "winget-submission/templates");
const signingCustodyTemplateDir = path.join(outputRoot, "windows-signing-custody/templates");
const signingCustodyRequirements = [
  {
    key: "custody-attestation",
    name: "Windows EV/PFX/HSM or managed signing custody attestation",
    requiredEvidence: [
      "Non-secret certificate or managed signing account evidence",
      "Custody model: EV token/HSM, PFX escrow, or Azure Artifact/Trusted Signing",
      "Named owner, backup owner, review timestamp, and expiry or rotation date",
    ],
  },
  {
    key: "release-environment-binding",
    name: "Protected release environment and secret binding",
    requiredEvidence: [
      "GitHub release environment protection screenshot or JSON export",
      "Required Windows signing secret names or managed provider secret names",
      "Reviewer policy or two-person approval record for signing sessions",
    ],
  },
  {
    key: "signing-provider-verification",
    name: "Signing provider verification and dry-run proof",
    requiredEvidence: [
      "Credential-safe wrapper invocation or provider configuration check",
      "signtool or managed signing provider version/output",
      "Evidence that no private key, PFX, PIN, token, or password is printed",
    ],
  },
];
const hostedSigningAlternatives = [
  "`AURAONE_WINDOWS_CERT_THUMBPRINT`",
  "`AURAONE_WINDOWS_PFX_PATH` + `AURAONE_WINDOWS_PFX_PASSWORD`",
  "`AURAONE_WINDOWS_SIGNING_PROVIDER` + `AURAONE_ARTIFACT_SIGNING_DLIB_PATH` + `AURAONE_ARTIFACT_SIGNING_ENDPOINT` + `AURAONE_ARTIFACT_SIGNING_ACCOUNT_NAME` + `AURAONE_ARTIFACT_SIGNING_CERTIFICATE_PROFILE_NAME`",
  "`AURAONE_WINDOWS_SIGNING_PROVIDER` + `AURAONE_ARTIFACT_SIGNING_DLIB_PATH` + `AURAONE_ARTIFACT_SIGNING_METADATA_PATH`",
];
const releaseRepositories = [
  "`gchahal1982/AuraFoundry`",
  "`auraoneai/rubric-studio-open`",
  "`auraoneai/robotics-studio-open`",
  "`auraoneai/agent-studio-open`",
];

function writeFileIfAllowed(filePath, content) {
  if (fs.existsSync(filePath) && !force) {
    return { filePath, written: false, reason: "exists" };
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
  return { filePath, written: true, reason: null };
}

function acceptedWindowsPath(product, key) {
  return `docs/evidence/product/windows-package-identity/${product.package_identifier}/${key}.md`;
}

function acceptedWingetPath(product, key) {
  return `docs/evidence/product/winget-submission/${product.package_identifier}/${key}.md`;
}

function acceptedSigningCustodyPath(key) {
  return `docs/evidence/product/windows-signing-custody/${key}.md`;
}

function requiredList(items) {
  return (items ?? []).map((item) => `- ${item}`).join("\n");
}

function expectedAssets(product) {
  return (product.expected_msi_assets ?? []).map((item) => `- ${item}`).join("\n");
}

function windowsTemplate(product, item, evidenceKind) {
  return `# ${product.name} Windows Evidence: ${item.name}

Template status: TODO - this is a capture form, not Windows release evidence.

Copy this file to:

\`${acceptedWindowsPath(product, item.key)}\`

Only after the external Windows identity, signing, winget, or clean-install
action is actually complete. The verifier rejects TODO/template text in
accepted evidence paths, so this file must be replaced with real Partner
Center, Authenticode, winget, GitHub Release, or clean Windows QA proof.

## Evidence Scope

- Product: \`${product.id}\`
- Package identifier: \`${product.package_identifier}\`
- Version: \`${product.version}\`
- Evidence key: \`${item.key}\`
- Evidence kind: \`${evidenceKind}\`
- Winget manifest: \`${product.winget_manifest}\`

## Required Evidence

${requiredList(item.required_evidence)}

## External Closure Order

1. Reserve or verify the Microsoft package identity for this exact package
   identifier in Partner Center.
2. Sign the exact public MSI artifact with the chosen Windows custody mode.
3. Run \`prepare-windows-msi-release.mjs --require-signed\` for the signed MSI
   to capture SHA-256, ProductCode, and Authenticode status.
4. Run \`prepare-winget-manifests.mjs --write --require-signed\` with that
   metadata, then run \`winget validate\` or \`wingetcreate validate\` on the
   updated manifest.
5. Install, launch, and uninstall the public MSI on a clean Windows machine.
6. Replace this template with credential-safe evidence in the accepted path.

## Expected Public MSI Assets

${expectedAssets(product)}

## Capture Fields

- Evidence type:
- External system or service:
- Public/private URL:
- Captured at:
- Owner:
- Reviewer:
- Account or publisher shown:
- Artifact/version:
- SHA-256:
- ProductCode:
- Verification command or screenshot filename:
- Notes:

## Verification Notes

- Do not include EV private keys, PFX/P12 files, HSM tokens, auth tokens,
  signing PINs, certificate passwords, or unreleased customer data.
- Prefer public GitHub Release URLs and command output when the evidence is for
  public MSI artifacts.
- For Partner Center evidence, include a redacted screenshot or export showing
  package identifier, publisher/account, timestamp, and owner.
- For clean Windows install QA, include the Windows version, architecture,
  installer URL, install command, launch smoke result, and uninstall result.
`;
}

function wingetTemplate(product, key) {
  const title = key === "ev-signature" ? "EV Signature Verification" : "winget Submission";
  return `# ${product.name} ${title} Evidence

Template status: TODO - this is a capture form, not winget submission evidence.

Copy this file to:

\`${acceptedWingetPath(product, key)}\`

Only after the public MSI and winget work is actually complete. The winget
verifier rejects TODO/template text in accepted evidence paths, so this file
must be replaced with real EV-signature verification or winget validation /
submission output.

## Evidence Scope

- Product: \`${product.id}\`
- Package identifier: \`${product.package_identifier}\`
- Version: \`${product.version}\`
- Evidence key: \`${key}\`
- Winget manifest: \`${product.winget_manifest}\`

## Expected Public MSI Assets

${expectedAssets(product)}

## Capture Fields

- Evidence type:
- External system or service:
- Public MSI URL:
- Captured at:
- Owner:
- Reviewer:
- Publisher shown:
- Certificate subject:
- Certificate thumbprint:
- SHA-256:
- ProductCode:
- winget command:
- winget validation or submission URL/output:
- Notes:

## Required Evidence

- EV Authenticode verification for the exact public MSI artifact.
- Manifest validation output for the exact package identifier and version.
- Submitted package or PR URL when submission is complete.
- Public installer URL, SHA-256, ProductCode, publisher, and architecture.

## Verification Notes

- Do not include EV private keys, PFX/P12 files, HSM tokens, signing PINs, auth
  tokens, or certificate passwords.
- Use redacted screenshots or command output for private Microsoft/winget
  systems.
- Attach evidence for each flagship separately unless a single global evidence
  file truly proves all three package identifiers and versions.
`;
}

function signingCustodyTemplate(item) {
  return `# Windows Signing Custody Evidence: ${item.name}

Template status: TODO - this is a capture form, not Windows signing custody evidence.

Copy this file to:

\`${acceptedSigningCustodyPath(item.key)}\`

Only after the external Windows EV/PFX/HSM or managed Azure Artifact/Trusted
Signing custody work is actually complete. The signing custody verifier rejects
TODO/template text in accepted evidence paths, so this file must be replaced
with credential-safe proof from the real signing system.

## Evidence Scope

- Evidence key: \`${item.key}\`
- Applies to: \`AuraOne.RubricStudioOpen\`, \`AuraOne.RoboticsStudioOpen\`, \`AuraOne.AgentStudioOpen\`
- Accepted custody modes: Windows EV token/HSM, PFX path with protected password, Azure Artifact Signing, Azure Trusted Signing

## Required Evidence

${requiredList(item.requiredEvidence)}

## Accepted Hosted Secret Sets

The release repositories must contain one of these Windows signing custody
secret sets before hosted Windows signing can close:

${hostedSigningAlternatives.map((item) => `- ${item}`).join("\n")}

Repositories that must be checked:

${releaseRepositories.map((item) => `- ${item}`).join("\n")}

## Capture Fields

- Evidence type:
- External system or service:
- Captured at:
- Owner:
- Backup owner:
- Reviewer:
- Custody mode:
- Certificate subject or managed signing account:
- Certificate thumbprint suffix or profile name:
- Expiration or rotation date:
- Protected GitHub environment:
- Required secret names:
- Verification command or screenshot filename:
- Notes:

## Verification Notes

- Do not include EV private keys, PFX/P12 files, HSM tokens, auth tokens,
  signing PINs, certificate passwords, tenant secrets, or customer data.
- For Azure Artifact/Trusted Signing, include only the endpoint/account/profile
  names or redacted screenshots. Do not include access tokens.
- For PFX custody, prove that the protected path/password secrets exist without
  printing either value.
- For EV token/HSM custody, include only certificate public metadata, owner,
  backup owner, HSM serial suffix if approved, and audit-log hashes.
`;
}

function windowsReadme(products) {
  const rows = [];
  for (const product of products) {
    for (const item of product.identity_evidence ?? []) {
      rows.push(
        `| \`${product.package_identifier}\` | \`${item.key}\` | \`${product.package_identifier}/${item.key}.md\` | \`${acceptedWindowsPath(product, item.key)}\` |`,
      );
    }
    for (const item of product.release_evidence ?? []) {
      rows.push(
        `| \`${product.package_identifier}\` | \`${item.key}\` | \`${product.package_identifier}/${item.key}.md\` | \`${acceptedWindowsPath(product, item.key)}\` |`,
      );
    }
  }
  return `# Windows Package Identity Evidence Templates

Generated from:

\`opensource/open-studio-platform/distribution/windows/windows-package-identity-readiness.json\`

These files are capture forms, not evidence. They live under a \`templates/\`
subtree so \`verify:windows-package-identity\` does not count them as completed
Windows identity or release work. Each template intentionally contains a TODO
marker; if copied unchanged into an accepted evidence path, the verifier
rejects it.

Generate or refresh these templates with:

\`\`\`bash
pnpm --dir opensource/open-studio-platform run windows-evidence:templates
\`\`\`

Accepted evidence paths are outside this template subtree:

\`\`\`text
docs/evidence/product/windows-package-identity/<package-identifier>/<evidence-key>.md
\`\`\`

| Package identifier | Evidence key | Template | Accepted evidence path |
|---|---|---|---|
${rows.join("\n")}
`;
}

function wingetReadme(products) {
  const rows = [];
  for (const product of products) {
    for (const key of ["ev-signature", "winget-submission"]) {
      rows.push(
        `| \`${product.package_identifier}\` | \`${key}\` | \`${product.package_identifier}/${key}.md\` | \`${acceptedWingetPath(product, key)}\` |`,
      );
    }
  }
  return `# winget Submission Evidence Templates

Generated from:

\`opensource/open-studio-platform/distribution/windows/windows-package-identity-readiness.json\`

These files are capture forms, not evidence. They live under a \`templates/\`
subtree so \`verify:winget-matrix -- --live\` does not count them as completed
EV-signing or winget submission work. Each template intentionally contains a
TODO marker; if copied unchanged into an accepted evidence path, the verifier
rejects it.

Generate or refresh these templates with:

\`\`\`bash
pnpm --dir opensource/open-studio-platform run windows-evidence:templates
\`\`\`

Accepted evidence paths are outside this template subtree:

\`\`\`text
docs/evidence/product/winget-submission/<package-identifier>/<ev-signature|winget-submission>.md
\`\`\`

| Package identifier | Evidence key | Template | Accepted evidence path |
|---|---|---|---|
${rows.join("\n")}
`;
}

function signingCustodyReadme(requirements) {
  const rows = requirements.map((item) =>
    `| \`${item.key}\` | \`${item.key}.md\` | \`${acceptedSigningCustodyPath(item.key)}\` |`,
  );
  return `# Windows Signing Custody Evidence Templates

Generated from:

\`opensource/open-studio-platform/scripts/generate-windows-evidence-templates.mjs\`

These files are capture forms, not evidence. They live under a \`templates/\`
subtree so \`verify:signing-custody\` does not count them as completed Windows
signing custody work. Each template intentionally contains a TODO marker; if
copied unchanged into an accepted evidence path, the verifier rejects it.

Generate or refresh these templates with:

\`\`\`bash
pnpm --dir opensource/open-studio-platform run windows-evidence:templates
\`\`\`

Accepted evidence paths are outside this template subtree:

\`\`\`text
docs/evidence/product/windows-signing-custody/<evidence-key>.md
docs/evidence/product/windows-signing-custody/windows/<evidence-key>.md
\`\`\`

| Evidence key | Template | Accepted evidence path |
|---|---|---|
${rows.join("\n")}
`;
}

const writes = [];
const products = config.products ?? [];
writes.push(writeFileIfAllowed(path.join(windowsTemplateDir, "README.md"), windowsReadme(products)));
writes.push(writeFileIfAllowed(path.join(wingetTemplateDir, "README.md"), wingetReadme(products)));
writes.push(
  writeFileIfAllowed(
    path.join(signingCustodyTemplateDir, "README.md"),
    signingCustodyReadme(signingCustodyRequirements),
  ),
);
for (const item of signingCustodyRequirements) {
  writes.push(
    writeFileIfAllowed(
      path.join(signingCustodyTemplateDir, `${item.key}.md`),
      signingCustodyTemplate(item),
    ),
  );
}

for (const product of products) {
  for (const item of product.identity_evidence ?? []) {
    writes.push(
      writeFileIfAllowed(
        path.join(windowsTemplateDir, product.package_identifier, `${item.key}.md`),
        windowsTemplate(product, item, "identity"),
      ),
    );
  }
  for (const item of product.release_evidence ?? []) {
    writes.push(
      writeFileIfAllowed(
        path.join(windowsTemplateDir, product.package_identifier, `${item.key}.md`),
        windowsTemplate(product, item, "release"),
      ),
    );
  }
  for (const key of ["ev-signature", "winget-submission"]) {
    writes.push(
      writeFileIfAllowed(
        path.join(wingetTemplateDir, product.package_identifier, `${key}.md`),
        wingetTemplate(product, key),
      ),
    );
  }
}

console.log(JSON.stringify({
  ok: true,
  checkedAt: new Date().toISOString(),
  outputRoot: path.relative(repoRoot, outputRoot) || ".",
  force,
  safetyRule:
    "Generated templates are capture forms under templates subtrees and intentionally include TODO text so they cannot be counted as completed Windows or winget evidence if copied unchanged.",
  totalFiles: writes.length,
  writtenFiles: writes.filter((item) => item.written).length,
  skippedExistingFiles: writes.filter((item) => !item.written).length,
  files: writes.map((item) => ({
    path: path.relative(repoRoot, item.filePath),
    written: item.written,
    reason: item.reason,
  })),
}, null, 2));
