#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const platformRoot = path.resolve(scriptDir, "..");
const root = path.resolve(platformRoot, "../..");
const textEvidenceExtensions = new Set([".md", ".json", ".txt"]);
const evidenceExtensions = [".md", ".json", ".txt", ".png", ".pdf"];
const placeholderPattern =
  /\b(TODO|TBD|FIXME|placeholder|pending|not yet|draft only|to be added|example only)\b/i;
const windowsSigningCustodyEvidenceEnvName = "AURAONE_WINDOWS_SIGNING_CUSTODY_EVIDENCE_DIR";
const defaultWindowsSigningCustodyEvidenceDir = path.join(
  root,
  "docs/evidence/product/windows-signing-custody",
);
const windowsSigningCustodyEvidenceDirValue =
  process.env[windowsSigningCustodyEvidenceEnvName] ?? "";
const windowsSigningCustodyEvidenceDirSource = windowsSigningCustodyEvidenceDirValue
  ? "env"
  : fs.existsSync(defaultWindowsSigningCustodyEvidenceDir)
    ? "default"
    : "none";
const windowsSigningCustodyEvidenceDir = windowsSigningCustodyEvidenceDirValue
  ? path.resolve(
      path.isAbsolute(windowsSigningCustodyEvidenceDirValue)
        ? windowsSigningCustodyEvidenceDirValue
        : path.join(root, windowsSigningCustodyEvidenceDirValue),
    )
  : fs.existsSync(defaultWindowsSigningCustodyEvidenceDir)
    ? defaultWindowsSigningCustodyEvidenceDir
    : "";
const windowsSigningCustodyRequirements = [
  {
    key: "custody-attestation",
    name: "Windows EV/PFX/HSM or managed signing custody attestation",
    requiredEvidence: [
      "Non-secret certificate or managed signing account evidence",
      "Custody model: EV token/HSM, PFX escrow, or Azure Artifact/Trusted Signing",
      "Named owner, backup owner, review timestamp, and expiry or rotation date",
    ],
  },
  {
    key: "release-environment-binding",
    name: "Protected release environment and secret binding",
    requiredEvidence: [
      "GitHub release environment protection screenshot or JSON export",
      "Required Windows signing secret names or managed provider secret names",
      "Reviewer policy or two-person approval record for signing sessions",
    ],
  },
  {
    key: "signing-provider-verification",
    name: "Signing provider verification and dry-run proof",
    requiredEvidence: [
      "Credential-safe wrapper invocation or provider configuration check",
      "signtool or managed signing provider version/output",
      "Evidence that no private key, PFX, PIN, token, or password is printed",
    ],
  },
];

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(platformRoot, relativePath), "utf8"));
}

function commandAvailable(command) {
  return spawnSync("which", [command], { stdio: "ignore" }).status === 0;
}

function envPresence(names) {
  return Object.fromEntries(names.map((name) => [name, Boolean(process.env[name])]));
}

function fileState(relativePath) {
  const absolutePath = path.join(platformRoot, relativePath);
  return {
    path: relativePath,
    present: fs.existsSync(absolutePath),
    executable: fs.existsSync(absolutePath) && (fs.statSync(absolutePath).mode & 0o111) !== 0,
  };
}

function validateEvidenceFile(filePath, extension, minimumTextLength = 120) {
  const stat = fs.statSync(filePath);
  const reasons = [];
  if (stat.size === 0) {
    reasons.push("file is empty");
  }
  if (textEvidenceExtensions.has(extension)) {
    const text = fs.readFileSync(filePath, "utf8");
    if (text.trim().length < minimumTextLength) {
      reasons.push("text evidence is too short to prove Windows signing custody");
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

function windowsSigningCustodyEvidenceState(key) {
  if (!windowsSigningCustodyEvidenceDir || !fs.existsSync(windowsSigningCustodyEvidenceDir)) {
    return { present: false, accepted: false, files: [] };
  }
  const bases = [
    { layout: "root", base: path.join(windowsSigningCustodyEvidenceDir, key) },
    { layout: "windows", base: path.join(windowsSigningCustodyEvidenceDir, "windows", key) },
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

function listGitHubNames(repository, kind) {
  if (!commandAvailable("gh")) {
    return {
      repository,
      kind,
      accessible: false,
      names: [],
      error: "gh command is not installed",
    };
  }
  const jq = kind === "secrets" ? ".secrets[].name" : ".variables[].name";
  const result = spawnSync(
    "gh",
    ["api", `repos/${repository}/actions/${kind}`, "--jq", jq],
    { cwd: root, encoding: "utf8", maxBuffer: 1024 * 1024 },
  );
  if (result.status !== 0) {
    return {
      repository,
      kind,
      accessible: false,
      names: [],
      error: (result.stderr || result.stdout).trim() || `gh api exited ${result.status}`,
    };
  }
  const names = result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .sort();
  return {
    repository,
    kind,
    accessible: true,
    names,
    error: null,
  };
}

function listGitHubOrgNames(org, kind) {
  if (!commandAvailable("gh")) {
    return {
      org,
      kind,
      accessible: false,
      names: [],
      entries: [],
      error: "gh command is not installed",
    };
  }
  const result = spawnSync(
    "gh",
    ["api", `orgs/${org}/actions/${kind}`],
    { cwd: root, encoding: "utf8", maxBuffer: 1024 * 1024 },
  );
  if (result.status !== 0) {
    return {
      org,
      kind,
      accessible: false,
      names: [],
      entries: [],
      error: (result.stderr || result.stdout).trim() || `gh api exited ${result.status}`,
    };
  }
  let parsed;
  try {
    parsed = JSON.parse(result.stdout);
  } catch (error) {
    return {
      org,
      kind,
      accessible: false,
      names: [],
      entries: [],
      error: `could not parse org ${kind}: ${error.message}`,
    };
  }
  const rawEntries = Array.isArray(parsed[kind]) ? parsed[kind] : [];
  const entries = rawEntries.map((entry) => ({
    name: entry.name,
    visibility: entry.visibility ?? "unknown",
    selectedRepositoriesUrl: entry.selected_repositories_url ?? null,
    selectedRepositoriesAccessible: entry.visibility !== "selected",
    selectedRepositories: [],
    error: null,
  }));
  for (const entry of entries) {
    if (entry.visibility !== "selected" || !entry.selectedRepositoriesUrl) continue;
    const selectedResult = spawnSync(
      "gh",
      ["api", entry.selectedRepositoriesUrl, "--jq", ".repositories[].full_name"],
      { cwd: root, encoding: "utf8", maxBuffer: 1024 * 1024 },
    );
    if (selectedResult.status !== 0) {
      entry.selectedRepositoriesAccessible = false;
      entry.error =
        (selectedResult.stderr || selectedResult.stdout).trim() ||
        `gh api exited ${selectedResult.status}`;
      continue;
    }
    entry.selectedRepositoriesAccessible = true;
    entry.selectedRepositories = selectedResult.stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .sort();
  }
  return {
    org,
    kind,
    accessible: true,
    names: entries.map((entry) => entry.name).filter(Boolean).sort(),
    entries,
    error: null,
  };
}

function listGitHubEnvironments(repository) {
  if (!commandAvailable("gh")) {
    return {
      repository,
      accessible: false,
      names: [],
      error: "gh command is not installed",
    };
  }
  const result = spawnSync(
    "gh",
    ["api", `repos/${repository}/environments`, "--jq", ".environments[].name"],
    { cwd: root, encoding: "utf8", maxBuffer: 1024 * 1024 },
  );
  if (result.status !== 0) {
    return {
      repository,
      accessible: false,
      names: [],
      error: (result.stderr || result.stdout).trim() || `gh api exited ${result.status}`,
    };
  }
  const names = result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .sort();
  return {
    repository,
    accessible: true,
    names,
    error: null,
  };
}

function orgNameAppliesToRepository(entry, repository) {
  if (!entry?.name) return false;
  if (entry.visibility === "all") return true;
  if (entry.visibility === "private") return false;
  if (entry.visibility === "selected") {
    return entry.selectedRepositoriesAccessible && entry.selectedRepositories.includes(repository);
  }
  return false;
}

function runJsonVerifier(relativePath) {
  const result = spawnSync(
    "node",
    [path.join(platformRoot, relativePath)],
    { cwd: platformRoot, encoding: "utf8", maxBuffer: 1024 * 1024 * 8 },
  );
  if (result.status !== 0) {
    return {
      path: relativePath,
      available: false,
      report: null,
      error: (result.stderr || result.stdout).trim() || `node exited ${result.status}`,
    };
  }
  try {
    return {
      path: relativePath,
      available: true,
      report: JSON.parse(result.stdout),
      error: null,
    };
  } catch (error) {
    return {
      path: relativePath,
      available: false,
      report: null,
      error: `could not parse verifier JSON: ${error.message}`,
    };
  }
}

function secretKeyStatus(expectedFingerprint, configuredKeyId, homedir) {
  const status = {
    gpgAvailable: commandAvailable("gpg"),
    configuredKeyIdPresent: Boolean(configuredKeyId),
    homedirConfigured: Boolean(homedir),
    homedirPresent: Boolean(homedir && fs.existsSync(homedir)),
    expectedFingerprint,
    expectedSecretKeyPresent: false,
    configuredSecretKeyPresent: false,
  };
  if (!status.gpgAvailable) return status;

  const args = ["--batch"];
  if (homedir) args.push("--homedir", homedir);
  args.push("--list-secret-keys", "--with-colons");
  const result = spawnSync(
    "gpg",
    args,
    { encoding: "utf8", maxBuffer: 1024 * 1024 },
  );
  if (result.status !== 0) return status;

  const fingerprints = result.stdout
    .split(/\r?\n/)
    .filter((line) => line.startsWith("fpr:"))
    .map((line) => line.split(":")[9])
    .filter(Boolean);
  status.expectedSecretKeyPresent = fingerprints.includes(expectedFingerprint);
  if (configuredKeyId) {
    status.configuredSecretKeyPresent = fingerprints.some((fingerprint) =>
      fingerprint.includes(configuredKeyId.replaceAll(/\s/g, "")),
    );
  }
  return status;
}

const flagshipsConfig = readJson("configs/flagships.json");
const flagships = flagshipsConfig.flagships;
const repositories = [
  "gchahal1982/AuraFoundry",
  ...flagships.map((flagship) => flagship.githubRepository),
];

const requiredHostedSecrets = [
  "AURAONE_MACOS_SIGNING_IDENTITY",
  "AURAONE_NOTARY_KEY_P8",
  "AURAONE_NOTARY_KEY_ID",
  "AURAONE_NOTARY_ISSUER_ID",
  "AURAONE_APPLE_ID",
  "AURAONE_APPLE_TEAM_ID",
  "AURAONE_APPLE_APP_PASSWORD",
  "AURAONE_WINDOWS_CERT_THUMBPRINT",
  "AURAONE_WINDOWS_PFX_PATH",
  "AURAONE_WINDOWS_PFX_PASSWORD",
  "AURAONE_WINDOWS_SIGNING_PROVIDER",
  "AURAONE_ARTIFACT_SIGNING_DLIB_PATH",
  "AURAONE_ARTIFACT_SIGNING_METADATA_PATH",
  "AURAONE_ARTIFACT_SIGNING_ENDPOINT",
  "AURAONE_ARTIFACT_SIGNING_ACCOUNT_NAME",
  "AURAONE_ARTIFACT_SIGNING_CERTIFICATE_PROFILE_NAME",
  "AURAONE_GPG_KEY_ID",
  "AURAONE_RELEASE_GPG_PRIVATE_KEY",
  "AURAONE_UPDATE_SIGNING_KEY_PEM",
  "CLOUDFLARE_API_TOKEN",
  "CLOUDFLARE_ACCOUNT_ID",
  "AURAONE_R2_BUCKET",
  "CLOUDFLARE_R2_BUCKET",
  "AURAONE_RELEASE_BOT_TOKEN",
];
const hostedSecretRequirements = [
  {
    id: "macos-signing-identity",
    description: "macOS Developer ID signing identity name",
    alternatives: [["AURAONE_MACOS_SIGNING_IDENTITY"]],
  },
  {
    id: "apple-notarization-auth",
    description: "Apple notarization credentials",
    alternatives: [
      ["AURAONE_NOTARY_KEY_P8", "AURAONE_NOTARY_KEY_ID", "AURAONE_NOTARY_ISSUER_ID"],
      ["AURAONE_NOTARY_KEYCHAIN_PROFILE"],
      ["AURAONE_APPLE_ID", "AURAONE_APPLE_TEAM_ID", "AURAONE_APPLE_APP_PASSWORD"],
    ],
  },
  {
    id: "windows-signing-custody",
    description: "Windows EV, PFX, or managed Artifact Signing custody",
    alternatives: [
      ["AURAONE_WINDOWS_CERT_THUMBPRINT"],
      ["AURAONE_WINDOWS_PFX_PATH", "AURAONE_WINDOWS_PFX_PASSWORD"],
      [
        "AURAONE_WINDOWS_SIGNING_PROVIDER",
        "AURAONE_ARTIFACT_SIGNING_DLIB_PATH",
        "AURAONE_ARTIFACT_SIGNING_ENDPOINT",
        "AURAONE_ARTIFACT_SIGNING_ACCOUNT_NAME",
        "AURAONE_ARTIFACT_SIGNING_CERTIFICATE_PROFILE_NAME",
      ],
      [
        "AURAONE_WINDOWS_SIGNING_PROVIDER",
        "AURAONE_ARTIFACT_SIGNING_DLIB_PATH",
        "AURAONE_ARTIFACT_SIGNING_METADATA_PATH",
      ],
    ],
  },
  {
    id: "linux-release-signing-custody",
    description: "Linux release GPG signing custody",
    alternatives: [["AURAONE_GPG_KEY_ID", "AURAONE_RELEASE_GPG_PRIVATE_KEY"]],
  },
  {
    id: "updater-signing-custody",
    description: "Tauri updater manifest signing custody",
    alternatives: [["AURAONE_UPDATE_SIGNING_KEY_PEM"]],
  },
  {
    id: "cloudflare-release-publish",
    description: "Cloudflare release publishing credentials",
    alternatives: [["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID"]],
  },
  {
    id: "release-r2-bucket",
    description: "Release update bucket name",
    alternatives: [["AURAONE_R2_BUCKET"], ["CLOUDFLARE_R2_BUCKET"]],
  },
  {
    id: "release-bot-token",
    description: "Release bot token for cross-repo release automation",
    alternatives: [["AURAONE_RELEASE_BOT_TOKEN"]],
  },
];
const requiredHostedVariables = [
  "AURAONE_FLAGSHIP_ID",
  "AURAONE_WINGET_ID",
];
const requiredHostedEnvironments = new Map([
  ["gchahal1982/AuraFoundry", ["agent-studio-open-release", "rubric-studio-open-release"]],
  ["auraoneai/robotics-studio-open", ["release"]],
]);
const windowsEnvNames = [
  "AURAONE_WINDOWS_CERT_THUMBPRINT",
  "WINDOWS_EV_CERT_THUMBPRINT",
  "AURAONE_WINDOWS_PFX_PATH",
  "AURAONE_WINDOWS_PFX_PASSWORD",
  "AURAONE_WINDOWS_SIGNING_PROVIDER",
  "AURAONE_ARTIFACT_SIGNING_DLIB_PATH",
  "AURAONE_ARTIFACT_SIGNING_METADATA_PATH",
  "AURAONE_ARTIFACT_SIGNING_ENDPOINT",
  "AURAONE_ARTIFACT_SIGNING_ACCOUNT_NAME",
  "AURAONE_ARTIFACT_SIGNING_CERTIFICATE_PROFILE_NAME",
  "WINDOWS_SIGNING_PROVIDER",
  "AURAONE_TRUSTED_SIGNING_DLIB_PATH",
  "AURAONE_TRUSTED_SIGNING_METADATA_PATH",
  "AURAONE_TRUSTED_SIGNING_ENDPOINT",
  "AURAONE_TRUSTED_SIGNING_ACCOUNT_NAME",
  "AURAONE_TRUSTED_SIGNING_CERTIFICATE_PROFILE_NAME",
];
const linuxEnvNames = [
  "AURAONE_GPG_KEY_ID",
  "AURAONE_GPG_HOMEDIR",
  "AURAONE_RELEASE_GPG_FINGERPRINT",
  "GPG_SIGNING_KEY",
  "AURAONE_RELEASE_GPG_PRIVATE_KEY",
];
const macHostedEnvNames = [
  "AURAONE_MACOS_SIGNING_IDENTITY",
  "AURAONE_NOTARY_KEYCHAIN_PROFILE",
  "AURAONE_NOTARY_KEY_P8",
  "AURAONE_NOTARY_KEY_PATH",
  "AURAONE_NOTARY_KEY_ID",
  "AURAONE_NOTARY_ISSUER_ID",
  "AURAONE_APPLE_ID",
  "AURAONE_APPLE_TEAM_ID",
  "AURAONE_APPLE_APP_PASSWORD",
  "APPLE_API_KEY_PATH",
  "APPLE_API_KEY",
  "APPLE_API_ISSUER",
];
const hostedEnvNames = [
  "AURAONE_UPDATE_SIGNING_KEY_PEM",
  "CLOUDFLARE_API_TOKEN",
  "CLOUDFLARE_ACCOUNT_ID",
  "AURAONE_R2_BUCKET",
  "CLOUDFLARE_R2_BUCKET",
  "AURAONE_RELEASE_BOT_TOKEN",
];

const githubSecretStates = repositories.map((repository) => listGitHubNames(repository, "secrets"));
const githubVariableStates = repositories.map((repository) => listGitHubNames(repository, "variables"));
const orgs = [
  ...new Set(
    repositories
      .map((repository) => repository.split("/")[0])
      .filter((owner) => owner !== "gchahal1982"),
  ),
];
const githubOrgSecretStates = orgs.map((org) => listGitHubOrgNames(org, "secrets"));
const githubOrgVariableStates = orgs.map((org) => listGitHubOrgNames(org, "variables"));
const githubEnvironmentStates = repositories.map((repository) => listGitHubEnvironments(repository));
const repositoryReadiness = repositories.map((repository) => {
  const secretState = githubSecretStates.find((state) => state.repository === repository);
  const variableState = githubVariableStates.find((state) => state.repository === repository);
  const environmentState = githubEnvironmentStates.find((state) => state.repository === repository);
  const org = repository.split("/")[0];
  const orgSecretState = githubOrgSecretStates.find((state) => state.org === org);
  const orgVariableState = githubOrgVariableStates.find((state) => state.org === org);
  const repoSecretNames = secretState?.names ?? [];
  const repoVariableNames = variableState?.names ?? [];
  const applicableOrgSecretNames = (orgSecretState?.entries ?? [])
    .filter((entry) => orgNameAppliesToRepository(entry, repository))
    .map((entry) => entry.name);
  const applicableOrgVariableNames = (orgVariableState?.entries ?? [])
    .filter((entry) => orgNameAppliesToRepository(entry, repository))
    .map((entry) => entry.name);
  const secretNames = new Set([...repoSecretNames, ...applicableOrgSecretNames]);
  const variableNames = new Set([...repoVariableNames, ...applicableOrgVariableNames]);
  const environmentNames = new Set(environmentState?.names ?? []);
  const requiredVariablesForRepository = repository === "gchahal1982/AuraFoundry"
    ? []
    : requiredHostedVariables;
  const requiredEnvironmentsForRepository = requiredHostedEnvironments.get(repository) ?? [];
  const missingSecretRequirements = hostedSecretRequirements
    .map((requirement) => {
      const satisfiedBy = requirement.alternatives.find((alternative) =>
        alternative.every((name) => secretNames.has(name)),
      );
      const bestAlternative = requirement.alternatives
        .map((alternative) => ({
          alternative,
          missingNames: alternative.filter((name) => !secretNames.has(name)),
        }))
        .sort((left, right) => left.missingNames.length - right.missingNames.length)[0];
      return satisfiedBy
        ? null
        : {
            id: requirement.id,
            description: requirement.description,
            acceptedAlternatives: requirement.alternatives,
            missingNames: bestAlternative?.missingNames ?? [],
          };
    })
    .filter(Boolean);
  return {
    repository,
    secretSources: {
      repositorySecrets: repoSecretNames,
      applicableOrgSecrets: applicableOrgSecretNames,
      orgSecretsAccessible: orgSecretState?.accessible ?? false,
      orgSecretsError: orgSecretState?.error ?? null,
    },
    variableSources: {
      repositoryVariables: repoVariableNames,
      applicableOrgVariables: applicableOrgVariableNames,
      orgVariablesAccessible: orgVariableState?.accessible ?? false,
      orgVariablesError: orgVariableState?.error ?? null,
    },
    missingSecrets: [...new Set(missingSecretRequirements.flatMap((requirement) => requirement.missingNames))],
    missingSecretRequirements,
    missingVariables: requiredVariablesForRepository.filter((name) => !variableNames.has(name)),
    missingEnvironments: requiredEnvironmentsForRepository.filter((name) => !environmentNames.has(name)),
  };
});

const localWindowsEnv = envPresence(windowsEnvNames);
const localLinuxEnv = envPresence(linuxEnvNames);
const localMacHostedEnv = envPresence(macHostedEnvNames);
const localHostedEnv = envPresence(hostedEnvNames);
const windowsPfxPath = process.env.AURAONE_WINDOWS_PFX_PATH ?? "";
const windowsPfxPathExists = Boolean(windowsPfxPath && fs.existsSync(path.resolve(windowsPfxPath)));
const windowsSigningProvider = (
  process.env.AURAONE_WINDOWS_SIGNING_PROVIDER ||
  process.env.WINDOWS_SIGNING_PROVIDER ||
  ""
).trim().toLowerCase();
const artifactSigningProvider = [
  "azure-artifact-signing",
  "artifact-signing",
  "azure-trusted-signing",
  "trusted-signing",
].includes(windowsSigningProvider);
const artifactSigningDlibPath =
  process.env.AURAONE_ARTIFACT_SIGNING_DLIB_PATH ||
  process.env.AURAONE_TRUSTED_SIGNING_DLIB_PATH ||
  "";
const artifactSigningMetadataPath =
  process.env.AURAONE_ARTIFACT_SIGNING_METADATA_PATH ||
  process.env.AURAONE_TRUSTED_SIGNING_METADATA_PATH ||
  "";
const artifactSigningEndpoint =
  process.env.AURAONE_ARTIFACT_SIGNING_ENDPOINT ||
  process.env.AURAONE_TRUSTED_SIGNING_ENDPOINT ||
  "";
const artifactSigningAccountName =
  process.env.AURAONE_ARTIFACT_SIGNING_ACCOUNT_NAME ||
  process.env.AURAONE_TRUSTED_SIGNING_ACCOUNT_NAME ||
  "";
const artifactSigningCertificateProfile =
  process.env.AURAONE_ARTIFACT_SIGNING_CERTIFICATE_PROFILE_NAME ||
  process.env.AURAONE_TRUSTED_SIGNING_CERTIFICATE_PROFILE_NAME ||
  "";
const artifactSigningReady = Boolean(
  artifactSigningProvider &&
    artifactSigningDlibPath &&
    (
      artifactSigningMetadataPath ||
      (artifactSigningEndpoint && artifactSigningAccountName && artifactSigningCertificateProfile)
    ),
);
const defaultGpgHomedir = path.join(process.env.HOME ?? "", ".auraone/open-studio-platform/secrets/gnupg");
const effectiveGpgHomedir = process.env.AURAONE_GPG_HOMEDIR || (fs.existsSync(defaultGpgHomedir) ? defaultGpgHomedir : "");
const windowsReady = Boolean(
  process.env.AURAONE_WINDOWS_CERT_THUMBPRINT ||
    process.env.WINDOWS_EV_CERT_THUMBPRINT ||
    (process.env.AURAONE_WINDOWS_PFX_PATH && process.env.AURAONE_WINDOWS_PFX_PASSWORD && windowsPfxPathExists) ||
    artifactSigningReady,
);
const gpgStatus = secretKeyStatus(
  flagshipsConfig.gpgFingerprint,
  process.env.AURAONE_GPG_KEY_ID || process.env.AURAONE_RELEASE_GPG_FINGERPRINT || "",
  effectiveGpgHomedir,
);
const linuxReady = Boolean(
  (process.env.AURAONE_GPG_KEY_ID && gpgStatus.configuredSecretKeyPresent) ||
    gpgStatus.expectedSecretKeyPresent ||
    process.env.AURAONE_RELEASE_GPG_PRIVATE_KEY,
);
const hostedSecretNamesReady = repositoryReadiness.every((state) => state.missingSecrets.length === 0);
const hostedVariableNamesReady = repositoryReadiness.every((state) => state.missingVariables.length === 0);
const hostedEnvironmentsReady = repositoryReadiness.every((state) => state.missingEnvironments.length === 0);
const missingHostedSecrets = [...new Set(repositoryReadiness.flatMap((state) => state.missingSecrets))];
const missingHostedSecretRequirements = hostedSecretRequirements
  .map((requirement) => {
    const affectedRepositories = repositoryReadiness
      .filter((state) => state.missingSecretRequirements.some((item) => item.id === requirement.id))
      .map((state) => state.repository);
    if (affectedRepositories.length === 0) return null;
    return {
      id: requirement.id,
      description: requirement.description,
      acceptedAlternatives: requirement.alternatives,
      affectedRepositories,
    };
  })
  .filter(Boolean);
const missingHostedVariables = [...new Set(repositoryReadiness.flatMap((state) => state.missingVariables))];
const missingHostedEnvironments = [...new Set(repositoryReadiness.flatMap((state) => state.missingEnvironments))];

const windowsPackageIdentityVerifier = runJsonVerifier("scripts/verify-windows-package-identity-readiness.mjs");
const windowsPackageIdentityReport = windowsPackageIdentityVerifier.report ?? {};
const windowsPackageIdentityReadiness = {
  verifier: windowsPackageIdentityVerifier.path,
  available: windowsPackageIdentityVerifier.available,
  error: windowsPackageIdentityVerifier.error,
  readyForWindowsPackageIdentityClosure: Boolean(
    windowsPackageIdentityReport.readyForWindowsPackageIdentityClosure,
  ),
  readyForWingetSubmission: Boolean(windowsPackageIdentityReport.readyForWingetSubmission),
  blockers: windowsPackageIdentityReport.blockers ?? [],
  products: (windowsPackageIdentityReport.products ?? []).map((product) => ({
    id: product.id,
    packageIdentifier: product.packageIdentifier,
    readyForPackageIdentityClosure: Boolean(product.readyForPackageIdentityClosure),
    readyForWingetSubmission: Boolean(product.readyForWingetSubmission),
    releaseAllExpectedMsiAssetsPresent: Boolean(product.release?.allExpectedMsiAssetsPresent),
    wingetManifestHasRealShaAndProductCode: Boolean(product.winget?.manifestHasRealShaAndProductCode),
  })),
};
const windowsSigningCustodyEvidence = windowsSigningCustodyRequirements.map((requirement) => {
  const evidence = windowsSigningCustodyEvidenceState(requirement.key);
  return {
    key: requirement.key,
    name: requirement.name,
    requiredEvidence: requirement.requiredEvidence,
    externalEvidencePresent: evidence.accepted,
    evidenceFiles: evidence.files,
    preferredEvidencePath:
      `docs/evidence/product/windows-signing-custody/${requirement.key}.md`,
    templatePath:
      `docs/evidence/product/windows-signing-custody/templates/${requirement.key}.md`,
  };
});

const blockers = [];
if (!windowsReady) blockers.push("Windows EV/HSM/PFX or managed Artifact Signing custody is not configured locally");
for (const item of windowsSigningCustodyEvidence) {
  if (item.externalEvidencePresent) continue;
  if (item.evidenceFiles.length > 0) {
    blockers.push(
      `Windows signing custody evidence ${item.key} is present but not acceptable; replace ${item.preferredEvidencePath}`,
    );
  } else {
    blockers.push(
      `Windows signing custody evidence ${item.key} is missing; add ${item.preferredEvidencePath} from ${item.templatePath}`,
    );
  }
}
if (!linuxReady) blockers.push("Linux release GPG private-key custody is not configured locally");
if (!hostedSecretNamesReady) {
  const missingRequirements = missingHostedSecretRequirements
    .map((requirement) => {
      const alternatives = requirement.acceptedAlternatives
        .map((alternative) => alternative.join(" + "))
        .join(" OR ");
      return `${requirement.id} (${alternatives})`;
    })
    .join("; ");
  blockers.push(
    `Hosted release workflow missing GitHub secret custody requirements: ${missingRequirements}`,
  );
}
if (!hostedVariableNamesReady) {
  blockers.push(
    `Hosted release workflow missing GitHub variables: ${missingHostedVariables.join(", ")}`,
  );
}
if (!hostedEnvironmentsReady) {
  blockers.push(
    `Hosted release workflow missing GitHub environments: ${missingHostedEnvironments.join(", ")}`,
  );
}
if (!windowsPackageIdentityReadiness.available) {
  blockers.push("Windows package identity verifier could not run");
} else {
  if (!windowsPackageIdentityReadiness.readyForWindowsPackageIdentityClosure) {
    blockers.push("Windows package identity verifier is not closed for all flagships");
  }
  if (!windowsPackageIdentityReadiness.readyForWingetSubmission) {
    blockers.push("EV-signed Windows MSI, winget manifest, or clean Windows install evidence remains incomplete");
  }
}

console.log(
  JSON.stringify(
    {
      ok: true,
      readyForSigningCustodyClosure: blockers.length === 0,
      checkedAt: new Date().toISOString(),
      safetyRule:
        "This verifier prints only booleans, public identifiers, secret/variable names, evidence-validation summaries, and file presence; it does not print secret values.",
      commands: {
        gh: commandAvailable("gh"),
        gpg: commandAvailable("gpg"),
        pwsh: commandAvailable("pwsh"),
        codesign: commandAvailable("codesign"),
        xcrun: commandAvailable("xcrun"),
      },
      scripts: {
        windows: fileState("scripts/sign-windows.ps1"),
        linux: fileState("scripts/sign-linux.sh"),
        macos: fileState("scripts/sign-macos.sh"),
        notarize: fileState("scripts/notarize.sh"),
        releaseWorkflow: fileState(".github-templates/workflows/release.yml"),
      },
      localEnvironment: {
        windows: {
          envPresent: localWindowsEnv,
          pfxPathConfigured: Boolean(windowsPfxPath),
          pfxPathExists: windowsPfxPathExists,
          provider: windowsSigningProvider || null,
          artifactSigningProvider: artifactSigningProvider,
          artifactSigningDlibPathConfigured: Boolean(artifactSigningDlibPath),
          artifactSigningMetadataPathConfigured: Boolean(artifactSigningMetadataPath),
          artifactSigningMetadataFieldsConfigured: Boolean(
            artifactSigningEndpoint && artifactSigningAccountName && artifactSigningCertificateProfile,
          ),
          ready: windowsReady,
        },
        linux: {
          envPresent: localLinuxEnv,
          secretKey: gpgStatus,
          ready: linuxReady,
        },
        macosHosted: {
          envPresent: localMacHostedEnv,
        },
        hostedRelease: {
          envPresent: localHostedEnv,
        },
      },
      windowsSigningCustodyEvidence: {
        envName: windowsSigningCustodyEvidenceEnvName,
        configured: Boolean(windowsSigningCustodyEvidenceDir),
        source: windowsSigningCustodyEvidenceDirSource,
        valuePrinted: false,
        acceptedLayouts: [
          "$AURAONE_WINDOWS_SIGNING_CUSTODY_EVIDENCE_DIR/<evidence-key>.<md|json|txt|png|pdf>",
          "$AURAONE_WINDOWS_SIGNING_CUSTODY_EVIDENCE_DIR/windows/<evidence-key>.<md|json|txt|png|pdf>",
          "docs/evidence/product/windows-signing-custody/<evidence-key>.<md|json|txt|png|pdf>",
          "docs/evidence/product/windows-signing-custody/windows/<evidence-key>.<md|json|txt|png|pdf>",
        ],
        requirements: windowsSigningCustodyEvidence,
      },
      githubCustody: {
        repositories,
        requiredHostedSecrets,
        hostedSecretRequirements,
        requiredHostedVariables,
        requiredHostedEnvironments: Object.fromEntries(requiredHostedEnvironments),
        missingHostedSecrets,
        missingHostedSecretRequirements,
        missingHostedVariables,
        missingHostedEnvironments,
        repositoryReadiness,
        secretStates: githubSecretStates,
        orgSecretStates: githubOrgSecretStates,
        variableStates: githubVariableStates,
        orgVariableStates: githubOrgVariableStates,
        environmentStates: githubEnvironmentStates,
      },
      windowsPackageIdentities: {
        evidenceDirEnvName: "AURAONE_WINDOWS_IDENTITY_EVIDENCE_DIR",
        packageIdentifiers: flagships.map((flagship) => ({
          product: flagship.id,
          wingetPackageIdentifier: flagship.wingetPackageIdentifier,
        })),
        readiness: windowsPackageIdentityReadiness,
      },
      blockers,
    },
    null,
    2,
  ),
);
