#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const platformRoot = path.resolve(scriptDir, "../..");
const repoRoot = path.resolve(platformRoot, "../..");
const errors = [];
const warnings = [];

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function exists(relativePath) {
  return fs.existsSync(path.join(repoRoot, relativePath));
}

function requireFile(relativePath) {
  if (!exists(relativePath)) {
    errors.push(`missing required notice/license file: ${relativePath}`);
    return "";
  }
  return read(relativePath);
}

function requireIncludes(relativePath, text, requiredSnippets) {
  for (const snippet of requiredSnippets) {
    if (!text.includes(snippet)) {
      errors.push(`${relativePath} must include ${JSON.stringify(snippet)}`);
    }
  }
}

const flagshipsConfig = JSON.parse(
  requireFile("opensource/open-studio-platform/configs/flagships.json"),
);
const noticePath = "opensource/open-studio-platform/compliance/licensing/NOTICE.template.md";
const noticeTemplate = requireFile(noticePath);

requireIncludes(noticePath, noticeTemplate, [
  "{{PRODUCT_NAME}}",
  "MIT License",
  "CycloneDX SBOM",
  "Node package license report",
  "Python package license report",
  "Rust `cargo-deny` license report",
  "LGPL dynamic linking register",
]);

for (const productName of [
  "Rubric Studio Open",
  "Robotics Studio Open",
  "Agent Studio Open",
]) {
  if (noticeTemplate.includes(`${productName} is licensed`)) {
    errors.push(`${noticePath} must stay product-neutral; found hard-coded ${productName}`);
  }
}

const policyFiles = [
  "opensource/open-studio-platform/compliance/licensing/license-policy.md",
  "opensource/open-studio-platform/compliance/licensing/gpl-lgpl-posture.md",
  "opensource/open-studio-platform/compliance/licensing/lgpl-dynamic-linking-register.md",
  "opensource/open-studio-platform/configs/license/npm-license-policy.json",
];

for (const file of policyFiles) {
  const text = requireFile(file);
  if (file.endsWith("license-policy.md")) {
    requireIncludes(file, text, ["MIT", "Apache-2.0", "GPL", "AGPL"]);
  }
  if (file.endsWith("gpl-lgpl-posture.md")) {
    requireIncludes(file, text, ["GPL", "LGPL", "dynamic"]);
  }
  if (file.endsWith("lgpl-dynamic-linking-register.md")) {
    requireIncludes(file, text, ["Package", "License", "dynamically linked"]);
  }
}

const products = [
  {
    id: "open-studio-platform",
    displayName: "Open Studio Platform",
    path: "opensource/open-studio-platform",
  },
  ...flagshipsConfig.flagships.map((flagship) => ({
    id: flagship.id,
    displayName: flagship.displayName,
    path: `opensource/${flagship.id}`,
  })),
];

for (const product of products) {
  const licensePath = `${product.path}/LICENSE`;
  const licenseText = requireFile(licensePath);
  requireIncludes(licensePath, licenseText, ["MIT License", "Permission is hereby granted"]);

  const packagePath = `${product.path}/package.json`;
  if (exists(packagePath)) {
    const packageJson = JSON.parse(read(packagePath));
    if (packageJson.license && packageJson.license !== "MIT") {
      errors.push(`${packagePath} must keep MIT license metadata; found ${packageJson.license}`);
    }
  }

  const noticePathForProduct = `${product.path}/NOTICE`;
  if (!exists(noticePathForProduct)) {
    warnings.push(`${product.id}: release-specific NOTICE is not present yet; expected at signed GA artifact packaging time`);
  }
}

if (errors.length > 0) {
  for (const error of errors) console.error(error);
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  checkedAt: new Date().toISOString(),
  noticeTemplate: {
    path: noticePath,
    productNeutral: true,
    requiredReleaseInputsDocumented: true,
  },
  policyFiles,
  products: products.map((product) => ({
    id: product.id,
    displayName: product.displayName,
    licensePresent: exists(`${product.path}/LICENSE`),
    releaseSpecificNoticePresent: exists(`${product.path}/NOTICE`),
  })),
  warnings,
}, null, 2));
