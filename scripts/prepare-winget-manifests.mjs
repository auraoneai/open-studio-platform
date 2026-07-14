#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const platformRoot = path.resolve(scriptDir, "..");
const args = parseArgs(process.argv.slice(2));
const metadataPaths = args.metadata ?? [];
const write = Boolean(args.write);
const requireSigned = Boolean(args["require-signed"]);
const baseUrl = args["base-url"] ?? "";
const usage = "Usage: prepare-winget-manifests.mjs --metadata <file> [--write] [--require-signed]";

if (metadataPaths.length === 0) {
  fail(`at least one --metadata file is required. ${usage}`);
}

const entries = metadataPaths.flatMap((metadataPath) => normalizeMetadata(readJson(metadataPath)));
const updates = [];

for (const entry of entries) {
  validateEntry(entry);
  const manifestPath = path.join(
    platformRoot,
    "distribution/winget",
    entry.packageIdentifier,
    entry.version,
    `${entry.packageIdentifier}.installer.yaml`,
  );
  if (!fs.existsSync(manifestPath)) {
    fail(`winget installer manifest does not exist: ${path.relative(platformRoot, manifestPath)}`);
  }

  const original = fs.readFileSync(manifestPath, "utf8");
  const installerUrl =
    entry.installerUrl ??
    (baseUrl ? `${baseUrl.replace(/\/$/, "")}/${encodeURIComponent(entry.artifactName)}` : null);
  if (!installerUrl) {
    fail(`${entry.packageIdentifier}/${entry.architecture}: installerUrl missing; pass --base-url or include installerUrl in metadata`);
  }

  const patched = patchInstallerManifest(original, {
    packageIdentifier: entry.packageIdentifier,
    architecture: entry.architecture,
    installerUrl,
    installerSha256: entry.installerSha256,
    productCode: entry.productCode,
  });
  const changed = patched !== original;
  if (write && changed) {
    fs.writeFileSync(manifestPath, patched);
  }
  updates.push({
    manifest: path.relative(platformRoot, manifestPath),
    packageIdentifier: entry.packageIdentifier,
    version: entry.version,
    architecture: entry.architecture,
    artifactName: entry.artifactName,
    installerUrl,
    installerSha256: entry.installerSha256,
    productCode: entry.productCode,
    changed,
    written: write && changed,
  });
}

console.log(JSON.stringify({ ok: true, write, requireSigned, updates }, null, 2));

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item.startsWith("--")) fail(`unexpected argument ${item}`);
    const key = item.slice(2);
    if (key === "write" || key === "require-signed") {
      parsed[key] = true;
      continue;
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) fail(`missing value for --${key}`);
    if (key === "metadata") {
      parsed.metadata ??= [];
      parsed.metadata.push(value);
    } else {
      parsed[key] = value;
    }
    index += 1;
  }
  return parsed;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(path.resolve(filePath), "utf8"));
}

function normalizeMetadata(value) {
  if (Array.isArray(value)) return value;
  if (Array.isArray(value.entries)) return value.entries;
  if (Array.isArray(value.installers)) {
    return value.installers.map((installer) => ({
      ...installer,
      packageIdentifier: installer.packageIdentifier ?? value.packageIdentifier,
      version: installer.version ?? value.version,
    }));
  }
  return [value];
}

function validateEntry(entry) {
  for (const key of ["packageIdentifier", "version", "architecture", "installerSha256", "productCode"]) {
    if (!entry[key]) fail(`metadata entry missing ${key}`);
  }
  if (!["x64", "arm64"].includes(entry.architecture)) {
    fail(`${entry.packageIdentifier}: architecture must be x64 or arm64`);
  }
  if (!/^[a-f0-9]{64}$/i.test(entry.installerSha256)) {
    fail(`${entry.packageIdentifier}/${entry.architecture}: InstallerSha256 must be a 64-character SHA-256`);
  }
  if (!/^\{[0-9a-f-]{36}\}$/i.test(entry.productCode)) {
    fail(`${entry.packageIdentifier}/${entry.architecture}: ProductCode must be a braced GUID`);
  }
  if (requireSigned && entry.signature?.status !== "Valid") {
    const status = entry.signature?.status ?? entry.signature?.error ?? "missing signature status";
    fail(`${entry.packageIdentifier}/${entry.architecture}: Authenticode signature must be Valid; received ${status}`);
  }
}

function patchInstallerManifest(text, update) {
  const lines = text.split(/\r?\n/);
  let packageIdentifier = "";
  let activeArchitecture = "";
  let touchedUrl = false;
  let touchedSha = false;
  let touchedProductCode = false;

  const patched = lines.map((line) => {
    const trimmed = line.trim();
    const indentation = line.slice(0, line.length - line.trimStart().length);
    if (trimmed.startsWith("PackageIdentifier:")) {
      packageIdentifier = valueAfterColon(trimmed);
      return line;
    }
    if (trimmed.startsWith("- Architecture:")) {
      activeArchitecture = valueAfterColon(trimmed);
      return line;
    }
    if (packageIdentifier !== update.packageIdentifier || activeArchitecture !== update.architecture) {
      return line;
    }
    if (trimmed.startsWith("InstallerUrl:")) {
      touchedUrl = true;
      return `${indentation}InstallerUrl: ${update.installerUrl}`;
    }
    if (trimmed.startsWith("InstallerSha256:")) {
      touchedSha = true;
      return `${indentation}InstallerSha256: ${update.installerSha256}`;
    }
    if (trimmed.startsWith("ProductCode:")) {
      touchedProductCode = true;
      return `${indentation}ProductCode: "${update.productCode.toUpperCase()}"`;
    }
    return line;
  });

  if (!touchedUrl || !touchedSha || !touchedProductCode) {
    fail(
      `${update.packageIdentifier}/${update.architecture}: manifest did not contain InstallerUrl, InstallerSha256, and ProductCode fields`,
    );
  }
  return patched.join("\n");
}

function valueAfterColon(line) {
  return line.slice(line.indexOf(":") + 1).trim().replace(/^"|"$/g, "");
}

function fail(message) {
  console.error(`prepare-winget-manifests: ${message}`);
  process.exit(1);
}
