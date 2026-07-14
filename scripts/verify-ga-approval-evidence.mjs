#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  acceptedEvidencePaths,
  evidenceState,
  resolveEvidenceDir,
} from "./lib/evidence-files.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const platformRoot = path.resolve(scriptDir, "..");
const repoRoot = path.resolve(platformRoot, "../..");
const evidenceEnvName = "AURAONE_GA_APPROVAL_EVIDENCE_DIR";
const defaultEvidenceDir = path.join(repoRoot, "docs/evidence/product/open-studio-ga-approvals");
const defaultEvidenceLabel = "docs/evidence/product/open-studio-ga-approvals";
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

const checklistPaths = [
  "opensource/open-studio-platform/security/checklists/rubric-studio-open-ga.md",
  "opensource/open-studio-platform/security/checklists/robotics-studio-open-ga.md",
  "opensource/open-studio-platform/security/checklists/agent-studio-open-ga.md",
  "opensource/open-studio-platform/security/checklists/flagship-handoff-security-review.md",
  "opensource/open-studio-platform/security/checklists/platform-v0.1-security-review.md",
];

const requiredEvidence = [
  {
    key: "rubric-ga-checklist-signoff",
    name: "Rubric Studio Open GA security checklist sign-off",
    requiredFields: ["checklist version", "reviewer", "platform owner", "release manager", "timestamp"],
  },
  {
    key: "robotics-ga-checklist-signoff",
    name: "Robotics Studio Open GA security checklist sign-off",
    requiredFields: ["checklist version", "reviewer", "platform owner", "release manager", "timestamp"],
  },
  {
    key: "agent-ga-checklist-signoff",
    name: "Agent Studio Open GA security checklist sign-off",
    requiredFields: ["checklist version", "reviewer", "platform owner", "release manager", "timestamp"],
  },
  {
    key: "third-party-security-audit",
    name: "Third-party security audit report or signed exception",
    requiredFields: ["auditor", "scope", "report id or URL", "severity disposition", "signature timestamp"],
  },
  {
    key: "bug-bounty-launch",
    name: "Bug bounty launch evidence or signed exception",
    requiredFields: ["program host", "scope", "safe harbor", "reward tiers", "launch timestamp"],
  },
  {
    key: "legal-launch-approval",
    name: "Legal approval for launch claims, trademark, privacy, and terms",
    requiredFields: ["legal reviewer", "approved surfaces", "approval timestamp", "open exceptions", "artifact URL"],
  },
];

function fileState(relativePath) {
  const absolutePath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(absolutePath)) {
    return {
      path: relativePath,
      present: false,
      bytes: 0,
      uncheckedItems: null,
      blankSignoffFields: null,
    };
  }
  const text = fs.readFileSync(absolutePath, "utf8");
  const uncheckedItems = (text.match(/^\s*-\s+\[ \]/gm) ?? []).length;
  const blankSignoffFields = (text.match(/^(Security reviewer|Platform owner|Release manager):\s*$/gmi) ?? []).length;
  return {
    path: relativePath,
    present: true,
    bytes: Buffer.byteLength(text),
    uncheckedItems,
    blankSignoffFields,
  };
}

const checklists = checklistPaths.map(fileState);
const { evidenceDir, source: evidenceDirSource } = resolveEvidenceDir({
  envName: evidenceEnvName,
  envValue: process.env[evidenceEnvName] ?? "",
  defaultDir: defaultEvidenceDir,
});
const evidence = requiredEvidence.map((item) => {
  const state = evidenceState(evidenceDir, item.key);
  return {
    ...item,
    externalEvidencePresent: state.accepted,
    evidenceFiles: state.files,
    preferredEvidencePath: `${defaultEvidenceLabel}/${item.key}.md`,
    acceptedEvidencePaths: acceptedEvidencePaths(defaultEvidenceLabel, item.key),
    templatePath: `${defaultEvidenceLabel}/templates/${item.key}.md`,
    requiredCaptureFields: captureFields,
  };
});
const missingExternalEvidenceInstructions = evidence
  .filter((item) => !item.externalEvidencePresent)
  .map((item) => ({
    key: item.key,
    name: item.name,
    evidenceStatus: item.evidenceFiles.length > 0 ? "present-but-rejected" : "missing",
    preferredEvidencePath: item.preferredEvidencePath,
    acceptedEvidencePaths: item.acceptedEvidencePaths,
    templatePath: item.templatePath,
    requiredFields: item.requiredFields,
    requiredCaptureFields: item.requiredCaptureFields,
  }));

const blockers = [];
for (const checklist of checklists) {
  if (!checklist.present) {
    blockers.push(`${checklist.path}: checklist is missing`);
  } else if (checklist.bytes < 400) {
    blockers.push(`${checklist.path}: checklist is too short to support GA review`);
  }
}
for (const item of evidence) {
  if (item.evidenceFiles.length === 0) {
    blockers.push(`${item.key}: external GA/audit/legal evidence is missing`);
  } else if (!item.externalEvidencePresent) {
    blockers.push(`${item.key}: external GA/audit/legal evidence is present but not acceptable`);
  }
}

console.log(JSON.stringify({
  ok: true,
  readyForGaApprovalClosure: blockers.length === 0,
  checkedAt: new Date().toISOString(),
  safetyRule:
    "This verifier validates checklist files and externally captured approval evidence only; it does not approve releases, sign audit reports, contact counsel, or infer approval from draft checklists.",
  checklists,
  evidenceDirectory: {
    envName: evidenceEnvName,
    configured: Boolean(evidenceDir),
    source: evidenceDirSource,
    valuePrinted: false,
    acceptedLayout: `${defaultEvidenceLabel}/<evidence-key>.<md|json|txt|png|pdf>`,
    templateLayout: `${defaultEvidenceLabel}/templates/<evidence-key>.md`,
  },
  missingExternalEvidenceInstructions,
  evidence,
  blockers,
}, null, 2));
