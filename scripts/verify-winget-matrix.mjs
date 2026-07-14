#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, "..");
const repoRoot = path.resolve(root, "../..");
const live = process.argv.includes("--live");
const evEvidenceEnvName = "AURAONE_WINGET_EV_SIGNATURE_EVIDENCE";
const defaultEvidenceDir = path.join(repoRoot, "docs/evidence/product/winget-submission");
const evEvidencePathValue = process.env[evEvidenceEnvName] ?? "";
const evEvidenceSource = evEvidencePathValue
  ? "env"
  : fs.existsSync(defaultEvidenceDir)
    ? "default"
    : "none";
const evEvidencePath = evEvidencePathValue
  ? path.resolve(
      path.isAbsolute(evEvidencePathValue)
        ? evEvidencePathValue
        : path.join(repoRoot, evEvidencePathValue),
    )
  : fs.existsSync(defaultEvidenceDir)
    ? defaultEvidenceDir
    : "";
const evidenceExtensions = [".md", ".json", ".txt", ".png", ".pdf"];
const textEvidenceExtensions = new Set([".md", ".json", ".txt"]);
const placeholderPattern =
  /\b(TODO|TBD|FIXME|placeholder|pending|not yet|draft only|to be added|example only)\b/i;

const required = [
  "distribution/winget/AuraOne.RubricStudioOpen/0.2.0/AuraOne.RubricStudioOpen.yaml",
  "distribution/winget/AuraOne.RubricStudioOpen/0.2.0/AuraOne.RubricStudioOpen.locale.en-US.yaml",
  "distribution/winget/AuraOne.RubricStudioOpen/0.2.0/AuraOne.RubricStudioOpen.installer.yaml",
  "distribution/winget/AuraOne.RoboticsStudioOpen/0.2.0/AuraOne.RoboticsStudioOpen.yaml",
  "distribution/winget/AuraOne.RoboticsStudioOpen/0.2.0/AuraOne.RoboticsStudioOpen.locale.en-US.yaml",
  "distribution/winget/AuraOne.RoboticsStudioOpen/0.2.0/AuraOne.RoboticsStudioOpen.installer.yaml",
  "distribution/winget/AuraOne.AgentStudioOpen/0.2.0/AuraOne.AgentStudioOpen.yaml",
  "distribution/winget/AuraOne.AgentStudioOpen/0.2.0/AuraOne.AgentStudioOpen.locale.en-US.yaml",
  "distribution/winget/AuraOne.AgentStudioOpen/0.2.0/AuraOne.AgentStudioOpen.installer.yaml",
  "distribution/winget/winget-submission-matrix.md",
];
const archivalRequired = [
  "distribution/winget/AuraOne.RubricStudioOpen/0.1.0/AuraOne.RubricStudioOpen.installer.yaml",
  "distribution/winget/AuraOne.RoboticsStudioOpen/0.1.0/AuraOne.RoboticsStudioOpen.installer.yaml",
  "distribution/winget/AuraOne.AgentStudioOpen/0.1.0/AuraOne.AgentStudioOpen.installer.yaml",
];

const packages = [
  {
    id: "rubric-studio-open",
    packageIdentifier: "AuraOne.RubricStudioOpen",
    version: "0.2.0",
    repository: "auraoneai/rubric-studio-open",
  },
  {
    id: "robotics-studio-open",
    packageIdentifier: "AuraOne.RoboticsStudioOpen",
    version: "0.2.0",
    repository: "auraoneai/robotics-studio-open",
  },
  {
    id: "agent-studio-open",
    packageIdentifier: "AuraOne.AgentStudioOpen",
    version: "0.2.0",
    repository: "auraoneai/agent-studio-open",
  },
];

const errors = [];
for (const relativePath of required) {
  if (!fs.existsSync(path.join(root, relativePath))) errors.push(`missing ${relativePath}`);
}
for (const relativePath of archivalRequired) {
  if (!fs.existsSync(path.join(root, relativePath))) {
    errors.push(`missing historical winget metadata ${relativePath}`);
  }
}

const matrix = fs.existsSync(path.join(root, "distribution/winget/winget-submission-matrix.md"))
  ? fs.readFileSync(path.join(root, "distribution/winget/winget-submission-matrix.md"), "utf8")
  : "";
for (const snippet of ["AuraOne.RubricStudioOpen", "AuraOne.RoboticsStudioOpen", "AuraOne.AgentStudioOpen", "EV-signed"]) {
  if (!matrix.includes(snippet)) errors.push(`winget submission matrix missing "${snippet}"`);
}
for (const snippet of ["0.2.0", "historical", "BLOCKED_UNTIL_SIGNED_MSI_SHA256"]) {
  if (!matrix.includes(snippet)) errors.push(`winget submission matrix missing "${snippet}"`);
}

function commandAvailable(command) {
  return spawnSync("which", [command], { stdio: "ignore" }).status === 0;
}

function ghAssets(repository, version) {
  if (!commandAvailable("gh")) {
    return { available: false, error: "gh command is not installed", assetsByName: new Map() };
  }
  const result = spawnSync(
    "gh",
    ["release", "view", `v${version}`, "--repo", repository, "--json", "assets"],
    { encoding: "utf8", maxBuffer: 1024 * 1024 * 5 },
  );
  if (result.status !== 0) {
    return {
      available: false,
      error: result.stderr.trim() || result.stdout.trim() || `gh exited ${result.status}`,
      assetsByName: new Map(),
    };
  }
  const release = JSON.parse(result.stdout);
  return {
    available: true,
    error: null,
    assetsByName: new Map(release.assets.map((asset) => [asset.name, asset])),
  };
}

function readInstallerManifest(packageIdentifier, version) {
  const filePath = path.join(
    root,
    "distribution/winget",
    packageIdentifier,
    version,
    `${packageIdentifier}.installer.yaml`,
  );
  if (!fs.existsSync(filePath)) return { filePath, installers: [] };
  const text = fs.readFileSync(filePath, "utf8");
  const installers = [];
  let current = null;
  for (const rawLine of text.split(/\r?\n/)) {
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
  return { filePath, installers };
}

function valueAfterColon(line) {
  return line.slice(line.indexOf(":") + 1).trim();
}

function isPlaceholder(value) {
  return /\{\{|PLACEHOLDER|BLOCKED|00000000-0000-0000-0000-0000000/i.test(value ?? "");
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
      reasons.push("text evidence is too short to prove EV signing or winget submission readiness");
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
    extension,
    bytes: stat.size,
    accepted: reasons.length === 0,
    rejectionReasons: reasons,
  };
}

function evEvidenceState(pkg) {
  if (!evEvidencePath || !fs.existsSync(evEvidencePath)) {
    return { present: false, accepted: false, files: [] };
  }
  const stat = fs.statSync(evEvidencePath);
  if (stat.isFile()) {
    const extension = path.extname(evEvidencePath);
    if (!evidenceExtensions.includes(extension)) {
      return {
        present: true,
        accepted: false,
        files: [
          {
            layout: "single-file",
            extension,
            bytes: stat.size,
            accepted: false,
            rejectionReasons: [`unsupported evidence extension ${extension}`],
          },
        ],
      };
    }
    const evidence = validateEvidenceFile(evEvidencePath, extension);
    return {
      present: true,
      accepted: evidence.accepted,
      files: [{ layout: "single-file", ...evidence }],
    };
  }
  if (!stat.isDirectory()) return { present: false, accepted: false, files: [] };

  const bases = [
    {
      layout: "package-identifier/ev-signature",
      base: path.join(evEvidencePath, pkg.packageIdentifier, "ev-signature"),
    },
    {
      layout: "package-identifier/winget-submission",
      base: path.join(evEvidencePath, pkg.packageIdentifier, "winget-submission"),
    },
    { layout: "product-id/ev-signature", base: path.join(evEvidencePath, pkg.id, "ev-signature") },
    {
      layout: "product-id/winget-submission",
      base: path.join(evEvidencePath, pkg.id, "winget-submission"),
    },
    { layout: "global/ev-signature", base: path.join(evEvidencePath, "ev-signature") },
    { layout: "global/winget-submission", base: path.join(evEvidencePath, "winget-submission") },
  ];
  const files = [];
  for (const { layout, base } of bases) {
    for (const extension of evidenceExtensions) {
      const filePath = `${base}${extension}`;
      if (!fs.existsSync(filePath)) continue;
      files.push({ layout, ...validateEvidenceFile(filePath, extension) });
    }
  }
  return {
    present: files.length > 0,
    accepted: files.some((file) => file.accepted),
    files,
  };
}

function releaseAssetName(installerUrl) {
  try {
    return decodeURIComponent(new URL(installerUrl).pathname.split("/").pop() ?? "");
  } catch {
    return "";
  }
}

const packageStates = packages.map((pkg) => {
  const manifest = readInstallerManifest(pkg.packageIdentifier, pkg.version);
  const release = live ? ghAssets(pkg.repository, pkg.version) : null;
  const evEvidence = evEvidenceState(pkg);
  const blockers = [];
  const installers = manifest.installers.map((installer) => {
    const assetName = releaseAssetName(installer.installerUrl);
    const asset = release?.assetsByName.get(assetName);
    const shaPlaceholder = isPlaceholder(installer.installerSha256);
    const productCodePlaceholder = isPlaceholder(installer.productCode);
    const releaseSha = asset?.digest?.startsWith("sha256:") ? asset.digest.slice("sha256:".length) : null;
    const shaMatchesRelease =
      Boolean(releaseSha) &&
      !shaPlaceholder &&
      installer.installerSha256.toLowerCase() === releaseSha.toLowerCase();

    if (shaPlaceholder) blockers.push(`${pkg.packageIdentifier}/${installer.architecture}: InstallerSha256 is a placeholder`);
    if (productCodePlaceholder) blockers.push(`${pkg.packageIdentifier}/${installer.architecture}: ProductCode is a placeholder`);
    if (live && !release?.available) blockers.push(`${pkg.packageIdentifier}: live GitHub release assets unavailable`);
    if (live && release?.available && !asset) blockers.push(`${pkg.packageIdentifier}/${installer.architecture}: MSI release asset is missing`);
    if (live && asset && !shaPlaceholder && !shaMatchesRelease) {
      errors.push(`${pkg.packageIdentifier}/${installer.architecture}: InstallerSha256 does not match GitHub release digest`);
    }

    return {
      architecture: installer.architecture,
      assetName,
      installerUrl: installer.installerUrl,
      shaPlaceholder,
      productCodePlaceholder,
      liveAssetPresent: live ? Boolean(asset) : null,
      shaMatchesRelease: live && asset && !shaPlaceholder ? shaMatchesRelease : null,
    };
  });

  const manifestReady =
    installers.length > 0 &&
    installers.every((installer) => !installer.shaPlaceholder && !installer.productCodePlaceholder);
  const liveAssetsReady = !live || installers.every((installer) => installer.liveAssetPresent && installer.shaMatchesRelease !== false);
  if (!evEvidence.present) {
    blockers.push(`${pkg.packageIdentifier}: EV-signing evidence is missing for winget submission`);
  } else if (!evEvidence.accepted) {
    blockers.push(`${pkg.packageIdentifier}: EV-signing evidence is present but not acceptable for winget submission`);
  }

  return {
    id: pkg.id,
    packageIdentifier: pkg.packageIdentifier,
    version: pkg.version,
    repository: pkg.repository,
    manifestPath: path.relative(root, manifest.filePath),
    manifestReady,
    liveAssetsReady,
    wingetSubmissionReady: manifestReady && liveAssetsReady && evEvidence.accepted,
    evSigningEvidence: {
      present: evEvidence.present,
      accepted: evEvidence.accepted,
      files: evEvidence.files,
    },
    installers,
    blockers,
  };
});

if (errors.length > 0) {
  for (const error of errors) console.error(error);
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  live,
  evidenceDirectory: {
    envName: evEvidenceEnvName,
    configured: Boolean(evEvidencePath),
    source: evEvidenceSource,
    valuePrinted: false,
    acceptedLayouts: [
      "$AURAONE_WINGET_EV_SIGNATURE_EVIDENCE as a single .md|.json|.txt|.png|.pdf evidence file",
      "$AURAONE_WINGET_EV_SIGNATURE_EVIDENCE/<package-identifier>/<ev-signature|winget-submission>.<md|json|txt|png|pdf>",
      "$AURAONE_WINGET_EV_SIGNATURE_EVIDENCE/<product-id>/<ev-signature|winget-submission>.<md|json|txt|png|pdf>",
      "docs/evidence/product/winget-submission/<package-identifier>/<ev-signature|winget-submission>.<md|json|txt|png|pdf>",
      "docs/evidence/product/winget-submission/<product-id>/<ev-signature|winget-submission>.<md|json|txt|png|pdf>",
    ],
  },
  stagedPackages: ["AuraOne.RubricStudioOpen", "AuraOne.RoboticsStudioOpen", "AuraOne.AgentStudioOpen"],
  stagedVersion: "0.2.0",
  archivalVersion: "0.1.0",
  archivalMetadataPreserved: archivalRequired.every((relativePath) =>
    fs.existsSync(path.join(root, relativePath)),
  ),
  finalSubmissionBlockedUntil:
    "EV-signed public MSI artifacts, real ProductCode/SHA256 values, clean Windows install evidence, and winget validation/submission evidence exist",
  packageStates,
  blockers: packageStates.flatMap((state) => state.blockers),
}, null, 2));
