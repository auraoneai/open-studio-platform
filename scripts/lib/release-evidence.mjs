import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const RELEASE_EVIDENCE_SCHEMA =
  "https://schemas.auraone.ai/open-studio/release-evidence/v1.json";

export const allowedStatuses = new Set([
  "draft",
  "ready",
  "review",
  "verified",
  "released",
  "warning",
  "failed",
  "blocked",
  "unavailable",
  "stale",
  "partial",
  "not-applicable",
]);
export const allowedEvidenceKinds = new Set(["archival", "staged", "release"]);

const placeholderPattern =
  /\{\{|\}\}|<version>|\bPLACEHOLDER(?:\b|[_-])|BLOCKED-\d|REPLACE-WITH|00000000-0000-0000-0000-0000000|\bTODO\b|\bTBD\b/i;
const sha256Pattern = /^[0-9a-f]{64}$/;
const commitPattern = /^[0-9a-f]{40}$/;
const versionPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

export function sha256File(filePath) {
  return createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

export function containsPlaceholder(value) {
  if (typeof value === "string") return placeholderPattern.test(value);
  if (Array.isArray(value)) return value.some(containsPlaceholder);
  if (value && typeof value === "object") {
    return Object.values(value).some(containsPlaceholder);
  }
  return false;
}

export function expectedArtifactName(product, platform, architecture, type) {
  const version = product.version;
  const names = {
    "rubric-studio-open": {
      "macos-aarch64-dmg": `Rubric.Studio.Open_${version}_aarch64.dmg`,
      "windows-x64-msi": `Rubric-Studio-Open_${version}_x64_en-US.msi`,
      "windows-arm64-msi": `Rubric-Studio-Open_${version}_arm64_en-US.msi`,
      "linux-x64-appimage": `rubric-studio-open_${version}_amd64.AppImage`,
      "linux-arm64-appimage": `rubric-studio-open_${version}_arm64.AppImage`,
      "linux-amd64-deb": `rubric-studio-open_${version}_amd64.deb`,
      "linux-arm64-deb": `rubric-studio-open_${version}_arm64.deb`,
      "linux-x86_64-rpm": `rubric-studio-open-${version}-1.x86_64.rpm`,
      "linux-aarch64-rpm": `rubric-studio-open-${version}-1.aarch64.rpm`,
    },
    "agent-studio-open": {
      "macos-aarch64-dmg": `Agent.Studio.Open_${version}_aarch64.dmg`,
      "windows-x64-msi": `Agent.Studio.Open_${version}_x64_en-US.msi`,
      "linux-x64-appimage": `Agent.Studio.Open_${version}_amd64.AppImage`,
      "linux-amd64-deb": `Agent.Studio.Open_${version}_amd64.deb`,
      "linux-x86_64-rpm": `Agent.Studio.Open-${version}-1.x86_64.rpm`,
    },
    "robotics-studio-open": {
      "macos-aarch64-dmg": `Robotics.Studio.Open_${version}_aarch64.dmg`,
      "windows-x64-msi": `Robotics-Studio-Open_${version}_x64_en-US.msi`,
      "windows-arm64-msi": `Robotics-Studio-Open_${version}_arm64_en-US.msi`,
      "linux-x64-appimage": `robotics-studio-open_${version}_amd64.AppImage`,
      "linux-arm64-appimage": `robotics-studio-open_${version}_arm64.AppImage`,
      "linux-amd64-deb": `robotics-studio-open_${version}_amd64.deb`,
      "linux-arm64-deb": `robotics-studio-open_${version}_arm64.deb`,
      "linux-x86_64-rpm": `robotics-studio-open-${version}-1.x86_64.rpm`,
      "linux-aarch64-rpm": `robotics-studio-open-${version}-1.aarch64.rpm`,
    },
  };
  const key = `${platform}-${architecture}-${type}`;
  return names[product.id]?.[key] ?? null;
}

function validUrl(value) {
  if (value === null) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

function validateStatus(value, label, errors) {
  if (!allowedStatuses.has(value)) errors.push(`${label}: invalid status ${JSON.stringify(value)}`);
}

function validateStringArray(value, label, errors) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !item.trim())) {
    errors.push(`${label}: expected an array of non-empty strings`);
  }
}

export function validateReleaseEvidence(manifest, {
  platformRoot,
  publishable = false,
  requireLocalArtifacts = false,
} = {}) {
  const errors = [];
  const blockers = [];
  const warnings = [];

  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    return { errors: ["manifest must be a JSON object"], blockers, warnings };
  }
  if (manifest.$schema !== RELEASE_EVIDENCE_SCHEMA) {
    errors.push(`$schema must be ${RELEASE_EVIDENCE_SCHEMA}`);
  }
  if (manifest.schemaVersion !== "1.0.0") errors.push("schemaVersion must be 1.0.0");
  if (!allowedEvidenceKinds.has(manifest.evidenceKind)) {
    errors.push("evidenceKind must be archival, staged, or release");
  }

  const product = manifest.product ?? {};
  if (!["rubric-studio-open", "agent-studio-open", "robotics-studio-open"].includes(product.id)) {
    errors.push("product.id must identify one of the three Open Studio flagships");
  }
  if (!versionPattern.test(product.version ?? "")) errors.push("product.version must be semantic");
  if (product.sourceCommit !== null && !commitPattern.test(product.sourceCommit ?? "")) {
    errors.push("product.sourceCommit must be a 40-character lowercase Git SHA or null");
  }
  if (product.license !== "MIT") errors.push("product.license must be MIT");
  if (!validUrl(product.repository)) errors.push("product.repository must be an HTTPS URL");

  const release = manifest.release ?? {};
  validateStatus(release.status, "release.status", errors);
  if (!validUrl(release.releaseUrl)) errors.push("release.releaseUrl must be an HTTPS URL or null");
  if (!validUrl(release.plannedReleaseUrl)) {
    errors.push("release.plannedReleaseUrl must be an HTTPS URL or null");
  }
  if (!release.verifiedAt || Number.isNaN(Date.parse(release.verifiedAt))) {
    errors.push("release.verifiedAt must be an ISO-8601 timestamp");
  }
  if (release.releasedAt !== null && Number.isNaN(Date.parse(release.releasedAt))) {
    errors.push("release.releasedAt must be an ISO-8601 timestamp or null");
  }

  const artifacts = Array.isArray(manifest.artifacts) ? manifest.artifacts : [];
  if (artifacts.length < 5) errors.push("artifacts must include at least DMG, MSI, AppImage, deb, and rpm");
  const requiredTypes = new Set(["dmg", "msi", "appimage", "deb", "rpm"]);
  for (const type of requiredTypes) {
    if (!artifacts.some((artifact) => artifact.type === type)) {
      errors.push(`artifacts must include a ${type} entry`);
    }
  }
  const artifactIds = new Set();
  for (const artifact of artifacts) {
    const label = `artifact ${artifact.id ?? "<missing-id>"}`;
    if (!artifact.id || artifactIds.has(artifact.id)) errors.push(`${label}: id must be unique`);
    artifactIds.add(artifact.id);
    validateStatus(artifact.status, `${label}.status`, errors);
    if (!validUrl(artifact.url)) errors.push(`${label}.url must be an HTTPS URL or null`);
    if (!validUrl(artifact.plannedUrl)) {
      errors.push(`${label}.plannedUrl must be an HTTPS URL or null`);
    }
    if (artifact.sha256 !== null && !sha256Pattern.test(artifact.sha256 ?? "")) {
      errors.push(`${label}.sha256 must be a lowercase SHA-256 digest or null`);
    }
    if (artifact.sizeBytes !== null && (!Number.isInteger(artifact.sizeBytes) || artifact.sizeBytes < 1)) {
      errors.push(`${label}.sizeBytes must be a positive integer or null`);
    }
    const expectedName = expectedArtifactName(
      product,
      artifact.platform,
      artifact.architecture,
      artifact.type,
    );
    if (expectedName && artifact.name !== expectedName) {
      errors.push(`${label}.name must be ${expectedName}`);
    }
    validateStringArray(artifact.evidence, `${label}.evidence`, errors);
    validateStringArray(artifact.blockers, `${label}.blockers`, errors);
    validateStatus(artifact.signing?.status, `${label}.signing.status`, errors);
    if (!validUrl(artifact.signing?.gpgSignatureUrl ?? null)) {
      errors.push(`${label}.signing.gpgSignatureUrl must be an HTTPS URL or null`);
    }

    if (artifact.localPath) {
      if (!platformRoot) {
        warnings.push(`${label}: localPath was not checked because platformRoot was not provided`);
      } else {
        const localPath = path.resolve(platformRoot, artifact.localPath);
        if (!fs.existsSync(localPath)) {
          errors.push(`${label}: localPath does not exist: ${artifact.localPath}`);
        } else {
          const stat = fs.statSync(localPath);
          const digest = sha256File(localPath);
          if (artifact.sizeBytes !== stat.size) {
            errors.push(`${label}: sizeBytes ${artifact.sizeBytes} does not match local file ${stat.size}`);
          }
          if (artifact.sha256 !== digest) {
            errors.push(`${label}: sha256 does not match local file`);
          }
        }
      }
    } else if (requireLocalArtifacts && artifact.status === "verified") {
      blockers.push(`${label}: verified artifact has no localPath for independent verification`);
    }

    if (["verified", "released"].includes(artifact.status)) {
      if (!artifact.url || !artifact.sha256 || !artifact.sizeBytes) {
        errors.push(`${label}: verified/released artifacts require url, sha256, and sizeBytes`);
      }
      if (artifact.blockers.length > 0) {
        errors.push(`${label}: verified/released artifacts cannot retain blockers`);
      }
    }
    if (artifact.status === "blocked" && artifact.blockers.length === 0) {
      errors.push(`${label}: blocked artifacts must explain the blocker`);
    }
  }

  const channels = Array.isArray(manifest.channels) ? manifest.channels : [];
  const requiredChannels = ["github-release", "homebrew", "winget", "linux", "vscode", "updater"];
  for (const channelId of requiredChannels) {
    const matches = channels.filter((channel) => channel.id === channelId);
    if (matches.length !== 1) errors.push(`channels must contain exactly one ${channelId} entry`);
  }
  for (const channel of channels) {
    const label = `channel ${channel.id ?? "<missing-id>"}`;
    validateStatus(channel.status, `${label}.status`, errors);
    if (!validUrl(channel.url)) errors.push(`${label}.url must be an HTTPS URL or null`);
    if (!validUrl(channel.plannedUrl)) {
      errors.push(`${label}.plannedUrl must be an HTTPS URL or null`);
    }
    validateStringArray(channel.evidence, `${label}.evidence`, errors);
    validateStringArray(channel.blockers, `${label}.blockers`, errors);
    if (["verified", "released"].includes(channel.status) && (!channel.url || channel.blockers.length)) {
      errors.push(`${label}: verified/released channels require a URL and no blockers`);
    }
    if (channel.status === "blocked" && channel.blockers.length === 0) {
      errors.push(`${label}: blocked channels must explain the blocker`);
    }
  }

  validateStatus(manifest.updater?.status, "updater.status", errors);
  if (!validUrl(manifest.updater?.manifestUrl ?? null)) {
    errors.push("updater.manifestUrl must be an HTTPS URL or null");
  }
  if (!validUrl(manifest.updater?.plannedManifestUrl ?? null)) {
    errors.push("updater.plannedManifestUrl must be an HTTPS URL or null");
  }
  validateStringArray(manifest.updater?.blockers, "updater.blockers", errors);
  validateStringArray(manifest.blockers, "blockers", errors);
  if (!manifest.rollback?.owner || !manifest.rollback?.instructions) {
    errors.push("rollback must identify an owner and instructions");
  }

  if (containsPlaceholder(manifest)) {
    errors.push("manifest contains a placeholder token");
  }

  if (platformRoot && manifest.updater?.checkedInManifest) {
    const updaterPath = path.resolve(platformRoot, manifest.updater.checkedInManifest);
    if (!fs.existsSync(updaterPath)) {
      errors.push(`updater.checkedInManifest does not exist: ${manifest.updater.checkedInManifest}`);
    } else {
      const updater = JSON.parse(fs.readFileSync(updaterPath, "utf8"));
      if (updater.flagship !== product.id || updater.version !== product.version) {
        errors.push("checked-in updater manifest product/version does not match release evidence");
      }
      const updaterChecksums = updater.checksums ?? {};
      for (const artifact of artifacts.filter((item) => item.url && item.sha256)) {
        if (updaterChecksums[artifact.name] && updaterChecksums[artifact.name] !== artifact.sha256) {
          errors.push(`checked-in updater checksum disagrees for ${artifact.name}`);
        }
      }
    }
  }

  if (manifest.evidenceKind === "staged") {
    if (!["draft", "review", "blocked"].includes(release.status)) {
      errors.push("staged evidence release.status must be draft, review, or blocked");
    }
    if (release.releaseUrl !== null || release.releasedAt !== null) {
      errors.push("staged evidence cannot claim a live release URL or release timestamp");
    }
    if (!release.plannedReleaseUrl) {
      errors.push("staged evidence must record the planned immutable release URL");
    }
    for (const artifact of artifacts) {
      const label = `artifact ${artifact.id}`;
      if (!["ready", "blocked", "not-applicable"].includes(artifact.status)) {
        errors.push(`${label}: staged artifact status must be ready, blocked, or not-applicable`);
      }
      if (artifact.status === "blocked" && !artifact.plannedUrl) {
        errors.push(`${label}: staged blocked artifacts must record plannedUrl`);
      }
      if (artifact.status === "ready") {
        if (artifact.url !== null) {
          errors.push(`${label}: staged ready artifacts cannot claim a live URL`);
        }
        if (!sha256Pattern.test(artifact.sha256 ?? "")) {
          errors.push(`${label}: staged ready artifacts require a valid sha256`);
        }
        if (!Number.isInteger(artifact.sizeBytes) || artifact.sizeBytes < 1) {
          errors.push(`${label}: staged ready artifacts require positive sizeBytes`);
        }
        if (typeof artifact.localPath !== "string" || !artifact.localPath.trim()) {
          errors.push(`${label}: staged ready artifacts require an existing localPath`);
        } else if (!platformRoot) {
          errors.push(`${label}: staged ready artifact localPath cannot be verified without platformRoot`);
        }
        if (artifact.signing?.status !== "ready") {
          errors.push(`${label}: staged ready artifact signing.status must be ready`);
        }
        if (!Array.isArray(artifact.blockers) || artifact.blockers.length === 0) {
          errors.push(`${label}: staged ready artifacts must retain publication blockers`);
        }
      } else {
        if (
          artifact.url !== null ||
          artifact.sha256 !== null ||
          artifact.sizeBytes !== null ||
          artifact.localPath !== null
        ) {
          errors.push(`${label}: staged artifacts cannot claim live URL, checksum, size, or local release artifact`);
        }
        if (!["blocked", "not-applicable"].includes(artifact.signing?.status)) {
          errors.push(`${label}: staged signing status must be blocked or not-applicable`);
        }
      }
    }
    for (const channel of channels) {
      const label = `channel ${channel.id}`;
      if (!["blocked", "not-applicable"].includes(channel.status)) {
        errors.push(`${label}: staged channel status must be blocked or not-applicable`);
      }
      if (channel.url !== null) {
        errors.push(`${label}: staged channels cannot claim a live verified URL`);
      }
      if (channel.status === "blocked" && !channel.plannedUrl) {
        errors.push(`${label}: staged blocked channels must record plannedUrl`);
      }
      if (channel.status !== "not-applicable" && channel.version !== product.version) {
        errors.push(`${label}: staged channel version must match product.version`);
      }
    }
    if (!["blocked", "not-applicable"].includes(manifest.updater?.status)) {
      errors.push("staged updater status must be blocked or not-applicable");
    }
    if (manifest.updater?.status === "blocked" && !manifest.updater?.plannedManifestUrl) {
      errors.push("staged blocked updater must record plannedManifestUrl");
    }
    if (manifest.updater?.manifestUrl !== null || manifest.updater?.checkedInManifest !== null) {
      errors.push("staged updater cannot claim a live or checked-in signed manifest");
    }
    if (!Array.isArray(manifest.blockers) || manifest.blockers.length === 0) {
      errors.push("staged evidence must retain explicit publication blockers");
    }
  }

  if (publishable) {
    if (manifest.evidenceKind !== "release") {
      blockers.push(`evidence kind is ${manifest.evidenceKind}; publishable evidence requires release`);
    }
    if (!commitPattern.test(product.sourceCommit ?? "")) {
      blockers.push("publishable evidence requires an exact 40-character source commit");
    }
    if (release.status !== "verified") {
      blockers.push(`release status is ${release.status}; publishable evidence requires verified`);
    }
    if (!release.releaseUrl || !release.releasedAt) {
      blockers.push("publishable evidence requires releaseUrl and releasedAt");
    }
    for (const artifact of artifacts) {
      if (!["verified", "not-applicable"].includes(artifact.status)) {
        blockers.push(`${artifact.id}: artifact status is ${artifact.status}`);
      }
      if (artifact.status === "verified" && artifact.signing?.status !== "verified") {
        blockers.push(`${artifact.id}: signing status is ${artifact.signing?.status}`);
      }
    }
    for (const channel of channels) {
      if (!["verified", "not-applicable"].includes(channel.status)) {
        blockers.push(`${channel.id}: channel status is ${channel.status}`);
      }
    }
    if (manifest.updater.status !== "verified") {
      blockers.push(`updater status is ${manifest.updater.status}`);
    }
    if (manifest.blockers.length > 0) blockers.push(...manifest.blockers);
  }

  return {
    errors: [...new Set(errors)],
    blockers: [...new Set(blockers)],
    warnings: [...new Set(warnings)],
  };
}
