#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const platformRoot = path.resolve(scriptDir, "..");
const version = "0.1.0";
const probeUptime = process.argv.includes("--probe-uptime");

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(platformRoot, relativePath), "utf8"));
}

function replaceVersion(template) {
  return template ? template.replaceAll("${VERSION}", version) : null;
}

function commandAvailable(command) {
  const result = spawnSync("which", [command], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return result.status === 0;
}

function runJsonVerifier(relativePath, args = []) {
  const result = spawnSync(
    "node",
    [path.join(platformRoot, relativePath), ...args],
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

function ghReleaseAssets(repository) {
  if (!commandAvailable("gh")) {
    return { available: false, error: "gh command is not installed", assets: [] };
  }
  const result = spawnSync(
    "gh",
    ["release", "view", `v${version}`, "--repo", repository, "--json", "tagName,url,assets"],
    { encoding: "utf8", maxBuffer: 1024 * 1024 * 5 },
  );
  if (result.status !== 0) {
    return {
      available: false,
      error: result.stderr.trim() || result.stdout.trim() || `gh exited ${result.status}`,
      assets: [],
    };
  }
  const release = JSON.parse(result.stdout);
  return {
    available: true,
    tag: release.tagName,
    url: release.url,
    assets: release.assets.map((asset) => asset.name).sort(),
  };
}

async function probeCheck(check) {
  const result = {
    name: check.name,
    url: check.url,
    expectedStatus: check.expected_status,
    ok: false,
    status: null,
    contains: check.response_contains ?? null,
    error: null,
  };
  try {
    const response = await fetch(check.url, { method: check.method ?? "GET" });
    result.status = response.status;
    let bodyOk = true;
    if (check.response_contains) {
      const body = await response.text();
      bodyOk = body.includes(check.response_contains);
    }
    result.ok = response.status === check.expected_status && bodyOk;
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
  }
  return result;
}

const flagships = readJson("configs/flagships.json").flagships;
const sentry = readJson("configs/sentry/projects.json");
const rubricStatus = readJson("distribution/status/rubric-studio-open.json");

const windowsSigningProvider = (
  process.env.AURAONE_WINDOWS_SIGNING_PROVIDER ||
  process.env.WINDOWS_SIGNING_PROVIDER ||
  ""
).trim().toLowerCase();
const windowsArtifactSigningProvider = [
  "azure-artifact-signing",
  "artifact-signing",
  "azure-trusted-signing",
  "trusted-signing",
].includes(windowsSigningProvider);
const windowsArtifactSigningReady = Boolean(
  windowsArtifactSigningProvider &&
    (
      process.env.AURAONE_ARTIFACT_SIGNING_DLIB_PATH ||
      process.env.AURAONE_TRUSTED_SIGNING_DLIB_PATH
    ) &&
    (
      process.env.AURAONE_ARTIFACT_SIGNING_METADATA_PATH ||
      process.env.AURAONE_TRUSTED_SIGNING_METADATA_PATH ||
      (
        (process.env.AURAONE_ARTIFACT_SIGNING_ENDPOINT || process.env.AURAONE_TRUSTED_SIGNING_ENDPOINT) &&
        (process.env.AURAONE_ARTIFACT_SIGNING_ACCOUNT_NAME ||
          process.env.AURAONE_TRUSTED_SIGNING_ACCOUNT_NAME) &&
        (process.env.AURAONE_ARTIFACT_SIGNING_CERTIFICATE_PROFILE_NAME ||
          process.env.AURAONE_TRUSTED_SIGNING_CERTIFICATE_PROFILE_NAME)
      )
    ),
);
const windowsSigningEnvReady = Boolean(
  process.env.AURAONE_WINDOWS_CERT_THUMBPRINT ||
    process.env.WINDOWS_EV_CERT_THUMBPRINT ||
    (process.env.AURAONE_WINDOWS_PFX_PATH && process.env.AURAONE_WINDOWS_PFX_PASSWORD) ||
    windowsArtifactSigningReady,
);
const defaultGpgHomedir = path.join(process.env.HOME ?? "", ".auraone/open-studio-platform/secrets/gnupg");
const localReleaseGpgHomedirReady = fs.existsSync(defaultGpgHomedir);
const linuxSigningEnvReady = Boolean(
  process.env.AURAONE_RELEASE_GPG_FINGERPRINT ||
    process.env.GPG_SIGNING_KEY ||
    process.env.AURAONE_RELEASE_GPG_PRIVATE_KEY ||
    localReleaseGpgHomedirReady,
);
const signingCustodyVerifier = runJsonVerifier("scripts/verify-signing-custody-readiness.mjs");
const signingCustodyReport = signingCustodyVerifier.report ?? {};
const hostedCustodyEnvReady = Boolean(signingCustodyReport.readyForSigningCustodyClosure);
const signingCustodyReadiness = {
  verifier: signingCustodyVerifier.path,
  available: signingCustodyVerifier.available,
  error: signingCustodyVerifier.error,
  readyForSigningCustodyClosure: Boolean(signingCustodyReport.readyForSigningCustodyClosure),
  missingHostedSecrets: signingCustodyReport.githubCustody?.missingHostedSecrets ?? [],
  missingHostedSecretRequirements:
    signingCustodyReport.githubCustody?.missingHostedSecretRequirements ?? [],
  missingHostedVariables: signingCustodyReport.githubCustody?.missingHostedVariables ?? [],
  missingHostedEnvironments: signingCustodyReport.githubCustody?.missingHostedEnvironments ?? [],
  blockers: signingCustodyReport.blockers ?? [],
};
const windowsPackageIdentityVerifier = runJsonVerifier("scripts/verify-windows-package-identity-readiness.mjs");
const windowsPackageIdentityReport = windowsPackageIdentityVerifier.report ?? {};
const windowsPackageIdentityByProduct = new Map(
  (windowsPackageIdentityReport.products ?? []).map((product) => [product.id, product]),
);
const windowsPackageIdentityReady = Boolean(
  windowsPackageIdentityReport.readyForWindowsPackageIdentityClosure,
);
const wingetSubmissionReady = Boolean(
  windowsPackageIdentityReport.readyForWingetSubmission,
);
const windowsPackageIdentityReadiness = {
  verifier: windowsPackageIdentityVerifier.path,
  available: windowsPackageIdentityVerifier.available,
  error: windowsPackageIdentityVerifier.error,
  readyForWindowsPackageIdentityClosure: Boolean(
    windowsPackageIdentityReport.readyForWindowsPackageIdentityClosure,
  ),
  readyForWingetSubmission: Boolean(windowsPackageIdentityReport.readyForWingetSubmission),
  products: (windowsPackageIdentityReport.products ?? []).map((product) => ({
    id: product.id,
    packageIdentifier: product.packageIdentifier,
    readyForPackageIdentityClosure: Boolean(product.readyForPackageIdentityClosure),
    readyForWingetSubmission: Boolean(product.readyForWingetSubmission),
    releaseAllExpectedMsiAssetsPresent: Boolean(product.release?.allExpectedMsiAssetsPresent),
    wingetManifestHasRealShaAndProductCode: Boolean(product.winget?.manifestHasRealShaAndProductCode),
  })),
  blockers: windowsPackageIdentityReport.blockers ?? [],
};
const linuxArtifactVerifier = runJsonVerifier("scripts/verify-linux-artifact-readiness.mjs");
const linuxArtifactReport = linuxArtifactVerifier.report ?? {};
const linuxArtifactByProduct = new Map(
  (linuxArtifactReport.products ?? []).map((product) => [product.id, product]),
);
const linuxArtifactReady = Boolean(linuxArtifactReport.readyForLinuxArtifactClosure);
const linuxArtifactReadiness = {
  verifier: linuxArtifactVerifier.path,
  available: linuxArtifactVerifier.available,
  error: linuxArtifactVerifier.error,
  readyForLinuxArtifactClosure: Boolean(linuxArtifactReport.readyForLinuxArtifactClosure),
  products: (linuxArtifactReport.products ?? []).map((product) => ({
    id: product.id,
    readyForLinuxArtifactClosure: Boolean(product.readyForLinuxArtifactClosure),
    allArtifactsPresent: Boolean(product.allArtifactsPresent),
    allDetachedSignaturesPresent: Boolean(product.allDetachedSignaturesPresent),
  })),
  blockers: linuxArtifactReport.blockers ?? [],
};
const dcoEnforcementVerifier = runJsonVerifier("scripts/verify-dco-enforcement-readiness.mjs");
const dcoEnforcementReport = dcoEnforcementVerifier.report ?? {};
const dcoEnforcementReady = Boolean(dcoEnforcementReport.readyForPublicReleaseDcoClosure);
const dcoEnforcementReadiness = {
  verifier: dcoEnforcementVerifier.path,
  available: dcoEnforcementVerifier.available,
  error: dcoEnforcementVerifier.error,
  readyForDcoEnforcementClosure: Boolean(dcoEnforcementReport.readyForDcoEnforcementClosure),
  readyForPublicReleaseDcoClosure: dcoEnforcementReady,
  repositories: (dcoEnforcementReport.repositories ?? []).map((repository) => ({
    id: repository.id,
    repository: repository.repository,
    publicReleaseBlocking: Boolean(repository.publicReleaseBlocking),
    branchProtectionReady: Boolean(repository.branchProtection?.ready),
    dcoWorkflowOnMain: Boolean(repository.dcoWorkflow?.present),
    trackedPullRequests: (repository.pullRequests ?? []).map((pullRequest) => ({
      number: pullRequest.number,
      state: pullRequest.state,
      dcoPassed: Boolean(pullRequest.dcoCheck?.passed),
      reviewDecision: pullRequest.reviewDecision ?? null,
      readyForReviewClosure: Boolean(pullRequest.readyForReviewClosure),
    })),
  })),
  blockers: dcoEnforcementReport.blockers ?? [],
};
const cloudImportConsumerVerifier = runJsonVerifier("scripts/verify-cloud-import-consumer-readiness.mjs");
const cloudImportConsumerReport = cloudImportConsumerVerifier.report ?? {};
const cloudImportConsumerReady = Boolean(cloudImportConsumerReport.readyForCloudImportConsumerClosure);
const cloudImportConsumerReadiness = {
  verifier: cloudImportConsumerVerifier.path,
  available: cloudImportConsumerVerifier.available,
  error: cloudImportConsumerVerifier.error,
  readyForCloudImportConsumerClosure: cloudImportConsumerReady,
  queueName: cloudImportConsumerReport.queueName ?? null,
  intakeProducerBindingPresent: Boolean(
    cloudImportConsumerReport.intakeReceiver?.producerBindingPresent,
  ),
  localProducerProbeQueued: Boolean(cloudImportConsumerReport.localProducerProbe?.queued),
  evidence: (cloudImportConsumerReport.evidence ?? []).map((item) => ({
    key: item.key,
    externalEvidencePresent: Boolean(item.externalEvidencePresent),
  })),
  blockers: cloudImportConsumerReport.blockers ?? [],
};
const rootGovernanceVerifier = runJsonVerifier("scripts/verify-root-governance-evidence.mjs");
const rootGovernanceReport = rootGovernanceVerifier.report ?? {};
const rootGovernanceReady = Boolean(rootGovernanceReport.readyForRootGovernanceClosure);
const rootGovernanceReadiness = {
  verifier: rootGovernanceVerifier.path,
  available: rootGovernanceVerifier.available,
  error: rootGovernanceVerifier.error,
  readyForRootGovernanceClosure: rootGovernanceReady,
  repository: rootGovernanceReport.repository ?? null,
  branchProtectionAccessible: Boolean(rootGovernanceReport.branchProtection?.accessible),
  branchProtectionReady: Boolean(rootGovernanceReport.branchProtection?.ready),
  localChecks: rootGovernanceReport.localChecks ?? {},
  evidence: (rootGovernanceReport.evidence ?? []).map((item) => ({
    key: item.key,
    externalEvidencePresent: Boolean(item.externalEvidencePresent),
  })),
  blockers: rootGovernanceReport.blockers ?? [],
};
const gaApprovalVerifier = runJsonVerifier("scripts/verify-ga-approval-evidence.mjs");
const gaApprovalReport = gaApprovalVerifier.report ?? {};
const gaApprovalReady = Boolean(gaApprovalReport.readyForGaApprovalClosure);
const gaApprovalReadiness = {
  verifier: gaApprovalVerifier.path,
  available: gaApprovalVerifier.available,
  error: gaApprovalVerifier.error,
  readyForGaApprovalClosure: gaApprovalReady,
  checklists: (gaApprovalReport.checklists ?? []).map((item) => ({
    path: item.path,
    present: Boolean(item.present),
    uncheckedItems: item.uncheckedItems ?? null,
    blankSignoffFields: item.blankSignoffFields ?? null,
  })),
  evidence: (gaApprovalReport.evidence ?? []).map((item) => ({
    key: item.key,
    externalEvidencePresent: Boolean(item.externalEvidencePresent),
  })),
  blockers: gaApprovalReport.blockers ?? [],
};
const requiredSentryDsnNames = [
  "RUBRIC_STUDIO_OPEN_SENTRY_DSN",
  "ROBOTICS_STUDIO_OPEN_SENTRY_DSN",
  "AGENT_STUDIO_OPEN_SENTRY_DSN",
];
const missingLocalSentryDsnEnvNames = requiredSentryDsnNames.filter((name) => !process.env[name]);
const localSentryDsnEnvReady =
  Boolean(process.env.SENTRY_AUTH_TOKEN) && missingLocalSentryDsnEnvNames.length === 0;
const observabilityVerifierArgs = ["--probe-github-secrets"];
if (probeUptime) observabilityVerifierArgs.push("--probe-uptime");
const observabilityVerifier = runJsonVerifier(
  "scripts/verify-observability-readiness.mjs",
  observabilityVerifierArgs,
);
const observabilityReport = observabilityVerifier.report ?? {};
const sentryEnvReady = Boolean(
  localSentryDsnEnvReady || observabilityReport.readyForObservabilityClosure,
);
const sentryReadiness = {
  verifier: observabilityVerifier.path,
  available: observabilityVerifier.available,
  error: observabilityVerifier.error,
  readyForObservabilityClosure: Boolean(observabilityReport.readyForObservabilityClosure),
  dsnSatisfiedBy: (observabilityReport.sentry?.projectStates ?? []).map((project) => ({
    slug: project.slug,
    dsnRequirementSatisfied: Boolean(project.dsnRequirementSatisfied),
    dsnSatisfiedBy: project.dsnSatisfiedBy ?? "unknown",
    hostedDsnSecretPresent: project.hostedDsnSecretPresent ?? null,
  })),
  blockers: observabilityReport.blockers ?? [],
};

const products = flagships.map((product) => {
  const release = ghReleaseAssets(product.githubRepository);
  const assets = release.assets;
  const macArtifact = replaceVersion(product.macArtifact);
  const expectedWindows = [
    replaceVersion(product.windowsX64Artifact),
    replaceVersion(product.windowsArm64Artifact),
  ].filter(Boolean);
  const expectedLinux = [
    replaceVersion(product.linuxX64Artifact),
    replaceVersion(product.linuxArm64Artifact),
  ].filter(Boolean);
  const windowsProduct = windowsPackageIdentityByProduct.get(product.id) ?? null;
  const linuxProduct = linuxArtifactByProduct.get(product.id) ?? null;
  const windowsMsiAssets = assets.filter((asset) => asset.toLowerCase().endsWith(".msi"));
  const linuxPackageAssets = assets.filter((asset) =>
    /\.(appimage|deb|rpm)$/i.test(asset),
  );
  const detachedPackageSignatures = assets.filter(
    (asset) => asset.endsWith(".asc") && asset !== "SHA256SUMS.asc",
  );
  const productSbomAssets = assets.filter(
    (asset) =>
      /sbom|cyclonedx|cdx/i.test(asset) &&
      !asset.startsWith("Open.Studio.Platform_"),
  );

  return {
    id: product.id,
    repository: product.githubRepository,
    releaseAvailable: release.available,
    releaseUrl: release.url ?? null,
    releaseError: release.error ?? null,
    mac: {
      expectedArtifact: macArtifact,
      present: assets.includes(macArtifact),
    },
    windows: {
      expectedArtifacts: expectedWindows,
      msiAssets: windowsMsiAssets,
      evSigningEnvironmentReady: windowsSigningEnvReady,
      readyForPackageIdentityClosure: Boolean(windowsProduct?.readyForPackageIdentityClosure),
      readyForWingetSubmission: Boolean(windowsProduct?.readyForWingetSubmission),
      signedPublicMsiEvidence: Boolean(windowsProduct?.readyForWingetSubmission),
    },
    linux: {
      expectedAppImages: expectedLinux,
      packageAssets: linuxPackageAssets,
      detachedPackageSignatures,
      artifactEvidencePresent: Boolean(linuxProduct?.allArtifactsPresent),
      detachedSignatureEvidencePresent: Boolean(linuxProduct?.allDetachedSignaturesPresent),
      signingEnvironmentReady: linuxSigningEnvReady,
      readyForLinuxArtifactClosure: Boolean(linuxProduct?.readyForLinuxArtifactClosure),
    },
    sbom: {
      sharedPlatformSbomPresent: assets.some((asset) => asset.startsWith("Open.Studio.Platform_")),
      productScopedSbomAssets: productSbomAssets,
    },
  };
});

const blockers = [];
for (const product of products) {
  if (!product.windows.signedPublicMsiEvidence) {
    blockers.push(`${product.id}: Windows signed MSI, winget, or clean install evidence incomplete`);
  }
  if (!product.linux.readyForLinuxArtifactClosure) {
    blockers.push(`${product.id}: Linux artifact verifier did not prove package/signature/install readiness`);
  }
  if (product.sbom.productScopedSbomAssets.length === 0) {
    blockers.push(`${product.id}: product-scoped SBOM asset missing`);
  }
}
if (!windowsPackageIdentityVerifier.available) {
  blockers.push("Windows package identity verifier could not run");
} else if (!windowsPackageIdentityReady) {
  blockers.push("Windows package identity verifier is not closed for all flagships");
} else if (!wingetSubmissionReady) {
  blockers.push("Windows winget submission verifier is not closed for all flagships");
}
if (!linuxArtifactVerifier.available) {
  blockers.push("Linux artifact verifier could not run");
} else if (!linuxArtifactReady) {
  blockers.push("Linux artifact verifier is not closed for all flagships");
}
if (!signingCustodyVerifier.available) {
  blockers.push("Signing custody verifier could not run");
} else if (!hostedCustodyEnvReady) {
  blockers.push("Signing custody verifier is not closed for all flagships");
}
if (!dcoEnforcementVerifier.available) {
  blockers.push("DCO enforcement verifier could not run");
} else if (!dcoEnforcementReady) {
  blockers.push("DCO enforcement verifier is not closed for public release repositories and PRs");
}
if (!cloudImportConsumerVerifier.available) {
  blockers.push("Cloud import consumer verifier could not run");
} else if (!cloudImportConsumerReady) {
  blockers.push("Cloud import consumer verifier is not closed");
}
if (!rootGovernanceVerifier.available) {
  blockers.push("Root governance verifier could not run");
} else if (!rootGovernanceReady) {
  blockers.push("Root branch-protection/platform-owner evidence verifier is not closed");
}
if (!gaApprovalVerifier.available) {
  blockers.push("GA approval evidence verifier could not run");
} else if (!gaApprovalReady) {
  blockers.push("GA checklist/audit/legal approval evidence verifier is not closed");
}
if (!sentryEnvReady) blockers.push("Sentry observability verifier did not prove project/DSN provisioning");
if (rubricStatus.provisioning_status !== "provisioned") {
  blockers.push("Rubric uptime monitors are configured but not provisioned in a provider");
}

const uptimeProbeResults = probeUptime
  ? await Promise.all(rubricStatus.checks.map((check) => probeCheck(check)))
  : [];

const output = {
  ok: true,
  readyForCredentialedRelease: blockers.length === 0,
  checkedAt: new Date().toISOString(),
  safetyRule:
    "This preflight prints only availability booleans and artifact names; it does not print secret values or mutate release, registry, DNS, Sentry, uptime, or CI state.",
  credentials: {
    windowsSigningEnvReady,
    linuxSigningEnvReady,
    hostedCustodyEnvReady,
    signingCustodyReady: hostedCustodyEnvReady,
    windowsPackageIdentityReady: Boolean(
      windowsPackageIdentityReport.readyForWindowsPackageIdentityClosure,
    ),
    readyForWingetSubmission: Boolean(windowsPackageIdentityReport.readyForWingetSubmission),
    linuxArtifactReady,
    dcoEnforcementReady,
    cloudImportConsumerReady,
    rootGovernanceReady,
    gaApprovalReady,
    sentryEnvReady,
    localSentryDsnEnvReady,
    missingLocalSentryDsnEnvNames,
    sentryDsnCustody:
      observabilityReport.readyForObservabilityClosure
        ? "hosted-github-secret-or-local-env"
        : "not-proven",
  },
  signingCustody: signingCustodyReadiness,
  windowsPackageIdentity: windowsPackageIdentityReadiness,
  linuxArtifacts: linuxArtifactReadiness,
  dcoEnforcement: dcoEnforcementReadiness,
  cloudImportConsumer: cloudImportConsumerReadiness,
  rootGovernance: rootGovernanceReadiness,
  gaApprovals: gaApprovalReadiness,
  sentry: {
    orgSlug: sentry.org_slug,
    defaultOptIn: sentry.default_opt_in,
    readiness: sentryReadiness,
    projectStatuses: sentry.projects.map((project) => ({
      slug: project.slug,
      status: project.status,
      externalBlocker: project.external_blocker,
    })),
  },
  rubricUptime: {
    provisioningStatus: rubricStatus.provisioning_status,
    statusPage: rubricStatus.status_page,
    configuredChecks: rubricStatus.checks.map((check) => ({
      name: check.name,
      url: check.url,
      expectedStatus: check.expected_status,
      responseContains: check.response_contains ?? null,
    })),
    probeResults: uptimeProbeResults,
  },
  products,
  blockers,
};

console.log(JSON.stringify(output, null, 2));
