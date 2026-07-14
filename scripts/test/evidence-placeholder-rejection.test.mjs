import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const platformRoot = path.resolve(testDir, "../..");

function runJson(script, env) {
  const result = spawnSync("node", [script], {
    cwd: platformRoot,
    env: { ...process.env, ...env },
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 8,
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return JSON.parse(result.stdout);
}

function runScript(args, env = {}) {
  return spawnSync("node", args, {
    cwd: platformRoot,
    env: { ...process.env, ...env },
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 8,
  });
}

function withTempDir(fn) {
  const dir = mkdtempSync(path.join(tmpdir(), "auraone-evidence-"));
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { force: true, recursive: true });
  }
}

test("launch ops verifier rejects placeholder evidence files", () => {
  withTempDir((evidenceDir) => {
    const productDir = path.join(evidenceDir, "rubric-studio-open");
    mkdirSync(productDir, { recursive: true });
    writeFileSync(
      path.join(productDir, "hn-show-hn-timed.md"),
      "TODO placeholder pending evidence that must not close the launch gate even if a file exists. ".repeat(3),
    );

    const report = runJson("scripts/verify-launch-ops-readiness.mjs", {
      AURAONE_OPEN_STUDIO_LAUNCH_EVIDENCE_DIR: evidenceDir,
    });
    const rubric = report.products.find((product) => product.id === "rubric-studio-open");
    const action = rubric.externalActions.find((item) => item.key === "hn-show-hn-timed");

    assert.equal(action.externalEvidencePresent, false);
    assert.equal(action.publicIssue.url, "https://github.com/auraoneai/rubric-studio-open/issues/46");
    assert.equal(action.evidenceFiles.length, 1);
    assert.equal(action.evidenceFiles[0].accepted, false);
    assert.match(action.evidenceFiles[0].rejectionReasons.join(" "), /placeholder|pending/i);
    assert.ok(
      report.blockers.includes(
        "rubric-studio-open/hn-show-hn-timed: external launch evidence is present but not acceptable; replace docs/evidence/product/open-studio-launch-ops/rubric-studio-open/hn-show-hn-timed.md or another accepted evidence file; tracked by https://github.com/auraoneai/rubric-studio-open/issues/46",
      ),
    );
    const instruction = report.missingExternalEvidenceInstructions.find(
      (item) => item.productId === "rubric-studio-open" && item.actionKey === "hn-show-hn-timed",
    );
    assert.equal(instruction.evidenceStatus, "present-but-rejected");
    assert.equal(
      instruction.preferredEvidencePath,
      "docs/evidence/product/open-studio-launch-ops/rubric-studio-open/hn-show-hn-timed.md",
    );
    assert.equal(
      instruction.templatePath,
      "docs/evidence/product/open-studio-launch-ops/templates/rubric-studio-open/hn-show-hn-timed.md",
    );
    assert.ok(instruction.requiredEvidence.includes("launch calendar entry"));
    assert.ok(instruction.requiredFields.includes("Captured at"));
  });
});

test("launch ops verifier accepts substantive single-action evidence", () => {
  withTempDir((evidenceDir) => {
    const productDir = path.join(evidenceDir, "rubric-studio-open");
    mkdirSync(productDir, { recursive: true });
    writeFileSync(
      path.join(productDir, "hn-show-hn-timed.md"),
      [
        "Evidence type: launch calendar and assigned submitter record.",
        "Public action: Show HN submission is scheduled for 2026-06-03T09:00:00-07:00.",
        "Owner: AuraOne launch lead. Verification URL: https://news.ycombinator.com/item?id=12345678.",
      ].join("\n"),
    );

    const report = runJson("scripts/verify-launch-ops-readiness.mjs", {
      AURAONE_OPEN_STUDIO_LAUNCH_EVIDENCE_DIR: evidenceDir,
    });
    const rubric = report.products.find((product) => product.id === "rubric-studio-open");
    const action = rubric.externalActions.find((item) => item.key === "hn-show-hn-timed");

    assert.equal(action.externalEvidencePresent, true);
    assert.equal(action.publicIssue.valid, true);
    assert.equal(report.summary.externalActionsWithPublicIssue, report.summary.externalActionCount);
    assert.equal(action.evidenceFiles[0].accepted, true);
    assert.ok(!report.blockers.includes("rubric-studio-open/hn-show-hn-timed: external launch evidence is missing"));
    assert.ok(
      !report.missingExternalEvidenceInstructions.some(
        (item) => item.productId === "rubric-studio-open" && item.actionKey === "hn-show-hn-timed",
      ),
    );
    assert.equal(report.readyForLaunchOpsClosure, false);
  });
});

test("Windows identity verifier rejects placeholder evidence files", () => {
  withTempDir((evidenceDir) => {
    const packageDir = path.join(evidenceDir, "AuraOne.AgentStudioOpen");
    mkdirSync(packageDir, { recursive: true });
    writeFileSync(
      path.join(packageDir, "partner-center-identity.md"),
      "TODO placeholder pending Microsoft package identity evidence that must not close the Windows gate. ".repeat(3),
    );

    const report = runJson("scripts/verify-windows-package-identity-readiness.mjs", {
      AURAONE_WINDOWS_IDENTITY_EVIDENCE_DIR: evidenceDir,
    });
    const agent = report.products.find((product) => product.id === "agent-studio-open");
    const evidence = agent.identityEvidence.find((item) => item.key === "partner-center-identity");

    assert.equal(evidence.externalEvidencePresent, false);
    assert.equal(evidence.evidenceFiles.length, 1);
    assert.equal(evidence.evidenceFiles[0].accepted, false);
    assert.match(evidence.evidenceFiles[0].rejectionReasons.join(" "), /placeholder|pending/i);
    assert.ok(
      report.blockers.includes(
        "AuraOne.AgentStudioOpen/partner-center-identity: Microsoft identity evidence is present but not acceptable",
      ),
    );
  });
});

test("Windows identity verifier accepts substantive single-evidence files", () => {
  withTempDir((evidenceDir) => {
    const packageDir = path.join(evidenceDir, "AuraOne.AgentStudioOpen");
    mkdirSync(packageDir, { recursive: true });
    writeFileSync(
      path.join(packageDir, "partner-center-identity.md"),
      [
        "Evidence type: Microsoft Partner Center package identity export.",
        "Package identifier: AuraOne.AgentStudioOpen is reserved under the AuraOne publisher account.",
        "Captured at: 2026-06-03T16:00:00Z. Reviewer: release engineering. Source: Partner Center app identity page.",
      ].join("\n"),
    );

    const report = runJson("scripts/verify-windows-package-identity-readiness.mjs", {
      AURAONE_WINDOWS_IDENTITY_EVIDENCE_DIR: evidenceDir,
    });
    const agent = report.products.find((product) => product.id === "agent-studio-open");
    const evidence = agent.identityEvidence.find((item) => item.key === "partner-center-identity");

    assert.equal(evidence.externalEvidencePresent, true);
    assert.equal(evidence.evidenceFiles[0].accepted, true);
    assert.ok(
      !report.blockers.includes("AuraOne.AgentStudioOpen/partner-center-identity: Microsoft identity evidence is missing"),
    );
    assert.equal(report.readyForWindowsPackageIdentityClosure, false);
  });
});

test("winget verifier rejects placeholder EV-signing evidence files", () => {
  withTempDir((evidenceDir) => {
    const packageDir = path.join(evidenceDir, "AuraOne.AgentStudioOpen");
    mkdirSync(packageDir, { recursive: true });
    writeFileSync(
      path.join(packageDir, "ev-signature.md"),
      "TODO placeholder pending EV signing evidence that must not close the winget submission gate. ".repeat(3),
    );

    const report = runJson("scripts/verify-winget-matrix.mjs", {
      AURAONE_WINGET_EV_SIGNATURE_EVIDENCE: evidenceDir,
    });
    const agent = report.packageStates.find((product) => product.id === "agent-studio-open");

    assert.equal(agent.evSigningEvidence.present, true);
    assert.equal(agent.evSigningEvidence.accepted, false);
    assert.equal(agent.evSigningEvidence.files.length, 1);
    assert.match(agent.evSigningEvidence.files[0].rejectionReasons.join(" "), /placeholder|pending/i);
    assert.ok(
      report.blockers.includes(
        "AuraOne.AgentStudioOpen: EV-signing evidence is present but not acceptable for winget submission",
      ),
    );
  });
});

test("winget verifier accepts substantive EV-signing evidence files", () => {
  withTempDir((evidenceDir) => {
    const packageDir = path.join(evidenceDir, "AuraOne.AgentStudioOpen");
    mkdirSync(packageDir, { recursive: true });
    writeFileSync(
      path.join(packageDir, "ev-signature.md"),
      [
        "Evidence type: Authenticode verification for public EV-signed MSI.",
        "Package identifier: AuraOne.AgentStudioOpen. Version: 0.1.0. Artifact: Agent.Studio.Open_0.1.0_x64_en-US.msi.",
        "Captured at: 2026-06-03T16:00:00Z. Source: signed release artifact verification log and winget submission packet.",
      ].join("\n"),
    );

    const report = runJson("scripts/verify-winget-matrix.mjs", {
      AURAONE_WINGET_EV_SIGNATURE_EVIDENCE: evidenceDir,
    });
    const agent = report.packageStates.find((product) => product.id === "agent-studio-open");

    assert.equal(agent.evSigningEvidence.present, true);
    assert.equal(agent.evSigningEvidence.accepted, true);
    assert.ok(
      !report.blockers.includes("AuraOne.AgentStudioOpen: EV-signing evidence is missing for winget submission"),
    );
  });
});

test("winget manifest preparation refuses unsigned MSI metadata when signature is required", () => {
  withTempDir((tempDir) => {
    const metadataPath = path.join(tempDir, "windows-msi-x64.json");
    writeFileSync(
      metadataPath,
      JSON.stringify(
        {
          packageIdentifier: "AuraOne.AgentStudioOpen",
          version: "0.1.0",
          architecture: "x64",
          artifactName: "Agent.Studio.Open_0.1.0_x64_en-US.msi",
          installerUrl:
            "https://github.com/auraoneai/agent-studio-open/releases/download/v0.1.0/Agent.Studio.Open_0.1.0_x64_en-US.msi",
          installerSha256: "ad595c1b59003d6971b29fda7f620eb7d50c7fe33c3437b625e4a684052ef183",
          productCode: "{53ACB6EA-342C-4333-B63E-5FF4FB4EE588}",
          signature: { status: "NotSigned" },
        },
        null,
        2,
      ),
    );

    const result = runScript([
      "scripts/prepare-winget-manifests.mjs",
      "--metadata",
      metadataPath,
      "--require-signed",
    ]);

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Authenticode signature must be Valid/);
  });
});

test("winget manifest preparation accepts valid signed MSI metadata without rewriting by default", () => {
  withTempDir((tempDir) => {
    const metadataPath = path.join(tempDir, "windows-msi-x64.json");
    writeFileSync(
      metadataPath,
      JSON.stringify(
        {
          packageIdentifier: "AuraOne.AgentStudioOpen",
          version: "0.1.0",
          architecture: "x64",
          artifactName: "Agent.Studio.Open_0.1.0_x64_en-US.msi",
          installerUrl:
            "https://github.com/auraoneai/agent-studio-open/releases/download/v0.1.0/Agent.Studio.Open_0.1.0_x64_en-US.msi",
          installerSha256: "ad595c1b59003d6971b29fda7f620eb7d50c7fe33c3437b625e4a684052ef183",
          productCode: "{53ACB6EA-342C-4333-B63E-5FF4FB4EE588}",
          signature: { status: "Valid" },
        },
        null,
        2,
      ),
    );

    const result = runScript([
      "scripts/prepare-winget-manifests.mjs",
      "--metadata",
      metadataPath,
      "--require-signed",
    ]);

    assert.equal(result.status, 0, result.stderr || result.stdout);
    const report = JSON.parse(result.stdout);
    assert.equal(report.ok, true);
    assert.equal(report.requireSigned, true);
    assert.equal(report.write, false);
    assert.equal(report.updates.length, 1);
    assert.equal(report.updates[0].changed, false);
  });
});

test("signing custody verifier rejects placeholder Windows custody evidence files", () => {
  withTempDir((evidenceDir) => {
    writeFileSync(
      path.join(evidenceDir, "custody-attestation.md"),
      "TODO placeholder pending Windows signing custody evidence that must not close the custody gate. ".repeat(3),
    );

    const report = runJson("scripts/verify-signing-custody-readiness.mjs", {
      AURAONE_WINDOWS_SIGNING_CUSTODY_EVIDENCE_DIR: evidenceDir,
    });
    const evidence = report.windowsSigningCustodyEvidence.requirements.find(
      (item) => item.key === "custody-attestation",
    );

    assert.equal(evidence.externalEvidencePresent, false);
    assert.equal(evidence.evidenceFiles.length, 1);
    assert.equal(evidence.evidenceFiles[0].accepted, false);
    assert.match(evidence.evidenceFiles[0].rejectionReasons.join(" "), /placeholder|pending/i);
    assert.ok(
      report.blockers.includes(
        "Windows signing custody evidence custody-attestation is present but not acceptable; replace docs/evidence/product/windows-signing-custody/custody-attestation.md",
      ),
    );
  });
});

test("signing custody verifier accepts substantive Windows custody evidence files", () => {
  withTempDir((evidenceDir) => {
    writeFileSync(
      path.join(evidenceDir, "custody-attestation.md"),
      [
        "Evidence type: managed Windows signing custody attestation.",
        "Custody mode: Azure Artifact Signing with redacted account/profile proof for AuraOne Open Studio releases.",
        "Captured at: 2026-06-03T16:00:00Z. Owner: Platform Release Engineering. Backup owner: AuraOne security delegate. Reviewer: Platform Security.",
      ].join("\n"),
    );

    const report = runJson("scripts/verify-signing-custody-readiness.mjs", {
      AURAONE_WINDOWS_SIGNING_CUSTODY_EVIDENCE_DIR: evidenceDir,
    });
    const evidence = report.windowsSigningCustodyEvidence.requirements.find(
      (item) => item.key === "custody-attestation",
    );

    assert.equal(evidence.externalEvidencePresent, true);
    assert.equal(evidence.evidenceFiles[0].accepted, true);
    assert.ok(
      !report.blockers.includes(
        "Windows signing custody evidence custody-attestation is missing; add docs/evidence/product/windows-signing-custody/custody-attestation.md from docs/evidence/product/windows-signing-custody/templates/custody-attestation.md",
      ),
    );
  });
});

test("observability verifier rejects placeholder Sentry evidence files", () => {
  withTempDir((evidenceDir) => {
    const evidencePath = path.join(evidenceDir, "rubric-sentry-project.md");
    writeFileSync(
      evidencePath,
      "TODO placeholder pending Sentry project evidence that must not close the observability gate. ".repeat(3),
    );

    const report = runJson("scripts/verify-observability-readiness.mjs", {
      RUBRIC_STUDIO_OPEN_SENTRY_PROJECT_EVIDENCE: evidencePath,
    });
    const rubric = report.sentry.projectStates.find((product) => product.slug === "rubric-studio-open");

    assert.equal(rubric.projectEvidence.present, true);
    assert.equal(rubric.projectEvidence.accepted, false);
    assert.match(rubric.projectEvidence.rejectionReasons.join(" "), /placeholder|pending/i);
    assert.ok(report.blockers.includes("rubric-studio-open: project evidence present but not acceptable"));
  });
});

test("Robotics hosted hardware verifier rejects placeholder hardware evidence files", () => {
  withTempDir((evidenceDir) => {
    writeFileSync(
      path.join(evidenceDir, "m2-pro-performance-baseline.md"),
      "TODO placeholder pending Robotics hardware benchmark evidence that must not close the hardware gate. ".repeat(3),
    );

    const report = runJson("scripts/verify-robotics-hosted-hardware-readiness.mjs", {
      AURAONE_ROBOTICS_HARDWARE_EVIDENCE_DIR: evidenceDir,
    });
    const evidence = report.evidence.find((item) => item.key === "m2-pro-performance-baseline");

    assert.equal(evidence.externalEvidencePresent, false);
    assert.equal(evidence.evidenceFiles.length, 1);
    assert.equal(evidence.evidenceFiles[0].accepted, false);
    assert.match(evidence.evidenceFiles[0].rejectionReasons.join(" "), /placeholder|pending/i);
    assert.ok(
      report.blockers.includes("m2-pro-performance-baseline: Robotics hardware/CI evidence is present but not acceptable"),
    );
  });
});

test("Linux artifact verifier rejects placeholder release evidence files", () => {
  withTempDir((evidenceDir) => {
    const productDir = path.join(evidenceDir, "agent-studio-open");
    mkdirSync(productDir, { recursive: true });
    writeFileSync(
      path.join(productDir, "linux-build-run.md"),
      "TODO placeholder pending Linux artifact build evidence that must not close the Linux release gate. ".repeat(3),
    );

    const report = runJson("scripts/verify-linux-artifact-readiness.mjs", {
      AURAONE_LINUX_ARTIFACT_EVIDENCE_DIR: evidenceDir,
    });
    const agent = report.products.find((item) => item.id === "agent-studio-open");
    const evidence = agent.evidence.find((item) => item.key === "linux-build-run");

    assert.equal(evidence.externalEvidencePresent, false);
    assert.equal(evidence.evidenceFiles.length, 1);
    assert.equal(evidence.evidenceFiles[0].accepted, false);
    assert.match(evidence.evidenceFiles[0].rejectionReasons.join(" "), /placeholder|pending/i);
    assert.ok(
      report.blockers.includes("agent-studio-open/linux-build-run: Linux release evidence is present but not acceptable"),
    );
  });
});

test("Cloud import consumer verifier rejects placeholder evidence files", () => {
  withTempDir((evidenceDir) => {
    writeFileSync(
      path.join(evidenceDir, "consumer-smoke-import.md"),
      "TODO placeholder pending Cloud consumer smoke import evidence that must not close the Cloud import gate. ".repeat(3),
    );

    const report = runJson("scripts/verify-cloud-import-consumer-readiness.mjs", {
      AURAONE_CLOUD_IMPORT_EVIDENCE_DIR: evidenceDir,
    });
    const evidence = report.evidence.find((item) => item.key === "consumer-smoke-import");

    assert.equal(report.localProducerProbe.queued, true);
    assert.equal(evidence.externalEvidencePresent, false);
    assert.equal(evidence.evidenceFiles.length, 1);
    assert.equal(evidence.evidenceFiles[0].accepted, false);
    assert.match(evidence.evidenceFiles[0].rejectionReasons.join(" "), /placeholder|pending/i);
    assert.ok(
      report.blockers.includes("consumer-smoke-import: external Cloud consumer evidence is present but not acceptable"),
    );
  });
});

test("Root governance verifier rejects placeholder platform-owner evidence files", () => {
  withTempDir((evidenceDir) => {
    writeFileSync(
      path.join(evidenceDir, "platform-owner-team-map.md"),
      "TODO placeholder pending root platform-owner team mapping evidence that must not close the governance gate. ".repeat(3),
    );

    const report = runJson("scripts/verify-root-governance-evidence.mjs", {
      AURAONE_ROOT_GOVERNANCE_EVIDENCE_DIR: evidenceDir,
    });
    const evidence = report.evidence.find((item) => item.key === "platform-owner-team-map");

    assert.equal(report.localChecks.rootDcoWorkflowPresent, true);
    assert.equal(report.localChecks.rootOpenStudioPlatformOwned, true);
    assert.equal(evidence.externalEvidencePresent, false);
    assert.equal(evidence.evidenceFiles.length, 1);
    assert.equal(evidence.evidenceFiles[0].accepted, false);
    assert.match(evidence.evidenceFiles[0].rejectionReasons.join(" "), /placeholder|pending/i);
    assert.equal(
      evidence.templatePath,
      "docs/evidence/product/open-studio-root-governance/templates/platform-owner-team-map.md",
    );
    assert.equal(
      evidence.preferredEvidencePath,
      "docs/evidence/product/open-studio-root-governance/platform-owner-team-map.md",
    );
    assert.ok(
      report.missingExternalEvidenceInstructions.some(
        (item) =>
          item.key === "platform-owner-team-map" &&
          item.templatePath ===
            "docs/evidence/product/open-studio-root-governance/templates/platform-owner-team-map.md",
      ),
    );
    assert.ok(
      report.blockers.includes("platform-owner-team-map: external root governance evidence is present but not acceptable"),
    );
  });
});

test("GA approval verifier rejects placeholder legal approval evidence files", () => {
  withTempDir((evidenceDir) => {
    writeFileSync(
      path.join(evidenceDir, "legal-launch-approval.md"),
      "TODO placeholder pending legal launch approval evidence that must not close the GA approval gate. ".repeat(3),
    );

    const report = runJson("scripts/verify-ga-approval-evidence.mjs", {
      AURAONE_GA_APPROVAL_EVIDENCE_DIR: evidenceDir,
    });
    const evidence = report.evidence.find((item) => item.key === "legal-launch-approval");

    assert.equal(report.checklists.every((item) => item.present), true);
    assert.equal(evidence.externalEvidencePresent, false);
    assert.equal(evidence.evidenceFiles.length, 1);
    assert.equal(evidence.evidenceFiles[0].accepted, false);
    assert.match(evidence.evidenceFiles[0].rejectionReasons.join(" "), /placeholder|pending/i);
    assert.equal(
      evidence.templatePath,
      "docs/evidence/product/open-studio-ga-approvals/templates/legal-launch-approval.md",
    );
    assert.equal(
      evidence.preferredEvidencePath,
      "docs/evidence/product/open-studio-ga-approvals/legal-launch-approval.md",
    );
    assert.ok(
      report.missingExternalEvidenceInstructions.some(
        (item) =>
          item.key === "legal-launch-approval" &&
          item.templatePath ===
            "docs/evidence/product/open-studio-ga-approvals/templates/legal-launch-approval.md",
      ),
    );
    assert.ok(
      report.blockers.includes("legal-launch-approval: external GA/audit/legal evidence is present but not acceptable"),
    );
  });
});
