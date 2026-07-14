#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const platformRoot = path.resolve(scriptDir, "..");
const root = path.resolve(platformRoot, "../..");
const configPath = path.join(
  platformRoot,
  "distribution/windows/windows-package-identity-readiness.json",
);
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
const flagshipConfig = JSON.parse(
  fs.readFileSync(path.join(platformRoot, "configs/flagships.json"), "utf8"),
);

const errors = [];
const blockers = [];
const defaultEvidenceDir = path.join(root, "docs/evidence/product/windows-package-identity");
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
      reasons.push("text evidence is too short to prove package identity or release readiness");
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

function evidenceFileState(evidenceDir, product, key) {
  if (!evidenceDir) return { present: false, accepted: false, files: [] };
  const allowed = config.allowed_evidence_extensions ?? [".md", ".json", ".txt", ".png", ".pdf"];
  const bases = [
    { layout: "package-identifier", base: path.resolve(evidenceDir, product.package_identifier, key) },
    { layout: "product-id", base: path.resolve(evidenceDir, product.id, key) },
  ];
  const files = [];
  for (const { layout, base } of bases) {
    for (const extension of allowed) {
      const filePath = `${base}${extension}`;
      if (!fs.existsSync(filePath)) continue;
      files.push({
        layout,
        extension,
        ...validateEvidenceFile(filePath, extension),
      });
    }
  }
  return {
    present: files.length > 0,
    accepted: files.some((file) => file.accepted),
    files,
  };
}

function valueAfterColon(line) {
  return line.slice(line.indexOf(":") + 1).trim().replace(/^"|"$/g, "");
}

function isPlaceholder(value) {
  return /\{\{|PLACEHOLDER|BLOCKED|REPLACE-WITH|00000000-0000-0000-0000-0000000/i.test(value ?? "");
}

function releaseAssetName(installerUrl) {
  try {
    return decodeURIComponent(new URL(installerUrl).pathname.split("/").pop() ?? "");
  } catch {
    return "";
  }
}

function readInstallerManifest(relativePath) {
  const absolutePath = path.join(platformRoot, relativePath);
  if (!fs.existsSync(absolutePath)) {
    return {
      present: false,
      installers: [],
    };
  }
  const text = fs.readFileSync(absolutePath, "utf8");
  const installers = [];
  let current = null;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.startsWith("PackageIdentifier:")) {
      continue;
    }
    if (line.startsWith("- Architecture:")) {
      current = { architecture: valueAfterColon(line) };
      installers.push(current);
      continue;
    }
    if (!current) continue;
    if (line.startsWith("InstallerUrl:")) current.installerUrl = valueAfterColon(line);
    if (line.startsWith("InstallerSha256:")) current.installerSha256 = valueAfterColon(line);
    if (line.startsWith("ProductCode:")) current.productCode = valueAfterColon(line);
  }

  return {
    present: true,
    installers,
  };
}

function ghReleaseAssets(repository, tagName) {
  const output = {
    available: false,
    error: null,
    repository,
    tagName,
    url: null,
    assetNames: [],
  };
  if (!commandAvailable("gh")) {
    output.error = "gh command is not installed";
    return output;
  }
  const result = spawnSync(
    "gh",
    ["release", "view", tagName, "--repo", repository, "--json", "url,assets"],
    { encoding: "utf8", maxBuffer: 1024 * 1024 * 4 },
  );
  if (result.status !== 0) {
    output.error = (result.stderr || result.stdout).trim() || `gh exited ${result.status}`;
    return output;
  }
  const release = JSON.parse(result.stdout);
  output.available = true;
  output.url = release.url ?? null;
  output.assetNames = (release.assets ?? []).map((asset) => asset.name).filter(Boolean);
  return output;
}

if (config.$schema !== "https://schemas.auraone.ai/open-studio/windows-package-identity-readiness/v1.json") {
  errors.push("schema must be the Open Studio Windows package identity readiness v1 URL");
}
if (config.status !== "evidence-packet-prepared-external-registration-pending") {
  errors.push("status must preserve the external-registration-pending state");
}
if (config.evidence_kind !== "staged" || config.target_version !== "0.2.0") {
  errors.push("Windows package identity readiness must describe the staged 0.2.0 target");
}
if (
  !Array.isArray(config.archival_manifest_roots) ||
  config.archival_manifest_roots.length !== 3 ||
  config.archival_manifest_roots.some((relativePath) => !existsFromPlatform(relativePath))
) {
  errors.push("Windows readiness must preserve all three 0.1.0 archival manifest roots");
}
if (!config.completion_rule?.includes("Do not mark Windows package identity")) {
  errors.push("completion_rule must forbid closing Windows identity without evidence");
}
if (config.publisher?.winget_publisher !== flagshipConfig.wingetPublisher) {
  errors.push("publisher.winget_publisher must match configs/flagships.json");
}

const evidenceDirValue = process.env[config.evidence_dir_env] ?? "";
const evidenceDirSource = evidenceDirValue
  ? "env"
  : fs.existsSync(defaultEvidenceDir)
    ? "default"
    : "none";
const evidenceDir = evidenceDirValue
  ? path.resolve(path.isAbsolute(evidenceDirValue) ? evidenceDirValue : path.join(root, evidenceDirValue))
  : fs.existsSync(defaultEvidenceDir)
    ? defaultEvidenceDir
    : "";
const configuredFlagships = new Map(
  flagshipConfig.flagships.map((flagship) => [flagship.id, flagship]),
);
const productStates = [];

for (const product of config.products ?? []) {
  const flagship = configuredFlagships.get(product.id);
  if (!flagship) {
    errors.push(`${product.id}: product is missing from configs/flagships.json`);
    continue;
  }
  if (flagship.wingetPackageIdentifier !== product.package_identifier) {
    errors.push(
      `${product.id}: package identifier ${product.package_identifier} does not match configs/flagships.json`,
    );
  }
  if (product.version !== config.target_version) {
    errors.push(`${product.id}: version must match target_version ${config.target_version}`);
  }
  if (!existsFromRoot(product.prd)) {
    errors.push(`${product.id}: missing PRD ${product.prd}`);
  }
  if (!existsFromPlatform(product.winget_manifest)) {
    errors.push(`${product.id}: missing winget manifest ${product.winget_manifest}`);
  }

  const identityEvidence = (product.identity_evidence ?? []).map((item) => {
    if (!item.key || !/^[a-z0-9-]+$/.test(item.key)) {
      errors.push(`${product.id}: identity evidence key must be lowercase kebab-case`);
    }
    if (!Array.isArray(item.required_evidence) || item.required_evidence.length < 3) {
      errors.push(`${product.id}/${item.key}: required_evidence must list at least three items`);
    }
    const evidence = evidenceFileState(evidenceDir, product, item.key);
    if (!evidence.present) {
      blockers.push(`${product.package_identifier}/${item.key}: Microsoft identity evidence is missing`);
    } else if (!evidence.accepted) {
      blockers.push(`${product.package_identifier}/${item.key}: Microsoft identity evidence is present but not acceptable`);
    }
    return {
      key: item.key,
      name: item.name,
      requiredEvidence: item.required_evidence,
      externalEvidencePresent: evidence.accepted,
      evidenceFiles: evidence.files,
    };
  });

  const releaseEvidence = (product.release_evidence ?? []).map((item) => {
    if (!item.key || !/^[a-z0-9-]+$/.test(item.key)) {
      errors.push(`${product.id}: release evidence key must be lowercase kebab-case`);
    }
    if (!Array.isArray(item.required_evidence) || item.required_evidence.length < 3) {
      errors.push(`${product.id}/${item.key}: required_evidence must list at least three items`);
    }
    const evidence = evidenceFileState(evidenceDir, product, item.key);
    if (!evidence.present) {
      blockers.push(`${product.package_identifier}/${item.key}: Windows release/winget evidence is missing`);
    } else if (!evidence.accepted) {
      blockers.push(`${product.package_identifier}/${item.key}: Windows release/winget evidence is present but not acceptable`);
    }
    return {
      key: item.key,
      name: item.name,
      requiredEvidence: item.required_evidence,
      externalEvidencePresent: evidence.accepted,
      evidenceFiles: evidence.files,
    };
  });

  const manifest = readInstallerManifest(product.winget_manifest);
  const installers = manifest.installers.map((installer) => {
    const assetName = releaseAssetName(installer.installerUrl);
    const shaPlaceholder = isPlaceholder(installer.installerSha256);
    const productCodePlaceholder = isPlaceholder(installer.productCode);
    if (shaPlaceholder) {
      blockers.push(`${product.package_identifier}/${installer.architecture}: InstallerSha256 is a placeholder`);
    }
    if (productCodePlaceholder) {
      blockers.push(`${product.package_identifier}/${installer.architecture}: ProductCode is a placeholder`);
    }
    return {
      architecture: installer.architecture,
      assetName,
      expectedAsset: product.expected_msi_assets.includes(assetName),
      installerUrl: installer.installerUrl,
      shaPlaceholder,
      productCodePlaceholder,
    };
  });
  const expectedAssetNames = new Set(product.expected_msi_assets ?? []);
  const manifestAssetNames = new Set(installers.map((installer) => installer.assetName));
  const missingManifestAssets = [...expectedAssetNames].filter((asset) => !manifestAssetNames.has(asset));
  for (const asset of missingManifestAssets) {
    blockers.push(`${product.package_identifier}: expected MSI asset is missing from winget manifest: ${asset}`);
  }
  const releaseAssets = ghReleaseAssets(flagship.githubRepository, `v${product.version}`);
  if (!releaseAssets.available) {
    blockers.push(
      `${product.package_identifier}: GitHub Release v${product.version} assets could not be read: ${releaseAssets.error}`,
    );
  }
  const releaseAssetNames = new Set(releaseAssets.assetNames);
  const expectedReleaseMsiAssets = (product.expected_msi_assets ?? []).map((assetName) => {
    const present = releaseAssetNames.has(assetName);
    if (releaseAssets.available && !present) {
      blockers.push(
        `${product.package_identifier}: expected MSI asset is missing from GitHub Release v${product.version}: ${assetName}`,
      );
    }
    return { name: assetName, present };
  });
  const allExpectedReleaseMsiAssetsPresent =
    releaseAssets.available && expectedReleaseMsiAssets.every((asset) => asset.present);

  productStates.push({
    id: product.id,
    name: product.name,
    githubRepository: flagship.githubRepository,
    packageIdentifier: product.package_identifier,
    version: product.version,
    prd: product.prd,
    wingetManifest: product.winget_manifest,
    expectedMsiAssets: product.expected_msi_assets,
    identityEvidence,
    releaseEvidence,
    winget: {
      manifestPresent: manifest.present,
      installers,
      manifestAssetsMatchExpected: missingManifestAssets.length === 0 &&
        installers.every((installer) => installer.expectedAsset),
      manifestHasRealShaAndProductCode:
        installers.length > 0 &&
        installers.every((installer) => !installer.shaPlaceholder && !installer.productCodePlaceholder),
    },
    release: {
      available: releaseAssets.available,
      error: releaseAssets.error,
      tagName: releaseAssets.tagName,
      url: releaseAssets.url,
      expectedMsiAssets: expectedReleaseMsiAssets,
      allExpectedMsiAssetsPresent: allExpectedReleaseMsiAssetsPresent,
    },
    readyForPackageIdentityClosure:
      identityEvidence.length > 0 &&
      identityEvidence.every((item) => item.externalEvidencePresent),
    readyForWingetSubmission:
      identityEvidence.length > 0 &&
      identityEvidence.every((item) => item.externalEvidencePresent) &&
      releaseEvidence.length > 0 &&
      releaseEvidence.every((item) => item.externalEvidencePresent) &&
      installers.length > 0 &&
      installers.every((installer) => !installer.shaPlaceholder && !installer.productCodePlaceholder) &&
      missingManifestAssets.length === 0 &&
      allExpectedReleaseMsiAssetsPresent,
  });
}

if (errors.length > 0) {
  for (const error of errors) console.error(error);
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  readyForWindowsPackageIdentityClosure:
    productStates.length > 0 &&
    productStates.every((product) => product.readyForPackageIdentityClosure),
  readyForWingetSubmission:
    productStates.length > 0 &&
    productStates.every((product) => product.readyForWingetSubmission),
  checkedAt: new Date().toISOString(),
  safetyRule:
    "This verifier prints only booleans, public package identifiers, expected evidence keys, evidence-file validation status, and manifest placeholder status; it does not print credential values or evidence directory paths.",
  evidenceDirectory: {
    envName: config.evidence_dir_env,
    configured: Boolean(evidenceDir),
    source: evidenceDirSource,
    valuePrinted: false,
    acceptedLayouts: [
      "$AURAONE_WINDOWS_IDENTITY_EVIDENCE_DIR/<package-identifier>/<evidence-key>.<md|json|txt|png|pdf>",
      "$AURAONE_WINDOWS_IDENTITY_EVIDENCE_DIR/<product-id>/<evidence-key>.<md|json|txt|png|pdf>",
      "docs/evidence/product/windows-package-identity/<package-identifier>/<evidence-key>.<md|json|txt|png|pdf>",
      "docs/evidence/product/windows-package-identity/<product-id>/<evidence-key>.<md|json|txt|png|pdf>"
    ],
  },
  publisher: config.publisher,
  products: productStates,
  blockers,
}, null, 2));
