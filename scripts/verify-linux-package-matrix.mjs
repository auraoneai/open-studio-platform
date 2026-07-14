#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = fs.existsSync("distribution/linux")
  ? process.cwd()
  : path.resolve(process.cwd(), "opensource/open-studio-platform");

const products = [
  {
    name: "Rubric Studio Open",
    slug: "rubric-studio-open",
    appId: "ai.auraone.rubricstudio.open",
    executable: "rubricstudio",
    homepage: "https://rubric-studio.auraone.ai/",
  },
  {
    name: "Robotics Studio Open",
    slug: "robotics-studio-open",
    appId: "ai.auraone.roboticsstudio",
    executable: "robostudio",
    homepage: "https://robotics-studio.auraone.ai/",
  },
  {
    name: "Agent Studio Open",
    slug: "agent-studio-open",
    appId: "ai.auraone.agentstudio",
    executable: "agentstudio",
    homepage: "https://agentstudio.auraone.ai/",
  },
];

const errors = [];
const targetVersion = "0.2.0";

function readRequired(relativePath) {
  const fullPath = path.join(root, relativePath);
  if (!fs.existsSync(fullPath)) {
    errors.push(`missing ${relativePath}`);
    return "";
  }
  return fs.readFileSync(fullPath, "utf8");
}

for (const product of products) {
  const control = readRequired(`distribution/linux/deb/${product.slug}.control`);
  const desktop = readRequired(`distribution/linux/appimage/${product.slug}.desktop`);
  const metainfo = readRequired(`distribution/linux/appimage/${product.appId}.metainfo.xml`);
  const spec = readRequired(`distribution/linux/rpm/${product.slug}.spec`);

  const checks = [
    [control, `Package: ${product.slug}`, `${product.slug} deb package`],
    [control, `Version: ${targetVersion}`, `${product.slug} deb version`],
    [control, `Homepage: ${product.homepage}`, `${product.slug} deb homepage`],
    [desktop, `Name=${product.name}`, `${product.slug} desktop name`],
    [desktop, `Exec=${product.executable} %U`, `${product.slug} desktop executable`],
    [metainfo, `<id>${product.appId}</id>`, `${product.slug} metainfo id`],
    [metainfo, `<release version="${targetVersion}"`, `${product.slug} staged metainfo version`],
    [metainfo, "No Linux artifact is published or verified.", `${product.slug} staged metainfo disclosure`],
    [metainfo, `<launchable type="desktop-id">${product.slug}.desktop</launchable>`, `${product.slug} launchable`],
    [spec, `Name: ${product.slug}`, `${product.slug} rpm name`],
    [spec, `Version: ${targetVersion}`, `${product.slug} rpm version`],
    [spec, `install -m 0755 ${product.executable}`, `${product.slug} rpm executable`],
  ];

  for (const [text, snippet, label] of checks) {
    if (!text.includes(snippet)) errors.push(`${label} missing "${snippet}"`);
  }
}

const matrix = readRequired("distribution/linux/linux-package-matrix.md");
for (const snippet of ["Rubric Studio Open", "Robotics Studio Open", "Agent Studio Open", "scripts/sign-linux.sh"]) {
  if (!matrix.includes(snippet)) errors.push(`linux package matrix missing "${snippet}"`);
}
for (const snippet of [targetVersion, "historical audit evidence", "must never be substituted"]) {
  if (!matrix.includes(snippet)) errors.push(`linux package matrix missing "${snippet}"`);
}

const readiness = JSON.parse(readRequired("distribution/linux/linux-artifact-readiness.json") || "{}");
if (readiness.version !== targetVersion) {
  errors.push(`linux artifact readiness version must be ${targetVersion}`);
}
if (readiness.evidence_kind !== "staged") {
  errors.push("linux artifact readiness must be marked staged");
}
if (
  !Array.isArray(readiness.archival_release_evidence) ||
  readiness.archival_release_evidence.length !== 3
) {
  errors.push("linux artifact readiness must preserve three archival release-evidence paths");
}

if (errors.length > 0) {
  for (const error of errors) console.error(error);
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  products: products.map((product) => product.slug),
  formats: ["appimage", "deb", "rpm"],
  targetVersion,
  evidenceKind: "staged",
  signingScript: "scripts/sign-linux.sh",
}, null, 2));
