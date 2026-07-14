#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const platformRoot = path.resolve(scriptDir, "..");
const root = path.resolve(platformRoot, "../..");
const configPath = path.join(platformRoot, "distribution/launch/open-studio-launch-ops.json");
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
const defaultEvidenceDir = path.join(root, "docs/evidence/product/open-studio-launch-ops");
const evidenceExtensions = [".md", ".json", ".txt", ".png", ".pdf"];
const textEvidenceExtensions = new Set([".md", ".json", ".txt"]);
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
const placeholderPattern =
  /\b(TODO|TBD|FIXME|placeholder|pending|not yet|draft only|to be added|example only)\b/i;

const errors = [];

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function fileOrDirectoryState(relativePath) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) {
    return { path: relativePath, present: false, kind: null, nonEmpty: false };
  }
  const stat = fs.statSync(absolutePath);
  const nonEmpty = stat.isDirectory()
    ? fs.readdirSync(absolutePath).length > 0
    : stat.size > 0;
  return {
    path: relativePath,
    present: true,
    kind: stat.isDirectory() ? "directory" : "file",
    nonEmpty,
  };
}

function validateEvidenceFile(filePath, extension) {
  const stat = fs.statSync(filePath);
  const reasons = [];
  if (stat.size === 0) {
    reasons.push("file is empty");
  }
  if (textEvidenceExtensions.has(extension)) {
    const text = fs.readFileSync(filePath, "utf8");
    if (text.trim().length < 120) {
      reasons.push("text evidence is too short to prove an external action");
    }
    if (placeholderPattern.test(text)) {
      reasons.push("text evidence contains placeholder or pending language");
    }
    if (extension === ".json") {
      try {
        const parsed = JSON.parse(text);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          reasons.push("JSON evidence must be an object");
        } else if (Object.keys(parsed).length < 3) {
          reasons.push("JSON evidence object must contain at least three fields");
        }
      } catch {
        reasons.push("JSON evidence is not valid JSON");
      }
    }
  } else if (stat.size < 512) {
    reasons.push("binary evidence is too small to be a credible screenshot or PDF");
  }
  return {
    bytes: stat.size,
    accepted: reasons.length === 0,
    rejectionReasons: reasons,
  };
}

function evidenceFileState(evidenceDir, productId, key) {
  if (!evidenceDir) return { present: false, accepted: false, files: [] };
  const base = path.resolve(evidenceDir, productId, key);
  const files = [];
  for (const extension of evidenceExtensions) {
    const filePath = `${base}${extension}`;
    if (!fs.existsSync(filePath)) continue;
    files.push({
      extension,
      ...validateEvidenceFile(filePath, extension),
    });
  }
  return {
    present: files.length > 0,
    accepted: files.some((file) => file.accepted),
    files,
  };
}

function acceptedEvidencePaths(productId, key) {
  return evidenceExtensions.map(
    (extension) => `docs/evidence/product/open-studio-launch-ops/${productId}/${key}${extension}`,
  );
}

function preferredEvidencePath(productId, key) {
  return `docs/evidence/product/open-studio-launch-ops/${productId}/${key}.md`;
}

function templateEvidencePath(productId, key) {
  return `docs/evidence/product/open-studio-launch-ops/templates/${productId}/${key}.md`;
}

function publicIssueState(productId, action) {
  const issue = action.public_issue;
  const reasons = [];
  if (!issue || typeof issue !== "object" || Array.isArray(issue)) {
    reasons.push("public_issue is missing");
  } else {
    if (!issue.repository || typeof issue.repository !== "string" || !/^[^/\s]+\/[^/\s]+$/.test(issue.repository)) {
      reasons.push("public_issue.repository must be an owner/repo string");
    }
    if (!Number.isInteger(issue.number) || issue.number <= 0) {
      reasons.push("public_issue.number must be a positive integer");
    }
    const expectedUrl =
      issue.repository && Number.isInteger(issue.number)
        ? `https://github.com/${issue.repository}/issues/${issue.number}`
        : "";
    if (!issue.url || issue.url !== expectedUrl) {
      reasons.push(`public_issue.url must be ${expectedUrl || "the matching GitHub issue URL"}`);
    }
  }
  return {
    repository: issue?.repository ?? null,
    number: issue?.number ?? null,
    url: issue?.url ?? null,
    valid: reasons.length === 0,
    validationErrors: reasons.map((reason) => `${productId}/${action.key}: ${reason}`),
  };
}

if (config.schema !== "https://schemas.auraone.ai/open-studio/launch-ops-readiness/v1.json") {
  errors.push("schema must be the Open Studio launch-ops readiness v1 URL");
}
if (!config.status?.startsWith("local-launch-packets-prepared")) {
  errors.push("status must describe local packet readiness with external execution pending");
}
if (!config.completion_rule?.includes("Do not mark launch operations complete")) {
  errors.push("completion_rule must forbid completion without external evidence");
}

const evidenceDirValue = process.env[config.evidence_dir_env] ?? "";
const evidenceDir = evidenceDirValue
  ? path.resolve(path.isAbsolute(evidenceDirValue) ? evidenceDirValue : path.join(root, evidenceDirValue))
  : fs.existsSync(defaultEvidenceDir)
    ? defaultEvidenceDir
    : "";
const evidenceDirSource = evidenceDirValue ? "env" : evidenceDir ? "default" : "missing";
const productStates = [];
const blockers = [];
const missingExternalEvidenceInstructions = [];
const summary = {
  productCount: 0,
  productsWithLocalPacketsReady: 0,
  externalActionCount: 0,
  externalActionsWithPublicIssue: 0,
  externalActionsWithAcceptedEvidence: 0,
  externalActionsWithRejectedEvidence: 0,
  externalActionsMissingEvidence: 0,
  missingSourceDrafts: 0,
  missingLocalDrafts: 0,
  missingLocalAssets: 0,
};

for (const product of config.products ?? []) {
  summary.productCount += 1;
  if (!product.id || !product.name) errors.push("every product must include id and name");
  if (!exists(product.prd)) errors.push(`${product.id}: missing PRD ${product.prd}`);

  const localDrafts = (product.local_drafts ?? []).map(fileOrDirectoryState);
  const localAssets = (product.local_assets ?? []).map(fileOrDirectoryState);
  const missingLocalDrafts = localDrafts.filter((state) => !state.present || !state.nonEmpty);
  const missingLocalAssets = localAssets.filter((state) => !state.present || !state.nonEmpty);
  summary.missingLocalDrafts += missingLocalDrafts.length;
  summary.missingLocalAssets += missingLocalAssets.length;

  for (const draft of missingLocalDrafts) blockers.push(`${product.id}: local launch draft missing or empty: ${draft.path}`);
  for (const asset of missingLocalAssets) blockers.push(`${product.id}: local launch asset missing or empty: ${asset.path}`);

  const actionStates = [];
  for (const action of product.external_actions ?? []) {
    summary.externalActionCount += 1;
    if (!action.key || !/^[a-z0-9-]+$/.test(action.key)) {
      errors.push(`${product.id}: external action key must be lowercase kebab-case`);
    }
    if (!action.result_status?.startsWith("requires-external-")) {
      errors.push(`${product.id}/${action.key}: result_status must require external evidence`);
    }
    if (!Array.isArray(action.required_evidence) || action.required_evidence.length < 3) {
      errors.push(`${product.id}/${action.key}: required_evidence must list at least three items`);
    }
    if (!exists(action.source_draft)) {
      summary.missingSourceDrafts += 1;
      blockers.push(`${product.id}/${action.key}: source draft missing: ${action.source_draft}`);
    }

    const publicIssue = publicIssueState(product.id, action);
    if (!publicIssue.valid) {
      errors.push(...publicIssue.validationErrors);
    } else {
      summary.externalActionsWithPublicIssue += 1;
    }

    const evidence = evidenceFileState(evidenceDir, product.id, action.key);
    if (!evidence.present) {
      summary.externalActionsMissingEvidence += 1;
      blockers.push(
        `${product.id}/${action.key}: external launch evidence is missing; attach ${preferredEvidencePath(product.id, action.key)} or another accepted evidence file; tracked by ${publicIssue.url ?? "missing public issue"}`,
      );
    } else if (!evidence.accepted) {
      summary.externalActionsWithRejectedEvidence += 1;
      blockers.push(
        `${product.id}/${action.key}: external launch evidence is present but not acceptable; replace ${preferredEvidencePath(product.id, action.key)} or another accepted evidence file; tracked by ${publicIssue.url ?? "missing public issue"}`,
      );
    } else {
      summary.externalActionsWithAcceptedEvidence += 1;
    }
    if (!evidence.accepted) {
      missingExternalEvidenceInstructions.push({
        productId: product.id,
        productName: product.name,
        actionKey: action.key,
        actionName: action.name,
        evidenceStatus: evidence.present ? "present-but-rejected" : "missing",
        preferredEvidencePath: preferredEvidencePath(product.id, action.key),
        acceptedEvidencePaths: acceptedEvidencePaths(product.id, action.key),
        templatePath: templateEvidencePath(product.id, action.key),
        requiredEvidence: action.required_evidence,
        requiredFields: captureFields,
        sourceDraft: action.source_draft,
        publicIssueUrl: publicIssue.url,
      });
    }
    actionStates.push({
      key: action.key,
      name: action.name,
      prdRows: action.prd_rows ?? [],
      sourceDraft: action.source_draft,
      requiredEvidence: action.required_evidence,
      resultStatus: action.result_status,
      publicIssue,
      externalEvidencePresent: evidence.accepted,
      evidenceFiles: evidence.files,
      evidenceStatus: evidence.accepted ? "accepted" : evidence.present ? "present-but-rejected" : "missing",
      preferredEvidencePath: preferredEvidencePath(product.id, action.key),
      acceptedEvidencePaths: acceptedEvidencePaths(product.id, action.key),
      templatePath: templateEvidencePath(product.id, action.key),
      requiredFields: captureFields,
    });
  }

  const localLaunchPacketReady = missingLocalDrafts.length === 0 && missingLocalAssets.length === 0;
  if (localLaunchPacketReady) summary.productsWithLocalPacketsReady += 1;
  const acceptedEvidenceCount = actionStates.filter((action) => action.externalEvidencePresent).length;

  productStates.push({
    id: product.id,
    name: product.name,
    prd: product.prd,
    localDrafts,
    localAssets,
    localLaunchPacketReady,
    externalEvidenceSummary: {
      actionCount: actionStates.length,
      acceptedEvidenceCount,
      missingEvidenceCount: actionStates.filter(
        (action) => !action.externalEvidencePresent && action.evidenceFiles.length === 0,
      ).length,
      rejectedEvidenceCount: actionStates.filter(
        (action) => !action.externalEvidencePresent && action.evidenceFiles.length > 0,
      ).length,
    },
    externalActions: actionStates,
  });
}

if (errors.length > 0) {
  for (const error of errors) console.error(error);
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  readyForLaunchOpsClosure: blockers.length === 0,
  checkedAt: new Date().toISOString(),
  safetyRule:
    "This verifier checks local launch packet presence and non-placeholder evidence-file presence; it does not post, schedule, send email, upload videos, create community channels, or expose credentials.",
  evidenceDirectory: {
    envName: config.evidence_dir_env,
    configured: Boolean(evidenceDir),
    source: evidenceDirSource,
    valuePrinted: false,
    acceptedLayouts: [
      "$AURAONE_OPEN_STUDIO_LAUNCH_EVIDENCE_DIR/<product-id>/<action-key>.<md|json|txt|png|pdf>",
      "docs/evidence/product/open-studio-launch-ops/<product-id>/<action-key>.<md|json|txt|png|pdf>",
    ],
  },
  summary,
  missingExternalEvidenceInstructions,
  products: productStates,
  blockers,
}, null, 2));
