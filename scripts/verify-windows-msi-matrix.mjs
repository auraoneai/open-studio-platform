#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const platformRoot = path.resolve(scriptDir, "..");
const repoRoot = path.resolve(platformRoot, "../..");
const errors = [];

const requiredFiles = [
  "scripts/sign-windows.ps1",
  "scripts/prepare-windows-msi-release.mjs",
  "scripts/prepare-winget-manifests.mjs",
  "scripts/verify-winget-matrix.mjs",
  "scripts/verify-windows-package-identity-readiness.mjs",
  ".github-templates/workflows/release.yml",
  "distribution/windows/windows-package-identity-readiness.json",
  "distribution/winget/winget-submission-matrix.md",
];

for (const file of requiredFiles) {
  if (!fs.existsSync(path.join(platformRoot, file))) errors.push(`missing ${file}`);
}

const config = readJson("configs/flagships.json");
for (const flagship of config.flagships ?? []) {
  if (!flagship.wingetPackageIdentifier) errors.push(`${flagship.id}: missing wingetPackageIdentifier`);
  if (!flagship.windowsX64Artifact?.includes("${VERSION}")) {
    errors.push(`${flagship.id}: windowsX64Artifact must include \${VERSION}`);
  }
  if (flagship.id !== "agent-studio-open" && !flagship.windowsArm64Artifact?.includes("${VERSION}")) {
    errors.push(`${flagship.id}: windowsArm64Artifact must include \${VERSION}`);
  }
  const version = "0.1.0";
  const manifestPath = path.join(
    platformRoot,
    "distribution/winget",
    flagship.wingetPackageIdentifier,
    version,
    `${flagship.wingetPackageIdentifier}.installer.yaml`,
  );
  if (!fs.existsSync(manifestPath)) {
    errors.push(`${flagship.id}: missing winget installer manifest for ${version}`);
    continue;
  }
  const manifest = readInstallerManifest(manifestPath);
  const expected = [
    { architecture: "x64", artifact: flagship.windowsX64Artifact?.replaceAll("${VERSION}", version) },
    { architecture: "arm64", artifact: flagship.windowsArm64Artifact?.replaceAll("${VERSION}", version) },
  ].filter((item) => item.artifact);
  for (const expectedInstaller of expected) {
    const installer = manifest.installers.find((item) => item.architecture === expectedInstaller.architecture);
    if (!installer) {
      errors.push(`${flagship.id}: winget manifest missing ${expectedInstaller.architecture} installer`);
      continue;
    }
    if (!installer.installerUrl.endsWith(`/${expectedInstaller.artifact}`)) {
      errors.push(
        `${flagship.id}/${expectedInstaller.architecture}: InstallerUrl must end with ${expectedInstaller.artifact}`,
      );
    }
  }
}

const releaseWorkflow = readText(".github-templates/workflows/release.yml");
for (const snippet of [
  "target: windows-x64",
  "target: windows-arm64",
  "rustTarget: x86_64-pc-windows-msvc",
  "rustTarget: aarch64-pc-windows-msvc",
  "scripts/sign-windows.ps1",
  "scripts/prepare-windows-msi-release.mjs",
  "windows-msi-${{ matrix.arch }}.json",
  "--require-signed",
]) {
  if (!releaseWorkflow.includes(snippet)) {
    errors.push(`release workflow missing "${snippet}"`);
  }
}

for (const script of [
  "scripts/prepare-windows-msi-release.mjs",
  "scripts/prepare-winget-manifests.mjs",
  "scripts/verify-windows-msi-matrix.mjs",
]) {
  const text = readText(script);
  if (!text.startsWith("#!/usr/bin/env node")) errors.push(`${script}: missing node shebang`);
}

if (errors.length > 0) {
  for (const error of errors) console.error(error);
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  checkedAt: new Date().toISOString(),
  windowsTargets: ["x64", "arm64"],
  stagedPackages: config.flagships.map((flagship) => flagship.wingetPackageIdentifier),
  finalSubmissionBlockedUntil:
    "EV-signed public MSI artifacts, ProductCode values, clean Windows install evidence, and winget validation evidence exist",
}, null, 2));

function readJson(relativePath) {
  return JSON.parse(readText(relativePath));
}

function readText(relativePath) {
  return fs.readFileSync(path.join(platformRoot, relativePath), "utf8");
}

function readInstallerManifest(filePath) {
  const installers = [];
  let current = null;
  for (const rawLine of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.startsWith("- Architecture:")) {
      current = { architecture: valueAfterColon(line) };
      installers.push(current);
      continue;
    }
    if (!current) continue;
    if (line.startsWith("InstallerUrl:")) current.installerUrl = valueAfterColon(line);
    if (line.startsWith("InstallerSha256:")) current.installerSha256 = valueAfterColon(line);
    if (line.startsWith("ProductCode:")) current.productCode = valueAfterColon(line).replace(/^"|"$/g, "");
  }
  return { installers };
}

function valueAfterColon(line) {
  return line.slice(line.indexOf(":") + 1).trim();
}
