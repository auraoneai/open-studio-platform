#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expectedArtifactName, RELEASE_EVIDENCE_SCHEMA } from "./lib/release-evidence.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const platformRoot = path.resolve(scriptDir, "..");
const version = "0.2.0";
const observedAt = "2026-07-12T23:30:00.000Z";

const products = [
  {
    id: "rubric-studio-open",
    name: "Rubric Studio Open",
    repository: "https://github.com/auraoneai/rubric-studio-open",
    bundleIdentifier: "ai.auraone.rubricstudio.open",
    minimumMacOS: "12.0",
    artifacts: [
      ["macos", "aarch64", "dmg"],
      ["windows", "x64", "msi"],
      ["windows", "arm64", "msi"],
      ["linux", "x64", "appimage"],
      ["linux", "arm64", "appimage"],
      ["linux", "amd64", "deb"],
      ["linux", "arm64", "deb"],
      ["linux", "x86_64", "rpm"],
      ["linux", "aarch64", "rpm"],
    ],
    vscodeUrl: "https://marketplace.visualstudio.com/items?itemName=auraone.rubric-studio",
  },
  {
    id: "agent-studio-open",
    name: "Agent Studio Open",
    repository: "https://github.com/auraoneai/agent-studio-open",
    bundleIdentifier: "ai.auraone.agentstudio",
    minimumMacOS: "12.0",
    artifacts: [
      ["macos", "aarch64", "dmg"],
      ["windows", "x64", "msi"],
      ["linux", "x64", "appimage"],
      ["linux", "amd64", "deb"],
      ["linux", "x86_64", "rpm"],
    ],
    vscodeUrl: "https://marketplace.visualstudio.com/items?itemName=auraone.agent-studio-open",
  },
  {
    id: "robotics-studio-open",
    name: "Robotics Studio Open",
    repository: "https://github.com/auraoneai/robotics-studio-open",
    bundleIdentifier: "ai.auraone.roboticsstudio",
    minimumMacOS: "12.0",
    artifacts: [
      ["macos", "aarch64", "dmg"],
      ["windows", "x64", "msi"],
      ["windows", "arm64", "msi"],
      ["linux", "x64", "appimage"],
      ["linux", "arm64", "appimage"],
      ["linux", "amd64", "deb"],
      ["linux", "arm64", "deb"],
      ["linux", "x86_64", "rpm"],
      ["linux", "aarch64", "rpm"],
    ],
    vscodeUrl: null,
  },
];

function artifactId(platform, architecture, type) {
  return `${platform}-${architecture.replace("_", "-")}-${type}`;
}

function minimumOS(platform, product) {
  if (platform === "macos") return `macOS ${product.minimumMacOS}`;
  if (platform === "windows") return "Windows 10 1809";
  return "Supported Linux distribution with WebKitGTK 4.1 runtime dependencies";
}

function artifactBlockers(platform) {
  if (platform === "macos") {
    return [
      "Build the DMG from the exact pushed release commit.",
      "Record the SHA-256 digest and byte size.",
      "Verify Developer ID signing, notarization, stapling, Gatekeeper, clean install, launch, update, and rollback.",
    ];
  }
  if (platform === "windows") {
    return [
      "Build the MSI from the exact pushed release commit.",
      "Record the SHA-256 digest, WiX ProductCode, byte size, and public release URL.",
      "Verify trusted Authenticode signing, timestamping, clean install, launch, update, uninstall, and winget validation.",
    ];
  }
  return [
    "Build the package from the exact pushed release commit.",
    "Record the SHA-256 digest, byte size, public release URL, and detached GPG signature.",
    "Verify the release-key fingerprint, package-repository metadata, clean install, launch, update, uninstall, and rollback.",
  ];
}

function plannedArtifactUrl(product, name) {
  return `${product.repository}/releases/download/v${version}/${name}`;
}

function makeArtifact(product, [platform, architecture, type]) {
  const identity = { id: product.id, version };
  const name = expectedArtifactName(identity, platform, architecture, type);
  if (!name) {
    throw new Error(`No deterministic artifact name for ${product.id}/${platform}/${architecture}/${type}`);
  }
  return {
    id: artifactId(platform, architecture, type),
    platform,
    architecture,
    type,
    name,
    status: "blocked",
    url: null,
    plannedUrl: plannedArtifactUrl(product, name),
    sha256: null,
    sizeBytes: null,
    minimumOS: minimumOS(platform, product),
    localPath: null,
    signing: {
      status: "blocked",
      identity: null,
      notarized: null,
      stapled: null,
      gatekeeper: null,
      authenticode: null,
      gpgSignatureUrl: null,
    },
    evidence: [
      `Staged ${version} artifact name and target architecture are recorded in the distribution metadata.`,
    ],
    blockers: artifactBlockers(platform),
  };
}

function makeChannel(id, plannedUrl, product, blockers, evidence = []) {
  return {
    id,
    status: "blocked",
    url: null,
    plannedUrl,
    version,
    evidence,
    blockers,
  };
}

function makeManifest(product) {
  const githubReleaseUrl = `${product.repository}/releases/tag/v${version}`;
  const updaterUrl = `https://updates.auraone.ai/${product.id}/stable/latest.json`;
  const wingetIdentifier = {
    "rubric-studio-open": "AuraOne.RubricStudioOpen",
    "agent-studio-open": "AuraOne.AgentStudioOpen",
    "robotics-studio-open": "AuraOne.RoboticsStudioOpen",
  }[product.id];
  const homebrewCask = product.id;
  const channels = [
    makeChannel(
      "github-release",
      githubReleaseUrl,
      product,
      [
        "Create the immutable v0.2.0 tag from the exact pushed release commit.",
        "Attach signed artifacts, checksums, signatures, SBOMs, provenance, and the final release-evidence manifest.",
      ],
      ["The immutable tag and artifact naming plan are recorded; no live release is claimed."],
    ),
    makeChannel(
      "homebrew",
      `https://github.com/auraoneai/homebrew-open/blob/main/Casks/${homebrewCask}.rb`,
      product,
      [
        "Replace the blocked cask URL and checksum fields from verified 0.2.0 DMG evidence.",
        "Run brew style, audit, install, launch, uninstall, and upgrade verification against the published tap.",
      ],
      [`distribution/homebrew/Casks/${homebrewCask}.rb is a deliberately unpublishable 0.2.0 template.`],
    ),
    makeChannel(
      "winget",
      `https://github.com/microsoft/winget-pkgs/tree/master/manifests/a/AuraOne/${wingetIdentifier}/${version}`,
      product,
      [
        "Replace blocked InstallerSha256 and ProductCode fields using signed MSI metadata.",
        "Attach publisher identity, Authenticode, clean-install, winget validation, submission, and acceptance evidence.",
      ],
      [`distribution/winget/${wingetIdentifier}/${version} contains staged blocked manifests.`],
    ),
    makeChannel(
      "linux",
      githubReleaseUrl,
      product,
      [
        "Publish the complete AppImage, deb, and rpm matrix with per-artifact checksums and detached signatures.",
        "Attach repository metadata, clean install, update, uninstall, and release-key verification evidence.",
      ],
      ["The Linux package metadata is aligned to 0.2.0; no Linux artifact is claimed."],
    ),
    product.vscodeUrl
      ? makeChannel(
          "vscode",
          product.vscodeUrl,
          product,
          [
            "Build the VSIX from the exact pushed release commit.",
            "Verify package contents, publisher identity, clean install, upgrade, activation, and Marketplace version.",
          ],
          ["The target Marketplace identity is recorded; no 0.2.0 listing is claimed."],
        )
      : {
          id: "vscode",
          status: "not-applicable",
          url: null,
          plannedUrl: null,
          version: null,
          evidence: [],
          blockers: [
            "Robotics Studio Open does not ship a supported VS Code extension in this release train.",
          ],
        },
    makeChannel(
      "updater",
      updaterUrl,
      product,
      [
        "Generate the updater manifest only after every referenced bundle has verified checksum and updater signature evidence.",
        "Sign the manifest, publish it atomically, and verify update, failure retention, rollback, and kill-switch behavior.",
      ],
      ["The stable updater endpoint is planned; no signed 0.2.0 manifest is checked in or live."],
    ),
  ];

  return {
    $schema: RELEASE_EVIDENCE_SCHEMA,
    schemaVersion: "1.0.0",
    evidenceKind: "staged",
    product: {
      id: product.id,
      name: product.name,
      repository: product.repository,
      bundleIdentifier: product.bundleIdentifier,
      version,
      sourceCommit: null,
      license: "MIT",
    },
    release: {
      channel: "stable",
      status: "blocked",
      releasedAt: null,
      verifiedAt: observedAt,
      releaseUrl: null,
      plannedReleaseUrl: githubReleaseUrl,
      notes:
        "Staged 0.2.0 distribution evidence for the Proofline UI/UX release. It records target names, channels, and verification requirements without claiming publication.",
    },
    artifacts: product.artifacts.map((artifact) => makeArtifact(product, artifact)),
    channels,
    updater: {
      status: "blocked",
      manifestUrl: null,
      plannedManifestUrl: updaterUrl,
      checkedInManifest: null,
      signatureAlgorithm: "ed25519",
      blockers: [
        "No signed 0.2.0 updater manifest or verified updater bundle exists.",
        "The exact pushed source commit, updater signing custody, update-from-0.1.0 smoke, failure retention, rollback, and kill-switch evidence are required.",
      ],
    },
    rollback: {
      owner: "AuraOne Open release owner",
      instructions: "distribution/operations/INSTALL_UPDATE_ROLLBACK.md",
      lastVerifiedVersion: null,
    },
    securityPolicy: `${product.repository}/security/policy`,
    support: "Community support through the public repository; no response-time SLA.",
    blockers: [
      "Record one exact pushed source commit containing the 0.2.0 UI/UX and release metadata.",
      "Build every supported artifact from that commit and attach checksums, signatures, SBOMs, provenance, and platform verification.",
      "Verify clean install, launch, update, uninstall, rollback, and accessibility on the supported platform matrix.",
      "Publish downstream channels only after this staged evidence is replaced by a release evidence record with independently verified live URLs.",
    ],
  };
}

for (const product of products) {
  const outputPath = path.join(
    platformRoot,
    "distribution",
    "release-evidence",
    product.id,
    `${version}.json`,
  );
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, `${JSON.stringify(makeManifest(product), null, 2)}\n`);
  console.log(path.relative(platformRoot, outputPath));
}
