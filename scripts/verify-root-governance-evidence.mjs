#!/usr/bin/env node
import { spawnSync } from "node:child_process";
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
const repository = process.env.AURAONE_ROOT_REPOSITORY ?? "gchahal1982/AuraFoundry";
const evidenceEnvName = "AURAONE_ROOT_GOVERNANCE_EVIDENCE_DIR";
const defaultEvidenceDir = path.join(repoRoot, "docs/evidence/product/open-studio-root-governance");
const defaultEvidenceLabel = "docs/evidence/product/open-studio-root-governance";
const requiredDcoCheck = "DCO / dco";
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

const requiredEvidence = [
  {
    key: "root-branch-protection",
    name: "Root main branch protection",
    requiredFields: [
      "repository",
      "protected branch",
      "required DCO check",
      "two approving reviews",
      "CODEOWNERS review",
      "capture timestamp",
    ],
  },
  {
    key: "platform-owner-team-map",
    name: "Root platform-owner/team mapping",
    requiredFields: [
      "GitHub team slug",
      "team maintainer or owner",
      "CODEOWNERS pattern",
      "member count or redacted roster",
      "capture timestamp",
    ],
  },
  {
    key: "root-dco-enforcement",
    name: "Root DCO workflow or app enforcement",
    requiredFields: [
      "workflow or app name",
      "required status check",
      "sample protected PR or settings export",
      "capture timestamp",
    ],
  },
];

function commandAvailable(command) {
  return spawnSync("which", [command], { stdio: "ignore" }).status === 0;
}

function ghJson(args) {
  if (!commandAvailable("gh")) {
    return { available: false, data: null, error: "gh command is not installed" };
  }
  const result = spawnSync("gh", args, {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 8,
  });
  if (result.status !== 0) {
    return {
      available: false,
      data: null,
      error: (result.stderr || result.stdout).trim() || `gh exited ${result.status}`,
    };
  }
  try {
    return { available: true, data: JSON.parse(result.stdout), error: null };
  } catch (error) {
    return { available: false, data: null, error: `could not parse gh JSON output: ${error.message}` };
  }
}

function readIfExists(relativePath) {
  const absolutePath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(absolutePath)) return "";
  return fs.readFileSync(absolutePath, "utf8");
}

function branchProtectionState() {
  const result = ghJson(["api", `repos/${repository}/branches/main/protection`]);
  if (!result.available) {
    return {
      accessible: false,
      error: result.error,
      contexts: [],
      strict: false,
      requiredApprovingReviewCount: 0,
      requireCodeOwnerReviews: false,
      enforceAdmins: false,
      requiredDcoCheckPresent: false,
      ready: false,
    };
  }
  const contexts = result.data.required_status_checks?.contexts ?? [];
  const reviewRule = result.data.required_pull_request_reviews ?? {};
  const requiredApprovingReviewCount = Number(reviewRule.required_approving_review_count ?? 0) || 0;
  const requireCodeOwnerReviews = Boolean(reviewRule.require_code_owner_reviews);
  const strict = Boolean(result.data.required_status_checks?.strict);
  const requiredDcoCheckPresent = contexts.includes(requiredDcoCheck);
  return {
    accessible: true,
    error: null,
    contexts,
    strict,
    requiredApprovingReviewCount,
    requireCodeOwnerReviews,
    enforceAdmins: Boolean(result.data.enforce_admins?.enabled),
    requiredDcoCheckPresent,
    ready: requiredDcoCheckPresent && strict && requiredApprovingReviewCount >= 2 && requireCodeOwnerReviews,
  };
}

const rootCodeowners = readIfExists(".github/CODEOWNERS");
const rootDcoWorkflow = readIfExists(".github/workflows/dco.yml");
const platformCodeowners = readIfExists("opensource/open-studio-platform/CODEOWNERS");
const branchProtection = branchProtectionState();
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

const localChecks = {
  rootCodeownersPresent: Boolean(rootCodeowners),
  rootOpenStudioPlatformOwned: /\/opensource\/open-studio-platform\/\s+@auraoneai\/platform/.test(rootCodeowners),
  rootDcoWorkflowPresent: Boolean(rootDcoWorkflow),
  rootDcoWorkflowUsesCheckAction: /christophebedard\/dco-check@0\.5\.0/.test(rootDcoWorkflow),
  platformCodeownersPresent: Boolean(platformCodeowners),
  platformOwnerRulePresent: /@auraone\/platform-owner/.test(platformCodeowners),
};

const blockers = [];
for (const [key, value] of Object.entries(localChecks)) {
  if (!value) blockers.push(`local root governance check failed: ${key}`);
}
if (!branchProtection.accessible) {
  blockers.push(`${repository}: branch protection could not be verified through GitHub API: ${branchProtection.error}`);
} else if (!branchProtection.ready) {
  if (!branchProtection.requiredDcoCheckPresent) blockers.push(`${repository}: branch protection does not require ${requiredDcoCheck}`);
  if (!branchProtection.strict) blockers.push(`${repository}: branch protection does not require strict status checks`);
  if (branchProtection.requiredApprovingReviewCount < 2) blockers.push(`${repository}: branch protection requires fewer than two approvals`);
  if (!branchProtection.requireCodeOwnerReviews) blockers.push(`${repository}: branch protection does not require CODEOWNERS review`);
}
for (const item of evidence) {
  if (item.evidenceFiles.length === 0) {
    blockers.push(`${item.key}: external root governance evidence is missing`);
  } else if (!item.externalEvidencePresent) {
    blockers.push(`${item.key}: external root governance evidence is present but not acceptable`);
  }
}

console.log(JSON.stringify({
  ok: true,
  readyForRootGovernanceClosure: blockers.length === 0,
  checkedAt: new Date().toISOString(),
  safetyRule:
    "This verifier reads local governance files, GitHub branch-protection metadata, and local evidence files only; it does not mutate repository settings, teams, reviews, or branch protection.",
  repository,
  localChecks,
  branchProtection,
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
