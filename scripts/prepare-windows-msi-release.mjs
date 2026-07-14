#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const platformRoot = path.resolve(scriptDir, "..");
const repoRoot = path.resolve(platformRoot, "../..");
const flagshipsConfig = JSON.parse(
  fs.readFileSync(path.join(platformRoot, "configs/flagships.json"), "utf8"),
);

const args = parseArgs(process.argv.slice(2));
const flagshipId = requiredArg("flagship");
const version = requiredArg("version").replace(/^v/, "");
const arch = requiredArg("arch");
const sourceDir = path.resolve(args["source-dir"] ?? "dist");
const outDir = path.resolve(args["out-dir"] ?? "dist/release");
const metadataOut = args["metadata-out"] ? path.resolve(args["metadata-out"]) : null;
const baseUrl = args["base-url"] ?? "";
const explicitProductCode = args["product-code"] ?? "";
const requireSigned = Boolean(args["require-signed"]);

if (!["x64", "arm64"].includes(arch)) {
  fail(`--arch must be x64 or arm64, received ${arch}`);
}

const flagship = flagshipsConfig.flagships.find((item) => item.id === flagshipId);
if (!flagship) {
  fail(`unknown flagship ${flagshipId}`);
}

const artifactTemplate = arch === "x64" ? flagship.windowsX64Artifact : flagship.windowsArm64Artifact;
if (!artifactTemplate) {
  fail(`${flagshipId} does not declare a Windows ${arch} MSI artifact in configs/flagships.json`);
}

const artifactName = artifactTemplate.replaceAll("${VERSION}", version);
const sourcePath = findMsiSource(sourceDir, artifactName, flagship, arch);
const destinationPath = path.join(outDir, artifactName);
fs.mkdirSync(outDir, { recursive: true });

if (path.resolve(sourcePath) !== path.resolve(destinationPath)) {
  fs.copyFileSync(sourcePath, destinationPath);
}

const installerSha256 = sha256File(destinationPath);
const productCodeState = explicitProductCode
  ? { value: normalizeProductCode(explicitProductCode), source: "argument", error: null }
  : extractMsiProductCode(destinationPath);
const signatureState = inspectAuthenticodeSignature(destinationPath);

if (requireSigned && signatureState.status !== "Valid") {
  fail(
    `Authenticode signature is not valid for ${artifactName}: ${
      signatureState.status ?? signatureState.error ?? "unknown status"
    }`,
  );
}

if (!productCodeState.value) {
  fail(
    `ProductCode could not be extracted for ${artifactName}; rerun on Windows or pass --product-code "{GUID}"`,
  );
}

const installerUrl = baseUrl ? `${baseUrl.replace(/\/$/, "")}/${encodeURIComponent(artifactName)}` : null;
const metadata = {
  generatedAt: new Date().toISOString(),
  flagship: flagship.id,
  displayName: flagship.displayName,
  packageIdentifier: flagship.wingetPackageIdentifier,
  version,
  architecture: arch,
  artifactName,
  artifactPath: path.relative(repoRoot, destinationPath),
  installerUrl,
  installerSha256,
  productCode: productCodeState.value,
  productCodeSource: productCodeState.source,
  signature: signatureState,
  wingetManifest: path.join(
    "distribution/winget",
    flagship.wingetPackageIdentifier,
    version,
    `${flagship.wingetPackageIdentifier}.installer.yaml`,
  ),
};

if (metadataOut) {
  fs.mkdirSync(path.dirname(metadataOut), { recursive: true });
  fs.writeFileSync(metadataOut, `${JSON.stringify(metadata, null, 2)}\n`);
}

console.log(JSON.stringify(metadata, null, 2));

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item.startsWith("--")) fail(`unexpected argument ${item}`);
    const key = item.slice(2);
    if (key === "require-signed") {
      parsed[key] = true;
      continue;
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) fail(`missing value for --${key}`);
    parsed[key] = value;
    index += 1;
  }
  return parsed;
}

function requiredArg(name) {
  const value = args[name];
  if (!value) fail(`--${name} is required`);
  return value;
}

function fail(message) {
  console.error(`prepare-windows-msi-release: ${message}`);
  process.exit(1);
}

function findMsiSource(directory, expectedName, flagship, targetArch) {
  if (!fs.existsSync(directory)) fail(`source directory does not exist: ${directory}`);
  const candidates = listFiles(directory).filter((file) => file.toLowerCase().endsWith(".msi"));
  const exact = candidates.find((file) => path.basename(file) === expectedName);
  if (exact) return exact;

  const normalizedProduct = flagship.displayName.toLowerCase().replaceAll(/[^a-z0-9]+/g, "");
  const ranked = candidates.filter((file) => {
    const base = path.basename(file).toLowerCase().replaceAll(/[^a-z0-9]+/g, "");
    return base.includes(normalizedProduct) && base.includes(targetArch.replace("x64", "x64"));
  });
  if (ranked.length === 1) return ranked[0];
  if (candidates.length === 1) return candidates[0];

  fail(
    `could not choose MSI source for ${expectedName}; found ${candidates.length} MSI candidates under ${directory}`,
  );
}

function listFiles(directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...listFiles(absolute));
    } else if (entry.isFile()) {
      files.push(absolute);
    }
  }
  return files;
}

function sha256File(filePath) {
  const hash = createHash("sha256");
  hash.update(fs.readFileSync(filePath));
  return hash.digest("hex");
}

function commandAvailable(command) {
  return spawnSync(process.platform === "win32" ? "where" : "which", [command], {
    stdio: "ignore",
  }).status === 0;
}

function extractMsiProductCode(filePath) {
  if (process.platform !== "win32") {
    return {
      value: null,
      source: "unavailable",
      error: "MSI ProductCode extraction requires Windows Installer COM on Windows",
    };
  }
  if (!commandAvailable("pwsh")) {
    return { value: null, source: "unavailable", error: "pwsh is not installed" };
  }
  const script = [
    '$ErrorActionPreference = "Stop"',
    "$installer = New-Object -ComObject WindowsInstaller.Installer",
    "$db = $installer.OpenDatabase($env:AURAONE_MSI_PATH, 0)",
    "$view = $db.OpenView('SELECT `Value` FROM `Property` WHERE `Property` = ''ProductCode''')",
    "$view.Execute()",
    "$record = $view.Fetch()",
    "if ($null -eq $record) { throw 'ProductCode not found in MSI Property table' }",
    "$record.StringData(1)",
  ].join("; ");
  const result = spawnSync("pwsh", ["-NoProfile", "-Command", script], {
    encoding: "utf8",
    env: { ...process.env, AURAONE_MSI_PATH: filePath },
  });
  if (result.status !== 0) {
    return {
      value: null,
      source: "windows-installer-com",
      error: (result.stderr || result.stdout).trim() || `pwsh exited ${result.status}`,
    };
  }
  return {
    value: normalizeProductCode(result.stdout.trim()),
    source: "windows-installer-com",
    error: null,
  };
}

function inspectAuthenticodeSignature(filePath) {
  if (process.platform !== "win32" || !commandAvailable("pwsh")) {
    return {
      available: false,
      status: null,
      signerCertificateSubject: null,
      timestampCertificateSubject: null,
      error: process.platform === "win32" ? "pwsh is not installed" : "Authenticode inspection requires Windows",
    };
  }
  const script = [
    '$ErrorActionPreference = "Stop"',
    "$signature = Get-AuthenticodeSignature -LiteralPath $env:AURAONE_MSI_PATH",
    "[ordered]@{",
    "Status = [string]$signature.Status",
    "SignerCertificateSubject = if ($signature.SignerCertificate) { $signature.SignerCertificate.Subject } else { $null }",
    "TimestampCertificateSubject = if ($signature.TimeStamperCertificate) { $signature.TimeStamperCertificate.Subject } else { $null }",
    "} | ConvertTo-Json -Compress",
  ].join("; ");
  const result = spawnSync("pwsh", ["-NoProfile", "-Command", script], {
    encoding: "utf8",
    env: { ...process.env, AURAONE_MSI_PATH: filePath },
  });
  if (result.status !== 0) {
    return {
      available: true,
      status: null,
      signerCertificateSubject: null,
      timestampCertificateSubject: null,
      error: (result.stderr || result.stdout).trim() || `pwsh exited ${result.status}`,
    };
  }
  const parsed = JSON.parse(result.stdout);
  return {
    available: true,
    status: parsed.Status,
    signerCertificateSubject: parsed.SignerCertificateSubject,
    timestampCertificateSubject: parsed.TimestampCertificateSubject,
    error: null,
  };
}

function normalizeProductCode(value) {
  const trimmed = value.trim();
  if (/^\{[0-9a-f-]{36}\}$/i.test(trimmed)) return trimmed.toUpperCase();
  if (/^[0-9a-f-]{36}$/i.test(trimmed)) return `{${trimmed.toUpperCase()}}`;
  fail(`ProductCode must be a GUID, received ${value}`);
}
