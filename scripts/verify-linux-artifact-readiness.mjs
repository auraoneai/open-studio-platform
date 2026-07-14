#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const platformRoot = path.resolve(scriptDir, "..");
const root = path.resolve(platformRoot, "../..");
const configPath = path.join(platformRoot, "distribution/linux/linux-artifact-readiness.json");
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
const flagshipConfig = JSON.parse(fs.readFileSync(path.join(platformRoot, "configs/flagships.json"), "utf8"));
const errors = [];
const blockers = [];
const defaultEvidenceDir = path.join(root, "docs/evidence/product/linux-artifacts");
const textEvidenceExtensions = new Set([".md", ".json", ".txt"]);
const placeholderPattern =
  /\b(TODO|TBD|FIXME|placeholder|pending|not yet|draft only|to be added|example only)\b/i;

function commandAvailable(command) {
  return spawnSync("which", [command], { stdio: "ignore" }).status === 0;
}

function existsFromRoot(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function existsFromPlatform(relativePath) {
  return fs.existsSync(path.join(platformRoot, relativePath));
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
      reasons.push("text evidence is too short to prove Linux artifact readiness");
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
    extension,
    bytes: stat.size,
    accepted: reasons.length === 0,
    rejectionReasons: reasons,
  };
}

function evidenceFileState(evidenceDir, productId, key) {
  if (!evidenceDir) return { present: false, accepted: false, files: [] };
  const allowed = config.allowed_evidence_extensions ?? [".md", ".json", ".txt", ".png", ".pdf"];
  const base = path.resolve(evidenceDir, productId, key);
  const files = allowed
    .filter((extension) => fs.existsSync(`${base}${extension}`))
    .map((extension) => validateEvidenceFile(`${base}${extension}`, extension));
  return {
    present: files.length > 0,
    accepted: files.some((file) => file.accepted),
    files,
  };
}

function ghReleaseAssets(repository, version) {
  if (!commandAvailable("gh")) {
    return {
      available: false,
      error: "gh command is not installed",
      url: null,
      assets: [],
    };
  }
  const result = spawnSync(
    "gh",
    ["release", "view", `v${version}`, "--repo", repository, "--json", "url,assets"],
    { encoding: "utf8", maxBuffer: 1024 * 1024 * 5 },
  );
  if (result.status !== 0) {
    return {
      available: false,
      error: (result.stderr || result.stdout).trim() || `gh exited ${result.status}`,
      url: null,
      assets: [],
    };
  }
  const release = JSON.parse(result.stdout);
  return {
    available: true,
    error: null,
    url: release.url,
    assets: release.assets.map((asset) => asset.name).sort(),
  };
}

function secretKeyStatus(expectedFingerprint, configuredKeyId, homedir) {
  const status = {
    gpgAvailable: commandAvailable("gpg"),
    configuredKeyIdPresent: Boolean(configuredKeyId),
    homedirConfigured: Boolean(homedir),
    homedirPresent: Boolean(homedir && fs.existsSync(homedir)),
    expectedFingerprint,
    expectedSecretKeyPresent: false,
    configuredSecretKeyPresent: false,
  };
  if (!status.gpgAvailable) return status;

  const args = ["--batch"];
  if (homedir) args.push("--homedir", homedir);
  args.push("--list-secret-keys", "--with-colons");
  const result = spawnSync(
    "gpg",
    args,
    { encoding: "utf8", maxBuffer: 1024 * 1024 },
  );
  if (result.status !== 0) return status;

  const fingerprints = result.stdout
    .split(/\r?\n/)
    .filter((line) => line.startsWith("fpr:"))
    .map((line) => line.split(":")[9])
    .filter(Boolean);
  status.expectedSecretKeyPresent = fingerprints.includes(expectedFingerprint);
  if (configuredKeyId) {
    const normalized = configuredKeyId.replaceAll(/\s/g, "");
    status.configuredSecretKeyPresent = fingerprints.some((fingerprint) => fingerprint.includes(normalized));
  }
  return status;
}

if (config.$schema !== "https://schemas.auraone.ai/open-studio/linux-artifact-readiness/v1.json") {
  errors.push("schema must be the Open Studio Linux artifact readiness v1 URL");
}
const allowedStatuses = new Set([
  "metadata-prepared-artifacts-and-signatures-pending",
  "artifacts-signatures-and-evidence-complete",
]);
if (!allowedStatuses.has(config.status)) {
  errors.push("status must be a recognized Linux artifact readiness state");
}
if (config.evidence_kind !== "staged") {
  errors.push("Linux artifact readiness evidence_kind must be staged");
}
if (config.version !== "0.2.0") {
  errors.push("Linux artifact readiness version must be 0.2.0");
}
if (
  !Array.isArray(config.archival_release_evidence) ||
  config.archival_release_evidence.length !== 3 ||
  config.archival_release_evidence.some((relativePath) => !existsFromPlatform(relativePath))
) {
  errors.push("Linux artifact readiness must preserve all three 0.1.0 archival evidence records");
}
if (!config.completion_rule?.includes("Do not mark Linux artifact/signature readiness complete")) {
  errors.push("completion_rule must forbid Linux closure without artifact/signature evidence");
}
if (config.signing?.fingerprint !== flagshipConfig.gpgFingerprint) {
  errors.push("signing.fingerprint must match configs/flagships.json");
}
if (!existsFromPlatform(config.signing?.signing_script ?? "")) {
  errors.push(`missing signing script ${config.signing?.signing_script}`);
}

const evidenceDirValue = process.env[config.evidence_dir_env] ?? "";
const evidenceDir = evidenceDirValue
  ? path.resolve(path.isAbsolute(evidenceDirValue) ? evidenceDirValue : path.join(root, evidenceDirValue))
  : fs.existsSync(defaultEvidenceDir)
    ? defaultEvidenceDir
    : "";
const configuredFlagships = new Map(flagshipConfig.flagships.map((flagship) => [flagship.id, flagship]));
const defaultGpgHomedir = path.join(process.env.HOME ?? "", ".auraone/open-studio-platform/secrets/gnupg");
const effectiveGpgHomedir = process.env.AURAONE_GPG_HOMEDIR || (fs.existsSync(defaultGpgHomedir) ? defaultGpgHomedir : "");
const signingStatus = secretKeyStatus(
  config.signing.fingerprint,
  process.env.AURAONE_GPG_KEY_ID || process.env.AURAONE_RELEASE_GPG_FINGERPRINT || "",
  effectiveGpgHomedir,
);
const localSigningCustodyReady = Boolean(
  (process.env.AURAONE_GPG_KEY_ID && signingStatus.configuredSecretKeyPresent) ||
    signingStatus.expectedSecretKeyPresent ||
    process.env.AURAONE_RELEASE_GPG_PRIVATE_KEY,
);

const evidenceStates = (config.required_evidence ?? []).map((item) => {
  if (!item.key || !/^[a-z0-9-]+$/.test(item.key)) {
    errors.push("required evidence keys must be lowercase kebab-case");
  }
  if (!Array.isArray(item.required_evidence) || item.required_evidence.length < 3) {
    errors.push(`${item.key}: required_evidence must list at least three items`);
  }
  return {
    key: item.key,
    name: item.name,
    requiredEvidence: item.required_evidence,
  };
});

const productStates = [];
for (const product of config.products ?? []) {
  const flagship = configuredFlagships.get(product.id);
  if (!flagship) {
    errors.push(`${product.id}: product is missing from configs/flagships.json`);
    continue;
  }
  if (flagship.githubRepository !== product.repository) {
    errors.push(`${product.id}: repository does not match configs/flagships.json`);
  }
  if (!existsFromRoot(product.prd)) {
    errors.push(`${product.id}: missing PRD ${product.prd}`);
  }
  const metadata = product.metadata.map((relativePath) => ({
    path: relativePath,
    present: existsFromPlatform(relativePath),
  }));
  for (const item of metadata.filter((item) => !item.present)) {
    errors.push(`${product.id}: missing Linux package metadata ${item.path}`);
  }

  const release = ghReleaseAssets(product.repository, config.version);
  const assetSet = new Set(release.assets);
  const artifacts = product.required_artifacts.map((artifact) => {
    const matchedAsset = artifact.accepted_names.find((name) => assetSet.has(name)) ?? null;
    const signatureAsset = matchedAsset ? `${matchedAsset}${config.signing.required_signature_suffix}` : null;
    const sha256Asset = matchedAsset ? `${matchedAsset}${config.signing.per_artifact_sha256_suffix}` : null;
    const present = Boolean(matchedAsset);
    const detachedSignaturePresent = Boolean(signatureAsset && assetSet.has(signatureAsset));
    const perArtifactShaPresent = Boolean(sha256Asset && assetSet.has(sha256Asset));
    if (!present) {
      blockers.push(`${product.id}/${artifact.format}/${artifact.arch}: Linux artifact is missing`);
    }
    if (present && !detachedSignaturePresent) {
      blockers.push(`${product.id}/${artifact.format}/${artifact.arch}: detached .asc signature is missing`);
    }
    return {
      format: artifact.format,
      arch: artifact.arch,
      acceptedNames: artifact.accepted_names,
      present,
      matchedAsset,
      detachedSignaturePresent,
      perArtifactShaPresent,
    };
  });

  const productEvidence = evidenceStates.map((evidence) => {
    const evidenceFile = evidenceFileState(evidenceDir, product.id, evidence.key);
    if (!evidenceFile.present) {
      blockers.push(`${product.id}/${evidence.key}: Linux release evidence is missing`);
    } else if (!evidenceFile.accepted) {
      blockers.push(`${product.id}/${evidence.key}: Linux release evidence is present but not acceptable`);
    }
    return {
      ...evidence,
      externalEvidencePresent: evidenceFile.accepted,
      evidenceFiles: evidenceFile.files,
    };
  });

  const allArtifactsPresent = artifacts.every((artifact) => artifact.present);
  const allDetachedSignaturesPresent = artifacts.every((artifact) => artifact.detachedSignaturePresent);
  const allEvidencePresent = productEvidence.every((evidence) => evidence.externalEvidencePresent);

  productStates.push({
    id: product.id,
    name: product.name,
    repository: product.repository,
    releaseAvailable: release.available,
    releaseUrl: release.url,
    releaseError: release.error,
    metadata,
    artifacts,
    evidence: productEvidence,
    allArtifactsPresent,
    allDetachedSignaturesPresent,
    readyForLinuxArtifactClosure: allArtifactsPresent && allDetachedSignaturesPresent && allEvidencePresent,
  });
}

if (!localSigningCustodyReady) {
  blockers.push("Linux release GPG private-key custody is not configured locally");
}

if (errors.length > 0) {
  for (const error of errors) console.error(error);
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  readyForLinuxArtifactClosure:
    productStates.length > 0 && productStates.every((product) => product.readyForLinuxArtifactClosure),
  checkedAt: new Date().toISOString(),
  safetyRule:
    "This verifier prints only booleans, public repositories, artifact names, and evidence validation summaries; it does not print secret values or evidence directory paths.",
  evidenceDirectory: {
    envName: config.evidence_dir_env,
    configured: Boolean(evidenceDir),
    valuePrinted: false,
    acceptedLayout:
      "$AURAONE_LINUX_ARTIFACT_EVIDENCE_DIR/<product-id>/<evidence-key>.<md|json|txt|png|pdf>",
  },
  commands: {
    gh: commandAvailable("gh"),
    gpg: commandAvailable("gpg"),
  },
  signing: {
    publicKeyUrl: config.signing.public_key_url,
    fingerprint: config.signing.fingerprint,
    signingScript: config.signing.signing_script,
    secretKey: signingStatus,
    localSigningCustodyReady,
  },
  products: productStates,
  blockers,
}, null, 2));
