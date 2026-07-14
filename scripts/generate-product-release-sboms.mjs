#!/usr/bin/env node
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const platformRoot = path.resolve(scriptDir, "..");
const repoRoot = path.resolve(platformRoot, "../..");
const releaseVersion = process.env.AURAONE_RELEASE_VERSION ?? "0.1.0";
const outputDir = path.resolve(
  platformRoot,
  process.env.AURAONE_PRODUCT_SBOM_DIR ?? "dist/sbom",
);

const productManifests = {
  "rubric-studio-open": [
    { kind: "npm", path: "opensource/rubric-studio-open/package.json", role: "desktop-renderer" },
    { kind: "cargo", path: "opensource/rubric-studio-open/src-tauri/Cargo.toml", role: "tauri-core" },
    { kind: "npm", path: "opensource/rubric-studio-open/vscode-extension/package.json", role: "vscode-extension" },
    { kind: "python", path: "opensource/rubric-spec/pyproject.toml", role: "rubric-engine" },
  ],
  "robotics-studio-open": [
    { kind: "npm", path: "opensource/robotics-studio/package.json", role: "desktop-renderer" },
    { kind: "cargo", path: "opensource/robotics-studio/src-tauri/Cargo.toml", role: "tauri-core" },
    { kind: "python", path: "opensource/robostudio-engine/pyproject.toml", role: "robotics-engine" },
  ],
  "agent-studio-open": [
    { kind: "npm", path: "opensource/agent-studio-open/package.json", role: "desktop-renderer" },
    { kind: "cargo", path: "opensource/agent-studio-open/desktop/src-tauri/Cargo.toml", role: "tauri-core" },
    { kind: "python", path: "opensource/agent-studio-open/cli/pyproject.toml", role: "agent-cli" },
    { kind: "npm", path: "opensource/agent-studio-open/vscode/package.json", role: "vscode-extension" },
  ],
};

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(platformRoot, relativePath), "utf8"));
}

function commandOutput(command, args) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 10,
  });
  if (result.status !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} failed: ${result.stderr.trim() || result.stdout.trim()}`,
    );
  }
  return result.stdout;
}

function releaseAssets(repository) {
  const output = commandOutput("gh", [
    "release",
    "view",
    `v${releaseVersion}`,
    "--repo",
    repository,
    "--json",
    "tagName,url,assets",
  ]);
  const release = JSON.parse(output);
  return {
    tagName: release.tagName,
    url: release.url,
    assets: release.assets
      .map((asset) => ({
        name: asset.name,
        url: asset.url,
        size: asset.size,
        contentType: asset.contentType,
        digest: asset.digest,
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}

function parseTomlSection(content, sectionName) {
  const fields = {};
  let inSection = false;
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*/, "").trim();
    if (!line) continue;
    const section = line.match(/^\[([^\]]+)\]$/);
    if (section) {
      inSection = section[1] === sectionName;
      continue;
    }
    if (!inSection) continue;
    const assignment = line.match(/^([A-Za-z0-9_.-]+)\s*=\s*(.+)$/);
    if (!assignment) continue;
    const [, key, rawValue] = assignment;
    const value = rawValue.trim().replace(/^"|"$/g, "");
    if (!value.startsWith("[") && !value.startsWith("{")) {
      fields[key] = value;
    }
  }
  return fields;
}

function parseManifest(entry) {
  const absolutePath = path.join(repoRoot, entry.path);
  const content = fs.readFileSync(absolutePath, "utf8");
  if (entry.kind === "npm") {
    const pkg = JSON.parse(content);
    return {
      ecosystem: "npm",
      type: entry.role.includes("extension") ? "application" : "application",
      name: pkg.name,
      version: pkg.version,
      description: pkg.description,
      license: pkg.license,
      purl: `pkg:npm/${encodePurlName(pkg.name)}@${pkg.version}`,
      manifestPath: entry.path,
      role: entry.role,
      directDependencies: Object.keys({
        ...(pkg.dependencies ?? {}),
        ...(pkg.optionalDependencies ?? {}),
      }).sort(),
    };
  }
  if (entry.kind === "cargo") {
    const pkg = parseTomlSection(content, "package");
    return {
      ecosystem: "cargo",
      type: "application",
      name: pkg.name,
      version: pkg.version,
      description: pkg.description,
      license: pkg.license,
      purl: `pkg:cargo/${encodePurlName(pkg.name)}@${pkg.version}`,
      manifestPath: entry.path,
      role: entry.role,
      directDependencies: directTomlDependencyNames(content),
    };
  }
  if (entry.kind === "python") {
    const project = parseTomlSection(content, "project");
    return {
      ecosystem: "pypi",
      type: "library",
      name: project.name,
      version: project.version,
      description: project.description,
      license: project.license,
      purl: `pkg:pypi/${encodePurlName(project.name)}@${project.version}`,
      manifestPath: entry.path,
      role: entry.role,
      directDependencies: directPyprojectDependencyNames(content),
    };
  }
  throw new Error(`Unsupported manifest kind: ${entry.kind}`);
}

function directTomlDependencyNames(content) {
  const names = [];
  let inDependencies = false;
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*/, "").trim();
    const section = line.match(/^\[([^\]]+)\]$/);
    if (section) {
      inDependencies = section[1] === "dependencies";
      continue;
    }
    if (!inDependencies || !line) continue;
    const match = line.match(/^([A-Za-z0-9_.-]+)\s*=/);
    if (match) names.push(match[1]);
  }
  return names.sort();
}

function directPyprojectDependencyNames(content) {
  const dependencies = [];
  const match = content.match(/dependencies\s*=\s*\[([\s\S]*?)\]/m);
  if (!match) return dependencies;
  for (const item of match[1].split(/,\s*/)) {
    const dependency = item.trim().replace(/^"|"$/g, "");
    if (!dependency) continue;
    dependencies.push(dependency.split(/[<>=~!;\[]/)[0].trim());
  }
  return dependencies.sort();
}

function encodePurlName(name) {
  return String(name).split("/").map(encodeURIComponent).join("/");
}

function componentRef(prefix, value) {
  const digest = createHash("sha256").update(value).digest("hex").slice(0, 16);
  return `${prefix}:${digest}`;
}

function licenseExpression(license) {
  if (!license) return undefined;
  return [{ expression: license }];
}

function releaseAssetComponent(asset, productId) {
  const hashes = [];
  if (asset.digest?.startsWith("sha256:")) {
    hashes.push({ alg: "SHA-256", content: asset.digest.slice("sha256:".length) });
  }
  return {
    type: "file",
    "bom-ref": componentRef("release-asset", `${productId}:${asset.name}`),
    name: asset.name,
    version: releaseVersion,
    hashes,
    properties: [
      { name: "auraone:release-asset:size-bytes", value: String(asset.size ?? "") },
      { name: "auraone:release-asset:content-type", value: asset.contentType ?? "" },
      { name: "auraone:release-asset:url", value: asset.url ?? "" },
    ],
  };
}

function sourceComponent(manifest, productId) {
  return {
    type: manifest.type,
    "bom-ref": componentRef("source-manifest", `${productId}:${manifest.manifestPath}`),
    name: manifest.name,
    version: manifest.version,
    description: manifest.description,
    licenses: licenseExpression(manifest.license),
    purl: manifest.purl,
    properties: [
      { name: "auraone:source-manifest:path", value: manifest.manifestPath },
      { name: "auraone:source-manifest:ecosystem", value: manifest.ecosystem },
      { name: "auraone:source-manifest:role", value: manifest.role },
      {
        name: "auraone:source-manifest:direct-dependencies",
        value: manifest.directDependencies.join(","),
      },
    ],
  };
}

function outputName(product) {
  const prefix = product.displayName.replaceAll(" ", ".");
  return `${prefix}_${releaseVersion}_product.cdx.json`;
}

function makeBom(product) {
  const release = releaseAssets(product.githubRepository);
  const manifests = productManifests[product.id].map(parseManifest);
  const productRef = `pkg:generic/auraone/${product.id}@${releaseVersion}`;
  const sourceComponents = manifests.map((manifest) => sourceComponent(manifest, product.id));
  const assetComponents = release.assets.map((asset) => releaseAssetComponent(asset, product.id));
  const components = [...sourceComponents, ...assetComponents];

  return {
    bomFormat: "CycloneDX",
    specVersion: "1.5",
    serialNumber: `urn:uuid:${randomUUID()}`,
    version: 1,
    metadata: {
      timestamp: new Date().toISOString(),
      tools: [
        {
          vendor: "AuraOne",
          name: "generate-product-release-sboms",
          version: "1.0.0",
        },
      ],
      component: {
        type: "application",
        "bom-ref": productRef,
        name: product.displayName,
        version: releaseVersion,
        purl: productRef,
        properties: [
          { name: "auraone:product-id", value: product.id },
          { name: "auraone:bundle-identifier", value: product.bundleIdentifier },
          { name: "auraone:github-repository", value: product.githubRepository },
          { name: "auraone:github-release-tag", value: release.tagName },
          { name: "auraone:github-release-url", value: release.url },
          {
            name: "auraone:sbom-scope",
            value: "product release evidence: source package manifests and GitHub release assets",
          },
          {
            name: "auraone:dependency-coverage",
            value:
              "direct source manifest dependencies plus release assets; shared transitive platform npm SBOM remains attached separately",
          },
        ],
      },
    },
    components,
    dependencies: [
      {
        ref: productRef,
        dependsOn: components.map((component) => component["bom-ref"]),
      },
    ],
    externalReferences: [
      { type: "distribution", url: release.url },
      { type: "vcs", url: `https://github.com/${product.githubRepository}` },
      { type: "website", url: `https://auraone.ai/open/${product.id}` },
    ],
  };
}

function main() {
  fs.mkdirSync(outputDir, { recursive: true });
  const flagships = readJson("configs/flagships.json").flagships;
  const outputs = [];

  for (const product of flagships) {
    if (!productManifests[product.id]) {
      throw new Error(`No product manifest map configured for ${product.id}`);
    }
    const bom = makeBom(product);
    const fileName = outputName(product);
    const outputPath = path.join(outputDir, fileName);
    fs.writeFileSync(outputPath, `${JSON.stringify(bom, null, 2)}\n`);
    outputs.push({
      product: product.id,
      repository: product.githubRepository,
      fileName,
      outputPath,
      components: bom.components.length,
    });
  }

  console.log(JSON.stringify({ releaseVersion, outputDir, outputs }, null, 2));
}

main();
