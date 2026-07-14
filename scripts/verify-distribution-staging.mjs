#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateReleaseEvidence } from "./lib/release-evidence.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const platformRoot = path.resolve(scriptDir, "..");
const targetVersion = "0.2.0";
const archivalVersion = "0.1.0";
const errors = [];

const products = [
  {
    id: "rubric-studio-open",
    cask: "rubric-studio-open",
    winget: "AuraOne.RubricStudioOpen",
    linuxSlug: "rubric-studio-open",
    appId: "ai.auraone.rubricstudio.open",
  },
  {
    id: "agent-studio-open",
    cask: "agent-studio-open",
    winget: "AuraOne.AgentStudioOpen",
    linuxSlug: "agent-studio-open",
    appId: "ai.auraone.agentstudio",
  },
  {
    id: "robotics-studio-open",
    cask: "robotics-studio-open",
    winget: "AuraOne.RoboticsStudioOpen",
    linuxSlug: "robotics-studio-open",
    appId: "ai.auraone.roboticsstudio",
  },
];

function fullPath(relativePath) {
  return path.join(platformRoot, relativePath);
}

function read(relativePath) {
  const absolutePath = fullPath(relativePath);
  if (!fs.existsSync(absolutePath)) {
    errors.push(`missing ${relativePath}`);
    return "";
  }
  return fs.readFileSync(absolutePath, "utf8");
}

function json(relativePath) {
  const text = read(relativePath);
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch (error) {
    errors.push(`${relativePath}: invalid JSON: ${error.message}`);
    return {};
  }
}

function requireSnippet(text, snippet, label) {
  if (!text.includes(snippet)) errors.push(`${label}: missing ${JSON.stringify(snippet)}`);
}

const plan = json("distribution/release-plan.uiuxoss.json");
const index = json("distribution/release-evidence/index.json");
const indexByProduct = new Map((index.products ?? []).map((product) => [product.id, product]));
const planByProduct = new Map((plan.products ?? []).map((product) => [product.id, product]));

if (plan.mode !== "dry-run" || plan.publication?.enabled !== false) {
  errors.push("release plan must remain a publication-disabled dry run");
}
if (plan.sourceCommit !== null || plan.sourceState !== "uncommitted-staged-worktree") {
  errors.push("release plan must not claim a release commit before the staged worktree is committed");
}

for (const product of products) {
  const planned = planByProduct.get(product.id);
  if (!planned) {
    errors.push(`${product.id}: missing release-plan product`);
    continue;
  }
  if (
    planned.sourceVersion !== targetVersion ||
    planned.releaseVersion !== targetVersion ||
    planned.status !== "blocked"
  ) {
    errors.push(`${product.id}: release plan must stage blocked ${targetVersion}`);
  }

  const stagedPath = `distribution/release-evidence/${product.id}/${targetVersion}.json`;
  const archivalPath = `distribution/release-evidence/${product.id}/${archivalVersion}.json`;
  if (planned.stagedEvidence !== stagedPath || planned.archivalEvidence !== archivalPath) {
    errors.push(`${product.id}: release-plan evidence paths are not canonical`);
  }
  const staged = json(stagedPath);
  const archival = json(archivalPath);
  const stagedValidation = validateReleaseEvidence(staged, { platformRoot });
  const archivalValidation = validateReleaseEvidence(archival, { platformRoot });
  for (const error of stagedValidation.errors) errors.push(`${stagedPath}: ${error}`);
  for (const error of archivalValidation.errors) errors.push(`${archivalPath}: ${error}`);
  if (
    staged.evidenceKind !== "staged" ||
    staged.product?.version !== targetVersion ||
    staged.release?.status !== "blocked"
  ) {
    errors.push(`${product.id}: current release evidence must be staged and blocked at ${targetVersion}`);
  }
  if (
    archival.evidenceKind !== "archival" ||
    archival.product?.version !== archivalVersion
  ) {
    errors.push(`${product.id}: historical evidence must remain archival at ${archivalVersion}`);
  }
  const readyArtifacts = staged.artifacts?.filter(
    (artifact) => artifact.status === "ready",
  ) ?? [];
  if (
    staged.release?.releaseUrl !== null ||
    staged.artifacts?.some(
      (artifact) =>
        artifact.url !== null ||
        artifact.status === "verified" ||
        artifact.signing?.status === "verified",
    )
  ) {
    errors.push(`${product.id}: staged evidence contains a public artifact or verified release claim`);
  }
  if (
    readyArtifacts.length !== 1 ||
    readyArtifacts[0]?.id !== "macos-aarch64-dmg"
  ) {
    errors.push(`${product.id}: staged evidence must contain exactly one locally ready macOS DMG`);
  }
  if (
    staged.artifacts?.some(
      (artifact) =>
        artifact.status === "blocked" &&
        (
          artifact.sha256 !== null ||
          artifact.sizeBytes !== null ||
          artifact.localPath !== null ||
          artifact.signing?.status !== "blocked"
        ),
    )
  ) {
    errors.push(`${product.id}: blocked staged artifacts must not contain local release claims`);
  }

  const indexProduct = indexByProduct.get(product.id);
  if (
    indexProduct?.current?.version !== targetVersion ||
    indexProduct?.current?.evidenceKind !== "staged" ||
    indexProduct?.current?.manifest !== `${product.id}/${targetVersion}.json`
  ) {
    errors.push(`${product.id}: release-evidence index current entry is not staged ${targetVersion}`);
  }
  if (
    !indexProduct?.archive?.some(
      (entry) =>
        entry.version === archivalVersion &&
        entry.evidenceKind === "archival" &&
        entry.manifest === `${product.id}/${archivalVersion}.json`,
    )
  ) {
    errors.push(`${product.id}: release-evidence index does not preserve archival ${archivalVersion}`);
  }

  const caskPath = `distribution/homebrew/Casks/${product.cask}.rb`;
  const cask = read(caskPath);
  requireSnippet(cask, `version "${targetVersion}"`, caskPath);
  requireSnippet(cask, 'sha256 "BLOCKED_UNTIL_SIGNED_DMG_SHA256"', caskPath);
  requireSnippet(cask, 'url "BLOCKED_UNTIL_SIGNED_DMG_RELEASE_URL"', caskPath);
  if (/sha256\s+"[0-9a-f]{64}"/.test(cask)) {
    errors.push(`${caskPath}: staged cask must not contain a release digest`);
  }
  const archivedCaskPath =
    `distribution/homebrew/archive/${archivalVersion}/${product.cask}.rb`;
  const archivedCask = read(archivedCaskPath);
  requireSnippet(archivedCask, `version "${archivalVersion}"`, archivedCaskPath);
  if (!/sha256\s+"[0-9a-f]{64}"/.test(archivedCask)) {
    errors.push(`${archivedCaskPath}: archival cask must preserve its recorded digest`);
  }

  const wingetRoot = `distribution/winget/${product.winget}/${targetVersion}`;
  const wingetInstaller = read(`${wingetRoot}/${product.winget}.installer.yaml`);
  const wingetVersion = read(`${wingetRoot}/${product.winget}.yaml`);
  const wingetLocale = read(`${wingetRoot}/${product.winget}.locale.en-US.yaml`);
  for (const [text, relativePath] of [
    [wingetInstaller, `${wingetRoot}/${product.winget}.installer.yaml`],
    [wingetVersion, `${wingetRoot}/${product.winget}.yaml`],
    [wingetLocale, `${wingetRoot}/${product.winget}.locale.en-US.yaml`],
  ]) {
    requireSnippet(text, `PackageVersion: ${targetVersion}`, relativePath);
  }
  requireSnippet(wingetInstaller, "BLOCKED_UNTIL_SIGNED_MSI_SHA256", wingetRoot);
  requireSnippet(wingetInstaller, "BLOCKED-UNTIL-VERIFIED-WIX-PRODUCT-CODE", wingetRoot);
  if (/InstallerSha256:\s*[0-9a-fA-F]{64}/.test(wingetInstaller)) {
    errors.push(`${wingetRoot}: staged winget manifest must not contain a release digest`);
  }
  read(
    `distribution/winget/${product.winget}/${archivalVersion}/${product.winget}.installer.yaml`,
  );

  const debPath = `distribution/linux/deb/${product.linuxSlug}.control`;
  const rpmPath = `distribution/linux/rpm/${product.linuxSlug}.spec`;
  const metainfoPath = `distribution/linux/appimage/${product.appId}.metainfo.xml`;
  requireSnippet(read(debPath), `Version: ${targetVersion}`, debPath);
  requireSnippet(read(rpmPath), `Version: ${targetVersion}`, rpmPath);
  const metainfo = read(metainfoPath);
  requireSnippet(metainfo, `<release version="${targetVersion}"`, metainfoPath);
  requireSnippet(metainfo, "No Linux artifact is published or verified.", metainfoPath);
}

const linux = json("distribution/linux/linux-artifact-readiness.json");
if (linux.version !== targetVersion || linux.evidence_kind !== "staged") {
  errors.push("Linux readiness must be staged at 0.2.0");
}
const windows = json("distribution/windows/windows-package-identity-readiness.json");
if (windows.target_version !== targetVersion || windows.evidence_kind !== "staged") {
  errors.push("Windows readiness must be staged at 0.2.0");
}
if ((windows.products ?? []).some((product) => product.version !== targetVersion)) {
  errors.push("Every Windows readiness product must target 0.2.0");
}

if (errors.length) {
  for (const error of errors) console.error(error);
  process.exit(1);
}

console.log(
  JSON.stringify(
    {
      ok: true,
      targetVersion,
      archivalVersion,
      evidenceState: "staged-unpublishable",
      products: products.map((product) => product.id),
      liveArtifactClaims: 0,
      publicationAttempted: false,
    },
    null,
    2,
  ),
);
