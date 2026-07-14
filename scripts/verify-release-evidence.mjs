#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateReleaseEvidence } from "./lib/release-evidence.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const platformRoot = path.resolve(scriptDir, "..");
const evidenceRoot = path.join(platformRoot, "distribution/release-evidence");
const publishable = process.argv.includes("--publishable");
const requireLocalArtifacts = process.argv.includes("--require-local-artifacts");
const json = process.argv.includes("--json");
const requestedManifest = valueAfter("--manifest");
const indexErrors = [];

function valueAfter(flag) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : null;
}

function resolveManifestPaths() {
  if (requestedManifest) {
    return [{ manifestPath: path.resolve(process.cwd(), requestedManifest), indexEntry: null }];
  }
  const index = JSON.parse(fs.readFileSync(path.join(evidenceRoot, "index.json"), "utf8"));
  if (index.$schema !== "https://schemas.auraone.ai/open-studio/release-evidence-index/v1.json") {
    indexErrors.push("release-evidence index has an invalid schema URL");
  }
  if (index.schemaVersion !== "1.0.0") {
    indexErrors.push("release-evidence index schemaVersion must be 1.0.0");
  }
  if (!Array.isArray(index.products) || index.products.length !== 3) {
    indexErrors.push("release-evidence index must contain exactly the three flagship products");
    return [];
  }

  const entries = [];
  const productIds = new Set();
  const manifests = new Set();
  for (const product of index.products) {
    if (productIds.has(product.id)) indexErrors.push(`duplicate index product ${product.id}`);
    productIds.add(product.id);
    if (!product.current || !Array.isArray(product.archive)) {
      indexErrors.push(`${product.id}: index entry requires current and archive records`);
      continue;
    }
    const selected = publishable ? [product.current] : [product.current, ...product.archive];
    for (const entry of selected) {
      if (manifests.has(entry.manifest)) {
        indexErrors.push(`${product.id}: duplicate manifest reference ${entry.manifest}`);
      }
      manifests.add(entry.manifest);
      entries.push({
        manifestPath: path.join(evidenceRoot, entry.manifest),
        indexEntry: { productId: product.id, ...entry },
      });
    }
  }
  return entries;
}

const reports = resolveManifestPaths().map(({ manifestPath, indexEntry }) => {
  const relativePath = path.relative(platformRoot, manifestPath);
  if (!fs.existsSync(manifestPath)) {
    return {
      path: relativePath,
      product: null,
      version: null,
      status: null,
      errors: ["manifest does not exist"],
      blockers: [],
      warnings: [],
      indexEntry,
    };
  }
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  } catch (error) {
    return {
      path: relativePath,
      product: null,
      version: null,
      status: null,
      errors: [`invalid JSON: ${error.message}`],
      blockers: [],
      warnings: [],
      indexEntry,
    };
  }
  const validation = validateReleaseEvidence(manifest, {
    platformRoot,
    publishable,
    requireLocalArtifacts,
  });
  if (indexEntry) {
    if (manifest.product?.id !== indexEntry.productId) {
      validation.errors.push(
        `index product ${indexEntry.productId} does not match manifest product ${manifest.product?.id}`,
      );
    }
    if (manifest.product?.version !== indexEntry.version) {
      validation.errors.push(
        `index version ${indexEntry.version} does not match manifest version ${manifest.product?.version}`,
      );
    }
    if (manifest.evidenceKind !== indexEntry.evidenceKind) {
      validation.errors.push(
        `index evidenceKind ${indexEntry.evidenceKind} does not match manifest evidenceKind ${manifest.evidenceKind}`,
      );
    }
    if (manifest.release?.status !== indexEntry.status) {
      validation.errors.push(
        `index status ${indexEntry.status} does not match manifest release status ${manifest.release?.status}`,
      );
    }
  }
  return {
    path: relativePath,
    product: manifest.product?.id ?? null,
    version: manifest.product?.version ?? null,
    status: manifest.release?.status ?? null,
    evidenceKind: manifest.evidenceKind ?? null,
    indexEntry,
    ...validation,
  };
});

const errors = [
  ...indexErrors.map((error) => `distribution/release-evidence/index.json: ${error}`),
  ...reports.flatMap((report) => report.errors.map((error) => `${report.path}: ${error}`)),
];
const blockers = reports.flatMap((report) =>
  report.blockers.map((blocker) => `${report.path}: ${blocker}`),
);
const result = {
  ok: errors.length === 0 && (!publishable || blockers.length === 0),
  mode: publishable ? "publishable-current" : "catalog",
  schema: "schemas/release-evidence.schema.json",
  reports,
  errors,
  blockers,
};

if (json) {
  console.log(JSON.stringify(result, null, 2));
} else {
  for (const report of reports) {
    console.log(
      `${report.product ?? "unknown"} ${report.version ?? "unknown"}: ${report.status ?? "unknown"} (${report.errors.length} errors, ${report.blockers.length} publish blockers)`,
    );
  }
  for (const error of errors) console.error(`ERROR: ${error}`);
  for (const blocker of blockers) console.error(`BLOCKED: ${blocker}`);
}

process.exit(result.ok ? 0 : publishable && errors.length === 0 ? 2 : 1);
