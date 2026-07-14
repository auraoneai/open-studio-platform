#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const cwd = process.cwd();
const root = fs.existsSync(path.join(cwd, "opensource", "open-studio-platform"))
  ? cwd
  : path.resolve(cwd, "../..");

const requiredFiles = [
  "docs/prds/robotics-studio-open-prd.md",
  "docs/prds/robotics-studio-open-coverage-matrix.md",
  "docs/prds/robotics-studio-open-agent6-coverage-matrix.md",
  "opensource/robotics-studio-open/LICENSE",
  "opensource/robotics-studio-open/README.md",
  "opensource/robotics-studio-open/CODEOWNERS",
  "opensource/robotics-studio-open/CONTRIBUTING.md",
  "opensource/robotics-studio-open/SECURITY.md",
  "opensource/robotics-studio-open/.github/settings.yml",
  "opensource/robotics-studio-open/.github/PULL_REQUEST_TEMPLATE.md",
  "opensource/robotics-studio-open/.github/ISSUE_TEMPLATE/bug_report.yml",
  "opensource/robotics-studio-open/.github/ISSUE_TEMPLATE/release_blocker.yml",
  "opensource/robotics-studio-open/.github/workflows/dco.yml",
  "opensource/robotics-studio-open/.github/workflows/ci.yml",
  "opensource/robotics-studio-open/.github/workflows/release.yml",
  "opensource/robotics-studio-open/.github/workflows/security-sbom-license.yml",
  "opensource/robotics-studio-open/.github/workflows/accessibility-performance.yml",
  "opensource/robotics-studio-open/docs/release/blockers-2026-05-13.md",
  "opensource/robotics-studio-open/docs/release/remaining-external-actions-2026-05-13.md",
  "opensource/robotics-studio-open/docs/release/release-blocker-issue-drafts-2026-05-13.md",
  "opensource/robotics-studio-open/docs/release/external-closure-evidence-template-2026-05-13.md",
  "opensource/robotics-studio-open/docs/release/public-endpoint-probe-2026-05-13.md",
  "opensource/robotics-studio-open/docs/release/launch-checklist-2026-05-13.md",
  "opensource/robotics-studio-open/docs/release/local-completion-audit-2026-05-13.md",
  "docs/open/robotics-studio/launch/podcast-outreach.md",
  "opensource/robotics-studio-open/docs/release/community-channel-readiness-2026-05-13.md",
  "opensource/robotics-studio-open/docs/release/intake-terms-draft-2026-05-13.md",
  "opensource/robotics-studio-open/docs/release/legal-review-packet-2026-05-13.md",
  "opensource/robotics-studio-open/docs/release/on-call-rotation-template-2026-05-13.md",
  "opensource/robotics-studio-open/docs/release/telemetry-dashboard-spec-2026-05-13.md",
  "opensource/robotics-studio-open/docs/release/release-readiness-2026-05-13.md",
  "opensource/robotics-studio-open/docs/release/registry-reservations-2026-05-13.md",
  "opensource/robotics-studio-open/docs/release/clean-install-verification-2026-05-13.md",
  "opensource/robotics-studio-open/docs/release/ci-performance-telemetry-validation-plan-2026-05-13.md",
  "opensource/robotics-studio-open/docs/release/accessibility-audit-2026-05-13.md",
  "opensource/robotics-studio-open/docs/release/dependency-license-scan-2026-05-13.md",
  "opensource/robotics-studio-open/docs/release/engine-version-pins-2026-05-13.md",
  "opensource/robotics-studio-open/docs/release/external-security-review-packet-2026-05-13.md",
  "opensource/robotics-studio-open/docs/release/security-review-2026-05-13.md",
  "opensource/robotics-studio-open/docs/release/fuzz-smoke-2026-05-13.md",
  "opensource/robotics-studio-open/docs/release/launch-execution-evidence-packet-2026-05-13.md",
  "opensource/robotics-studio-open/docs/release/package-metadata-2026-05-13.md",
  "opensource/robotics-studio-open/docs/release/post-launch-growth-cadence-packet-2026-05-13.md",
  "opensource/robotics-studio-open/docs/release/product-partner-readiness-packet-2026-05-13.md",
  "opensource/robotics-studio-open/docs/release/release-registry-publication-packet-2026-05-13.md",
  "opensource/robotics-studio-open/docs/release/risk-register-2026-05-13.md",
  "opensource/robotics-studio-open/docs/release/robostudio-engine-cve-scan-2026-05-13.md",
  "opensource/robotics-studio-open/docs/release/sample-dataset-license-audit-2026-05-13.md",
  "opensource/robotics-studio-open/docs/release/secrets-audit-2026-05-13.md",
  "opensource/robotics-studio-open/scripts/verify-doc-links.mjs",
  "opensource/robotics-studio-open/scripts/verify-accessibility.sh",
  "opensource/robotics-studio-open/scripts/verify-performance-baseline.sh",
  "opensource/robotics-studio-open/scripts/verify-security-review.sh",
  "opensource/robotics-studio-open/scripts/verify-launch-assets.mjs",
  "opensource/robotics-studio-open/scripts/verify-public-endpoint-probe.mjs",
  "opensource/robotics-studio-open/scripts/verify-release-credential-preflight.mjs",
  "opensource/robotics-studio-open/scripts/verify-current-branch-publication-state.mjs",
  "opensource/robotics-studio-open/scripts/verify-execution-prompt-coverage.mjs",
  "opensource/robotics-studio-open/scripts/verify-growth-experiments.mjs",
  "opensource/robotics-studio-open/scripts/verify-community-readiness.mjs",
  "opensource/robotics-studio-open/scripts/verify-event-demo-kit.mjs",
  "opensource/robotics-studio-open/scripts/verify-quarterly-cadence.mjs",
  "opensource/robotics-studio-open/scripts/verify-launch-execution-evidence.mjs",
  "opensource/robotics-studio-open/scripts/verify-product-partner-readiness.mjs",
  "opensource/robotics-studio-open/scripts/verify-release-blocker-template.mjs",
  "opensource/robotics-studio-open/scripts/verify-external-closure-gates.mjs",
  "opensource/robotics-studio-open/scripts/verify-external-closure-evidence.mjs",
  "opensource/robotics-studio-open/scripts/generate-external-closure-evidence-template.mjs",
  "opensource/robotics-studio-open/scripts/verify-external-closure-evidence-template.mjs",
  "opensource/robotics-studio-open/scripts/verify-external-blocker-live-evidence.mjs",
  "opensource/robotics-studio-open/scripts/generate-release-blocker-issues.mjs",
  "opensource/robotics-studio-open/scripts/verify-release-blocker-issues.mjs",
  "opensource/robotics-studio-open/scripts/verify-release-blocker-issue-drafts.mjs",
  "opensource/robotics-studio-open/scripts/create-release-blocker-issues.mjs",
  "opensource/robotics-studio-open/scripts/verify-release-blocker-issue-creation.mjs",
  "opensource/robotics-studio-open/scripts/verify-release-blocker-labels.mjs",
  "opensource/robotics-studio-open/scripts/verify-release-blocker-live-preflight.mjs",
  "opensource/robotics-studio-open/scripts/verify-release-github-repo-state.mjs",
  "opensource/robotics-studio-open/scripts/verify-release-github-live-drift.mjs",
  "opensource/robotics-studio-open/scripts/verify-release-github-actions-history.mjs",
  "opensource/robotics-studio-open/scripts/generate-release-blocker-apply-plan.mjs",
  "opensource/robotics-studio-open/scripts/verify-release-blocker-apply-plan.mjs",
  "opensource/robotics-studio-open/scripts/verify-prd-final-audit.mjs",
  "opensource/robotics-studio-open/scripts/verify-gpu-smoke.sh",
  "auraone-website/src/app/open/robotics-studio/failure-gallery/page.tsx",
  "docs/open/robotics-studio/plugin-sdk.md",
  "docs/open/robotics-studio/cloud-handoff.md",
  "docs/open/robotics-studio/growth-experiments.md",
  "docs/open/robotics-studio/community.md",
  "docs/open/robotics-studio/event-demo-kit.md",
  "docs/open/robotics-studio/release-cadence.md",
  "docs/open/robotics-studio/launch-execution.md",
  "docs/open/robotics-studio/product-partner-readiness.md",
  "opensource/robotics-studio-open/growth/top-of-funnel-experiments.json",
  "opensource/robotics-studio-open/community/channel-readiness.json",
  "opensource/robotics-studio-open/events/corl-2026-demo-kit.json",
  "opensource/robotics-studio-open/release/quarterly-cadence.json",
  "opensource/robotics-studio-open/launch/launch-execution-evidence.json",
  "opensource/robotics-studio-open/partners/product-partner-readiness.json",
  "opensource/robotics-studio-open/external/closure-gates.json",
  "opensource/robotics-studio-open/external/closure-evidence.json",
  "opensource/robostudio-engine/src/robostudio_engine/plugins.py",
  "opensource/robostudio-engine/examples/plugins/hdf5_force_panel/manifest.json",
  "opensource/robostudio-engine/examples/plugins/hdf5_force_panel/adapter.py",
  "opensource/robostudio-engine/examples/plugins/hdf5_force_panel/panel.tsx",
  "opensource/robotics-studio-open/scripts/build-release-artifacts.sh",
  "opensource/robotics-studio-open/scripts/publish-update-manifest.sh",
  "opensource/open-studio-platform/distribution/homebrew/Casks/robotics-studio-open.rb",
  "opensource/open-studio-platform/distribution/winget/AuraOne.RoboticsStudioOpen/0.1.0/AuraOne.RoboticsStudioOpen.yaml",
  "opensource/open-studio-platform/distribution/winget/AuraOne.RoboticsStudioOpen/0.1.0/AuraOne.RoboticsStudioOpen.locale.en-US.yaml",
  "opensource/open-studio-platform/distribution/winget/AuraOne.RoboticsStudioOpen/0.1.0/AuraOne.RoboticsStudioOpen.installer.yaml",
  "opensource/open-studio-platform/distribution/winget/AuraOne.RoboticsStudioOpen/0.2.0/AuraOne.RoboticsStudioOpen.yaml",
  "opensource/open-studio-platform/distribution/winget/AuraOne.RoboticsStudioOpen/0.2.0/AuraOne.RoboticsStudioOpen.locale.en-US.yaml",
  "opensource/open-studio-platform/distribution/winget/AuraOne.RoboticsStudioOpen/0.2.0/AuraOne.RoboticsStudioOpen.installer.yaml",
  "opensource/open-studio-platform/distribution/dns/robotics-studio-open.zone",
  "opensource/open-studio-platform/distribution/github/robotics-studio-open-settings.yml",
  "opensource/open-studio-platform/distribution/pypi/robostudio-engine-trusted-publisher.md",
  "opensource/open-studio-platform/configs/license/robotics-studio-open-policy.yml",
  "opensource/open-studio-platform/configs/sbom/robotics-studio-open.cyclonedx.yml",
  "opensource/open-studio-platform/security/checklists/robotics-studio-open-ga.md",
  "opensource/open-studio-platform/installers/robotics-studio-open/install.sh",
  "opensource/open-studio-platform/installers/robotics-studio-open/install.ps1",
  "opensource/robotics-studio/package.json",
  "opensource/robotics-studio/README.md",
  "opensource/robotics-studio/src/core.ts",
  "opensource/robotics-studio/src/app.test.ts",
  "opensource/robotics-studio/src-tauri/tauri.conf.json",
  "opensource/robotics-studio/src-tauri/src/lib.rs",
  "opensource/robotics-studio/tests/platform-inheritance.test.ts",
  "opensource/robostudio-engine/src/robostudio_engine/exports.py",
  "opensource/robostudio-engine/src/robostudio_engine/exporters.py",
  "opensource/robostudio-engine/tests/test_adapters_index.py",
  "opensource/robostudio-engine/tests/test_cli.py",
  "opensource/robostudio-engine/tests/test_engine_features.py",
  "opensource/robostudio-engine/tests/test_engine_smoke.py",
  "opensource/robostudio-engine/tests/test_security_exports.py",
  "opensource/robotics-studio/release/install.sh",
  "opensource/robotics-studio/release/homebrew-cask.rb",
  "opensource/robotics-studio/release/launch-blockers-2026-05-13.md",
];

const requiredSnippets = new Map([
  ["opensource/robotics-studio-open/CONTRIBUTING.md", ["Developer Certificate of Origin", "git commit -s"]],
  ["opensource/robotics-studio-open/README.md", ["Planned GA Distribution", "These paths are not live until", "https://install.auraone.ai/robotics-studio"]],
  ["opensource/robotics-studio-open/docs/release/blockers-2026-05-13.md", ["brew audit --cask --new robotics-studio-open", "notability/tap policy"]],
  ["opensource/robotics-studio-open/CODEOWNERS", ["@auraoneai/security"]],
  ["opensource/robotics-studio-open/.github/ISSUE_TEMPLATE/release_blocker.yml", ["prd_items", "blocking_dependency", "validation_command_or_url", "Required verification evidence"]],
  ["opensource/robotics-studio-open/.github/settings.yml", ["name: legal", "name: signing", "name: ci", "name: telemetry", "name: dns", "name: partner", "name: community", "name: launch"]],
  ["opensource/robotics-studio-open/.github/workflows/security-sbom-license.yml", ["anchore/sbom-action", "zricethezav/gitleaks:latest", "--no-git --redact --exit-code 1"]],
  ["opensource/robotics-studio-open/.github/workflows/release.yml", ["sign-macos.sh", "notarize.sh", "sign-windows.ps1", "publish-update-manifest.sh", "AURAONE_RELEASE_BOT_TOKEN", "CLOUDFLARE_ACCOUNT_ID", "AURAONE_ARTIFACT_SIGNING_ENDPOINT"]],
  ["opensource/robotics-studio-open/scripts/verify-doc-links.mjs", ["github.com/auraoneai/open", "missing relative link target"]],
  ["opensource/robotics-studio-open/scripts/verify-accessibility.sh", ["accessibility-blocker-2026-05-13.md", "exit 1"]],
  ["opensource/robotics-studio-open/scripts/verify-performance-baseline.sh", ["performance-blocker-2026-05-13.md", "exit 1"]],
  ["opensource/robotics-studio-open/scripts/verify-security-review.sh", ["test_security_exports.py", "test_security_fuzz_smoke.py", "check-telemetry-forbidden-fields", "CARGO_TARGET_DIR"]],
  ["opensource/robotics-studio-open/scripts/verify-launch-assets.mjs", ["github.com/auraoneai/open", "ffprobe", "xThreadPosts"]],
  ["opensource/robotics-studio-open/scripts/verify-public-endpoint-probe.mjs", ["robostudio-engine", "install.auraone.ai", "robotics-studio.auraone.ai", "production-website-route"]],
  ["opensource/robotics-studio-open/scripts/verify-release-credential-preflight.mjs", ["credentialPreflight", "readyForCredentialedRelease", "missingCredentialGroups", "must not print secret values"]],
  ["opensource/robotics-studio-open/scripts/verify-current-branch-publication-state.mjs", ["publicationState", "neutralPublicationSnippets", "git ls-remote", "localHead", "remoteHead"]],
  ["opensource/robotics-studio-open/scripts/verify-execution-prompt-coverage.mjs", ["executionPromptCoverage", "finalVerificationCommands", "promptAgentsCovered"]],
  ["opensource/robotics-studio-open/scripts/verify-growth-experiments.mjs", ["robotics-studio-open-p4-growth", "requires-external-launch-results", "dated result export"]],
  ["opensource/robotics-studio-open/scripts/verify-community-readiness.mjs", ["local-plan-live-channel-external", "deferred-past-ga", "public invite URL"]],
  ["opensource/robotics-studio-open/scripts/verify-event-demo-kit.mjs", ["local-plan-event-acceptance-external", "CoRL 2026", "live demo recording URL"]],
  ["opensource/robotics-studio-open/scripts/verify-quarterly-cadence.mjs", ["local-plan-quarterly-releases-external", "two consecutive quarterly releases", "signed artifacts"]],
  ["opensource/robotics-studio-open/scripts/verify-launch-execution-evidence.mjs", ["local-plan-launch-actions-external", "source=robotics-studio-open-launch", "Do not mark launch rows complete"]],
  ["opensource/robotics-studio-open/scripts/verify-product-partner-readiness.mjs", ["local-plan-partner-evidence-external", "DCO over CLA", "Do not mark partner readiness rows complete"]],
  ["opensource/robotics-studio-open/scripts/verify-release-blocker-template.mjs", ["validation_command_or_url", "remaining external action runbook", "closureGates.length"]],
  ["opensource/robotics-studio-open/scripts/verify-external-closure-gates.mjs", ["external-evidence-required", "Do not check any listed PRD row", "closure gate validation missing token"]],
  ["opensource/robotics-studio-open/scripts/verify-external-closure-evidence.mjs", ["closureEvidence", "missing-external-evidence", "evidence-validated", "artifactType", "requiredEvidence", "expectedValidation", "commandOrUrl"]],
  ["opensource/robotics-studio-open/scripts/generate-external-closure-evidence-template.mjs", ["external-closure-evidence-template", "statusToSetAfterValidation", "releaseIssueUrl", "artifactTypeFor"]],
  ["opensource/robotics-studio-open/scripts/verify-external-closure-evidence-template.mjs", ["evidenceTemplate", "external closure evidence template is stale", "expectedValidation", "releaseIssueUrl"]],
  ["opensource/robotics-studio-open/docs/release/external-closure-evidence-template-2026-05-13.md", ["Robotics Studio Open External Closure Evidence Template", "releaseIssueUrl: <release blocker issue URL>", "\"requiredEvidence\"", "\"expectedValidation\"", "evidence-validated"]],
  ["opensource/robotics-studio-open/scripts/verify-external-blocker-live-evidence.mjs", ["liveExternalEvidenceAudit", "blocked-public-evidence-missing", "blocked-manual-evidence-required", "blocked-time-based-evidence"]],
  ["opensource/robotics-studio-open/scripts/generate-release-blocker-issues.mjs", ["release-blocker-issue-payloads", "## Validation command or URL", "Keep the PRD row unchecked"]],
  ["opensource/robotics-studio-open/scripts/verify-release-blocker-issues.mjs", ["release blocker issue payloads", "payloads target the wrong repository", "raw TBD placeholder"]],
  ["opensource/robotics-studio-open/scripts/verify-release-blocker-issue-drafts.mjs", ["issueDrafts", "release blocker issue drafts are stale", "issue draft headings"]],
  ["opensource/robotics-studio-open/docs/release/release-blocker-issue-drafts-2026-05-13.md", ["Robotics Studio Open Release Blocker Issue Payloads", "Labels: blocker, release", "Keep the PRD row unchecked until every required artifact above exists"]],
  ["opensource/robotics-studio-open/scripts/create-release-blocker-issues.mjs", ["ROBOTICS_STUDIO_OPEN_CREATE_BLOCKERS=1", "Refusing to create public GitHub issues", "gh issue create", "gh\", [\"auth\", \"status\"", "plannedLabels", "\"issue\"", "\"list\"", "skippedExistingIssues", "\"label\"", "\"create\""]],
  ["opensource/robotics-studio-open/scripts/verify-release-blocker-issue-creation.mjs", ["must default to dry-run", "must fail closed without explicit apply guard", "plannedIssues", "planned label"]],
  ["opensource/robotics-studio-open/scripts/verify-release-blocker-labels.mjs", ["settings.yml missing planned blocker label", "plannedLabels.length !== 11", "dated next-action language"]],
  ["opensource/robotics-studio-open/scripts/verify-release-blocker-live-preflight.mjs", ["livePreflight", "missingLabels", "duplicatePlannedIssues", "applyWillCreateMissingLabels"]],
  ["opensource/robotics-studio-open/scripts/verify-release-github-repo-state.mjs", ["liveRepoState", "initialScaffoldSha", "supersededEvidencePr", "historicalEvidencePrChecks", "CONTRIBUTING.md", "branch protection must require two approving reviews"]],
  ["opensource/robotics-studio-open/scripts/verify-release-github-live-drift.mjs", ["liveDriftCheck", "missingLiveLabels", "expectedBranchProtection", "branchProtectionUnavailable"]],
  ["opensource/robotics-studio-open/scripts/verify-release-github-actions-history.mjs", ["liveActionsHistory", "hasRequiredGreenHistory", "hasGpuRunnerEvidence", "blocked until hasRequiredGreenHistory is true"]],
  ["opensource/robotics-studio-open/scripts/generate-release-blocker-apply-plan.mjs", ["release-blocker-apply-plan", "Safety rule", "Guarded Apply Command"]],
  ["opensource/robotics-studio-open/scripts/verify-release-blocker-apply-plan.mjs", ["explicit guarded apply command", "explicit approval safety rule", "duplicatePlannedIssues"]],
  ["opensource/robotics-studio-open/scripts/verify-prd-final-audit.mjs", ["Objective restated", "Do not call `update_goal` yet", "stale-prone fixed commit claim"]],
  ["auraone-website/src/app/open/robotics-studio/failure-gallery/page.tsx", ["No arbitrary private dataset upload", "not a hosted private editor", "robot_camera_shift_brittle"]],
  ["docs/open/robotics-studio/plugin-sdk.md", ["robostudio.plugin.v1", "plugins validate", "Panels are read-only", "cannot upload"]],
  ["docs/open/robotics-studio/cloud-handoff.md", ["CloudHandoffScenario", "cloudHandoffScenarios", "Robotics Studio Cloud", "Robotics Studio Enterprise", "AuraOne Robotics Programs", "explicit-preview-required", "Authenticated Robotics Studio Cloud import URL", "Statement-of-work approval", "Not included in Open"]],
  ["docs/open/robotics-studio/growth-experiments.md", ["top-of-funnel-experiments.json", "verify-growth-experiments.mjs", "requires-external-launch-results", "dated result export"]],
  ["docs/open/robotics-studio/community.md", ["channel-readiness.json", "verify-community-readiness.mjs", "#robotics-studio-open", "Discord or forum bot", "public invite URL"]],
  ["docs/open/robotics-studio/event-demo-kit.md", ["corl-2026-demo-kit.json", "verify-event-demo-kit.mjs", "CoRL 2026", "offline-capable demo laptop", "dated event-owner approval"]],
  ["docs/open/robotics-studio/release-cadence.md", ["quarterly-cadence.json", "verify-quarterly-cadence.mjs", "two consecutive quarterly releases", "dated maintainer approvals"]],
  ["docs/open/robotics-studio/launch-execution.md", ["launch-execution-evidence.json", "verify-launch-execution-evidence.mjs", "public YouTube URL", "written quote approval"]],
  ["docs/open/robotics-studio/product-partner-readiness.md", ["product-partner-readiness.json", "verify-product-partner-readiness.mjs", "DCO over CLA", "Do not mark partner readiness rows complete"]],
  ["opensource/robotics-studio-open/growth/top-of-funnel-experiments.json", ["robotics-studio-open-p4-growth", "hn-technical-follow-up", "programs-intake-cta-copy-test", "raw robot video"]],
  ["opensource/robotics-studio-open/community/channel-readiness.json", ["local-plan-live-channel-external", "#robotics-release-blockers", "deferred-past-ga", "raw robot media"]],
  ["opensource/robotics-studio-open/events/corl-2026-demo-kit.json", ["local-plan-event-acceptance-external", "CoRL 2026", "ICRA", "RSS", "raw robot video"]],
  ["opensource/robotics-studio-open/release/quarterly-cadence.json", ["local-plan-quarterly-releases-external", "2026-Q3", "2026-Q4", "two consecutive quarterly releases"]],
  ["opensource/robotics-studio-open/launch/launch-execution-evidence.json", ["local-plan-launch-actions-external", "11.5.1", "11.5.7", "source=robotics-studio-open-launch"]],
  ["opensource/robotics-studio-open/partners/product-partner-readiness.json", ["local-plan-partner-evidence-external", "P0.1", "OQ.9", "frontier-lab"]],
  ["opensource/robotics-studio-open/external/closure-gates.json", ["external-evidence-required", "11.1.1", "P0R.6", "Do not check any listed PRD row"]],
  ["opensource/robotics-studio-open/external/closure-evidence.json", ["missing-external-evidence", "11.1.1", "P0R.6", "External evidence not yet attached"]],
  ["opensource/robostudio-engine/src/robostudio_engine/plugins.py", ["PLUGIN_SCHEMA_ID", "validate_plugin_manifest", "entrypoint must stay inside the plugin directory"]],
  ["opensource/robostudio-engine/examples/plugins/hdf5_force_panel/manifest.json", ["ai.auraone.robostudio.plugins.hdf5_force_panel", "hdf5-force-profile", "force-drift-panel"]],
  ["opensource/robotics-studio/src/contracts.ts", ["PluginManifest", "PluginPanelSlot", "robostudio.plugin.v1", "CloudHandoffScenario", "explicit-preview-required"]],
  ["opensource/robotics-studio-open/scripts/verify-gpu-smoke.sh", ["nvidia-smi", "run-video-decode-smoke.sh"]],
  ["opensource/robotics-studio-open/scripts/build-release-artifacts.sh", ["src-tauri/tauri.conf.json", "ROBOTICS_STUDIO_OPEN_RELEASE_BLOCKER.txt", "exit 1"]],
  ["opensource/robotics-studio-open/scripts/publish-update-manifest.sh", ["CLOUDFLARE_API_TOKEN", "CLOUDFLARE_ACCOUNT_ID", "SHA256SUMS is required", "wrangler r2 object put"]],
  ["opensource/robotics-studio-open/docs/release/accessibility-audit-2026-05-13.md", ["verify-accessibility.sh", "screen-reader labels"]],
  ["opensource/robotics-studio-open/docs/release/dependency-license-scan-2026-05-13.md", ["No GPL", "Cargo.lock"]],
  ["opensource/robotics-studio-open/docs/release/engine-version-pins-2026-05-13.md", ["robostudio-engine", "0.1.0"]],
  ["opensource/robotics-studio-open/docs/release/external-security-review-packet-2026-05-13.md", ["Expanded Fuzz Campaign Required", "rosbag1 legacy fallback", "mp4", "Reviewer Deliverables"]],
  ["opensource/robotics-studio-open/docs/release/fuzz-smoke-2026-05-13.md", ["test_security_fuzz_smoke.py", "expanded malformed-media fuzz campaign"]],
  ["opensource/robotics-studio-open/docs/release/launch-execution-evidence-packet-2026-05-13.md", ["11.5.1 HN post scheduled", "11.5.7 Three named-account design partners running daily", "source=robotics-studio-open-launch", "verify-launch-execution-evidence.mjs"]],
  ["opensource/robotics-studio-open/docs/release/local-completion-audit-2026-05-13.md", ["Prompt-To-Artifact Checklist", "Placeholder-substitute guard", "Not Complete: Required External Blockers", "Do not call `update_goal` yet"]],
  ["opensource/robotics-studio-open/docs/release/package-metadata-2026-05-13.md", ["ai.auraone.roboticsstudio", "AuraOne.RoboticsStudioOpen"]],
  ["opensource/robotics-studio-open/docs/release/post-launch-growth-cadence-packet-2026-05-13.md", ["P4.5 top-of-funnel growth experiments", "P4.7 CoRL 2026 booth", "P4.8 quarterly release cadence", "Planning templates are not completion evidence", "verify-event-demo-kit.mjs", "verify-quarterly-cadence.mjs"]],
  ["opensource/robotics-studio-open/docs/release/product-partner-readiness-packet-2026-05-13.md", ["P0.1 team forming", "P0.6 naming sign-off", "P2.15 beta distribution", "OQ.9 DCO friction check", "verify-product-partner-readiness.mjs"]],
  ["opensource/robotics-studio-open/docs/release/risk-register-2026-05-13.md", ["R1", "R12"]],
  ["opensource/robotics-studio-open/docs/release/robostudio-engine-cve-scan-2026-05-13.md", ["pip_audit", "No known vulnerabilities found"]],
  ["opensource/robotics-studio-open/docs/release/sample-dataset-license-audit-2026-05-13.md", ["sample-so101", "MIT synthetic metadata"]],
  ["opensource/robotics-studio-open/docs/release/secrets-audit-2026-05-13.md", ["Gitleaks Docker CLI", "not `gitleaks/gitleaks-action@v2`", "no leaks found"]],
  ["opensource/robotics-studio-open/docs/release/remaining-external-actions-2026-05-13.md", ["11.1.1", "11.5.12", "P0R.6", "brew audit --cask --new robotics-studio-open", "Homebrew notability/tap policy"]],
  ["docs/open/robotics-studio/launch/podcast-outreach.md", ["TWIML AI", "Robot Brains", "Latent Space", "The Gradient", "source=robotics-studio-open-launch"]],
  ["opensource/robotics-studio-open/docs/release/community-channel-readiness-2026-05-13.md", ["#robotics-studio-open", "#robotics-dataset-adapters", "Verification Required Before Checking PRD Item 11.5.9", "verify-community-readiness.mjs", "deferred past GA"]],
  ["opensource/robotics-studio-open/docs/release/intake-terms-draft-2026-05-13.md", ["does not start paid work", "raw robot video", "Verification Required Before Approval"]],
  ["opensource/robotics-studio-open/docs/release/legal-review-packet-2026-05-13.md", ["11.1.1", "11.1.2", "11.1.3", "11.1.9", "11.1.11", "USPTO", "EUIPO"]],
  ["opensource/robotics-studio-open/docs/release/on-call-rotation-template-2026-05-13.md", ["First 14 calendar days", "Pending named human assignment", "Verification Required Before Checking PRD Item 11.5.12"]],
  ["opensource/robotics-studio-open/docs/release/telemetry-dashboard-spec-2026-05-13.md", ["Activation funnel", "Crash-free sessions", "Forbidden fields", "Verification Required Before Checking PRD Item 11.5.11"]],
  ["opensource/robotics-studio-open/docs/release/public-endpoint-probe-2026-05-13.md", ["robostudio-engine", "install.auraone.ai", "robotics-studio.auraone.ai"]],
  ["opensource/robotics-studio-open/docs/release/clean-install-verification-2026-05-13.md", ["PowerShell installer dry-run", "`pwsh` is available", "version `7.6.1`", "path-based `brew audit`", "brew audit --cask --new robotics-studio-open", "notability/tap policy"]],
  ["opensource/robotics-studio-open/docs/release/ci-performance-telemetry-validation-plan-2026-05-13.md", ["14 consecutive days", "verify-gpu-smoke.sh", "Crash-free session rate", "50,000-episode LeRobot"]],
  ["opensource/robotics-studio-open/docs/release/release-readiness-2026-05-13.md", ["Target-environment checks", "path-based `brew audit`", "Public blocker labels and release blocker issues #10-#32 are live", "planned blocker labels and public blocker issues exist", "Remaining Blockers"]],
  ["opensource/robotics-studio-open/docs/release/registry-reservations-2026-05-13.md", ["Live; blocker labels/issues applied", "public blocker labels and issues #10-#32 are live", "branch protection applied"]],
  ["opensource/robotics-studio-open/docs/release/release-registry-publication-packet-2026-05-13.md", ["gh workflow run release.yml", "twine check", "brew audit --cask --new robotics-studio-open", "install.auraone.ai/robotics-studio"]],
  ["docs/prds/robotics-studio-open-coverage-matrix.md", ["Prompt-to-artifact checklist", "Checkbox inventory", "Phased task inventory", "Non-checkbox requirement inventory", "Acceptance and success criteria", "Open questions and current decisions"]],
  ["docs/prds/robotics-studio-open-agent6-coverage-matrix.md", ["public blocker labels and issues are complete as of", "historical required", "verify-release-github-repo-state.mjs", "checkedFiles: 139", "executedLocalQaVerifiers: 30"]],
  ["opensource/open-studio-platform/installers/shared/install.sh", ["--dry-run", "install_path="]],
  ["opensource/open-studio-platform/installers/robotics-studio-open/install.ps1", ["Get-FileHash -Algorithm SHA256", "Checksum entry missing"]],
  ["opensource/open-studio-platform/distribution/homebrew/Casks/robotics-studio-open.rb", ["cask \"robotics-studio-open\"", "target: \"robostudio\""]],
  ["opensource/open-studio-platform/distribution/winget/AuraOne.RoboticsStudioOpen/0.1.0/AuraOne.RoboticsStudioOpen.installer.yaml", ["PackageIdentifier: AuraOne.RoboticsStudioOpen"]],
  ["opensource/open-studio-platform/distribution/winget/AuraOne.RoboticsStudioOpen/0.1.0/AuraOne.RoboticsStudioOpen.locale.en-US.yaml", ["PackageUrl: https://auraone.ai/open/robotics-studio"]],
  ["opensource/open-studio-platform/distribution/winget/AuraOne.RoboticsStudioOpen/0.2.0/AuraOne.RoboticsStudioOpen.locale.en-US.yaml", ["PackageUrl: https://auraone.ai/open/robotics-studio", "v0.2 robotics extensions"]],
  ["opensource/robotics-studio/package.json", ["@types/react", "@types/react-dom"]],
  ["opensource/robotics-studio/README.md", ["robostudio inspect /path/to/lerobot_dataset", "robostudio cluster /path/to/dataset --embedding clip --min-cluster-size 5", "robostudio export /path/to/dataset --to intake --out ./programs-intake.auraonepkg"]],
  ["opensource/robotics-studio/src/core.ts", ["robotics_reviewed_subset_manifest", "robotics_episode_reference", "robotics_sensor_qa_report", "cloudHandoffScenarios", "Robotics Studio Enterprise"]],
  ["opensource/robotics-studio/src/app.test.ts", ["robotics_reviewed_subset_manifest", "robotics_sensor_qa_report", "cloud handoff scenarios must cover"]],
  ["opensource/robotics-studio/src-tauri/tauri.conf.json", ["\"identifier\": \"ai.auraone.roboticsstudio\"", "updates.auraone.ai/robotics-studio-open"]],
  ["opensource/robotics-studio/src-tauri/src/lib.rs", ["manifest.json", "robotics_reviewed_subset_manifest", "robotics_episode_reference", "robotics_sensor_qa_report"]],
  ["opensource/robotics-studio/tests/platform-inheritance.test.ts", ["telemetry.schema.json", "robotics_export_completed", "crashReportsOptIn", "src-tauri/src/lib.rs"]],
  ["opensource/robostudio-engine/src/robostudio_engine/exports.py", ["INTAKE_SCHEMA_ID", "payload_manifest", "robotics_reviewed_subset_manifest", "robotics_episode_reference", "robotics_sensor_qa_report"]],
  ["opensource/robostudio-engine/src/robostudio_engine/exporters.py", ["INTAKE_SCHEMA_ID", "payload_manifest", "robotics_reviewed_subset_manifest", "robotics_failure_cluster", "robotics_sensor_qa_report"]],
  ["opensource/robostudio-engine/tests/test_adapters_index.py", ["test_folder_mp4_jsonl_prefers_prd_episode_manifest_layout", "cam_front.mp4", "episodes.jsonl", "state.jsonl", "actions.jsonl"]],
  ["opensource/robostudio-engine/tests/test_cli.py", ["test_cli_probe_byo_policy_adapter", "policy", "byo"]],
  ["opensource/robostudio-engine/tests/test_engine_features.py", ["robotics_reviewed_subset_manifest", "robotics_episode_reference", "robotics_sensor_qa_report"]],
  ["opensource/robostudio-engine/tests/test_engine_smoke.py", ["https://schemas.auraone.ai/open-studio/intake-packet/v1.json", "robotics-studio-open", "payload_manifest"]],
  ["opensource/robostudio-engine/tests/test_security_exports.py", ["intake-packet.schema.json", "intake-roles.json", "robotics_reviewed_subset_manifest", "robotics_episode_reference", "payload_manifest"]],
  ["opensource/robotics-studio/release/install.sh", ["open-studio-platform/installers/robotics-studio-open/install.sh", "exec"]],
  ["opensource/robotics-studio/release/homebrew-cask.rb", ["Robotics.Studio.Open_#{version}_aarch64.dmg", "target: \"robostudio\""]],
  ["opensource/robotics-studio/release/launch-blockers-2026-05-13.md", ["GitHub repo `auraoneai/robotics-studio-open` | Done", "opensource/open-studio-platform/installers/robotics-studio-open/install.sh"]],
]);

const forbiddenContentChecks = [
  {
    file: "docs/prds/robotics-studio-open-prd.md",
    patterns: [
      {
        pattern: /brew install --cask robotics-studio(?!-open)\b/,
        message: "uses stale Homebrew cask name; use robotics-studio-open and keep it planned until tap publication",
      },
      {
        pattern: /https:\/\/auraone\.ai\/open\/robotics-studio\/install\.sh/,
        message: "uses stale install script URL; use https://install.auraone.ai/robotics-studio and keep it planned until DNS/CDN publication",
      },
      {
        pattern: /brew audit --cask --new opensource\/open-studio-platform\/distribution\/homebrew\/Casks\/robotics-studio-open\.rb/,
        message: "uses unsupported path-based Homebrew cask audit; target-environment audit must use the published cask name",
      },
    ],
  },
  {
    file: "opensource/open-studio-platform/distribution/winget/AuraOne.RoboticsStudioOpen/0.1.0/AuraOne.RoboticsStudioOpen.locale.en-US.yaml",
    patterns: [
      {
        pattern: /PackageUrl:\s+https:\/\/auraone\.ai\/open\/robotics-studio-open\b/,
        message: "uses stale Robotics package URL; use the public /open/robotics-studio route",
      },
    ],
  },
  {
    file: "opensource/open-studio-platform/distribution/winget/AuraOne.RoboticsStudioOpen/0.2.0/AuraOne.RoboticsStudioOpen.locale.en-US.yaml",
    patterns: [
      {
        pattern: /PackageUrl:\s+https:\/\/roboticsstudio\.auraone\.ai\b/,
        message: "uses unreserved non-hyphenated Robotics Studio subdomain; use the public /open/robotics-studio route until DNS blockers close",
      },
    ],
  },
  {
    file: "opensource/robotics-studio/release/launch-blockers-2026-05-13.md",
    patterns: [
      {
        pattern: /Blocked on GitHub org admin token/,
        message: "still claims the GitHub repository is blocked after repo reservation was verified",
      },
      {
        pattern: /Point route to `release\/install\.sh`/,
        message: "points install DNS at the legacy release wrapper instead of the shared installer path",
      },
    ],
  },
  {
    file: "opensource/robotics-studio/README.md",
    patterns: [
      {
        pattern: /robostudio open\b/,
        message: "uses unsupported engine CLI command; use robostudio inspect for CLI dataset inspection",
      },
      {
        pattern: /--to auraone-programs\b/,
        message: "uses unsupported intake export target; use --to intake with --out",
      },
      {
        pattern: /--email\b/,
        message: "uses unsupported intake CLI email flag; email capture belongs in the desktop/Programs flow",
      },
      {
        pattern: /--encoder\b/,
        message: "uses unsupported clustering CLI flag; use --embedding",
      },
      {
        pattern: /--subset\b/,
        message: "uses unsupported export CLI subset flag; saved views remain desktop-side",
      },
    ],
  },
  {
    file: "opensource/robotics-studio-open/docs/release/launch-execution-evidence-packet-2026-05-13.md",
    patterns: [
      {
        pattern: /\bTBD\b/,
        message: "uses raw TBD placeholders; describe the pending external evidence explicitly",
      },
    ],
  },
  {
    file: "opensource/robotics-studio-open/docs/release/on-call-rotation-template-2026-05-13.md",
    patterns: [
      {
        pattern: /\bTBD\b/,
        message: "uses raw TBD placeholders; describe the pending human assignment explicitly",
      },
    ],
  },
  {
    file: "opensource/robotics-studio-open/docs/release/post-launch-growth-cadence-packet-2026-05-13.md",
    patterns: [
      {
        pattern: /\bTBD\b/,
        message: "uses raw TBD placeholders; describe the pending launch outcome evidence explicitly",
      },
    ],
  },
  {
    file: "opensource/robotics-studio-open/docs/release/product-partner-readiness-packet-2026-05-13.md",
    patterns: [
      {
        pattern: /\bTBD\b/,
        message: "uses raw TBD placeholders; describe the pending partner evidence explicitly",
      },
    ],
  },
  {
    file: "opensource/robotics-studio-open/.github/workflows/security-sbom-license.yml",
    patterns: [
      {
        pattern: /gitleaks\/gitleaks-action@v2/,
        message: "uses gitleaks-action, which requires an org license in the public release repo; use the Docker CLI scan",
      },
    ],
  },
  {
    file: "docs/prds/robotics-studio-open-coverage-matrix.md",
    patterns: [
      {
        pattern: /Deferred P4/,
        message: "uses deferred P4 language; represent unfinished P4 work as explicit blocked/product-roadmap work with next evidence",
      },
    ],
  },
  {
    file: "opensource/robotics-studio-open/docs/release/release-readiness-2026-05-13.md",
    patterns: [
      {
        pattern: /labels, and branch protection applied/,
        message: "claims GitHub labels are applied even though live drift shows missing planned labels",
      },
      {
        pattern: /label creation, and branch\s+protection succeeded/,
        message: "claims label creation succeeded even though live drift shows missing planned labels",
      },
    ],
  },
  {
    file: "opensource/robotics-studio-open/docs/release/registry-reservations-2026-05-13.md",
    patterns: [
      {
        pattern: /labels and branch protection applied/,
        message: "claims GitHub labels are applied even though live drift shows missing planned labels",
      },
    ],
  },
  {
    file: "opensource/robotics-studio-open/docs/release/clean-install-verification-2026-05-13.md",
    patterns: [
      {
        pattern: /PowerShell is not installed|No signed MSI, EV cert, or local PowerShell runtime|requires a host with `pwsh`/,
        message: "claims PowerShell is unavailable after local pwsh installer dry-run passed",
      },
    ],
  },
  {
    file: "opensource/robotics-studio-open/docs/release/release-readiness-2026-05-13.md",
    patterns: [
      {
        pattern: /does not have `pwsh`/,
        message: "claims pwsh is unavailable after local Windows installer dry-run passed",
      },
    ],
  },
  {
    file: "opensource/robotics-studio-open/docs/release/clean-install-verification-2026-05-13.md",
    patterns: [
      {
        pattern: /Cask draft is not published in the tap|Submit the cask to the AuraOne tap/,
        message: "claims Homebrew cask is not tapped after named cask audit reached the public tap",
      },
    ],
  },
];

const missing = [];
const failures = [];

function collectPrdCheckboxes(prdText) {
  const checkboxes = [];
  let section = null;
  let sectionIndex = 0;
  let inP0Reservations = false;
  let p0ReservationIndex = 0;

  for (const line of prdText.split(/\r?\n/)) {
    const sectionMatch = line.match(/^### (11\.\d+) /);
    if (sectionMatch) {
      section = sectionMatch[1];
      sectionIndex = 0;
      inP0Reservations = false;
    } else if (line.startsWith("### ") || line.startsWith("## ")) {
      section = null;
      sectionIndex = 0;
      inP0Reservations = false;
    }

    if (line.startsWith("#### 12.1.0 Name and registry reservations")) {
      section = null;
      inP0Reservations = true;
      p0ReservationIndex = 0;
    } else if (inP0Reservations && line.startsWith("#### ")) {
      inP0Reservations = false;
    }

    const checkboxMatch = line.match(/^- \[( |x)\] (.+)$/);
    if (!checkboxMatch) continue;

    if (section) {
      sectionIndex += 1;
      checkboxes.push({
        id: `${section}.${sectionIndex}`,
        checked: checkboxMatch[1] === "x",
        text: checkboxMatch[2],
      });
    } else if (inP0Reservations) {
      p0ReservationIndex += 1;
      checkboxes.push({
        id: `P0R.${p0ReservationIndex}`,
        checked: checkboxMatch[1] === "x",
        text: checkboxMatch[2],
      });
    }
  }

  return checkboxes;
}

function collectRunbookRows(runbookText) {
  const rows = new Map();

  for (const line of runbookText.split(/\r?\n/)) {
    if (!line.startsWith("| ") || line.includes("|---")) continue;

    const cells = line.split("|").slice(1, -1).map((cell) => cell.trim());
    if (cells.length < 5 || cells[0] === "PRD item") continue;
    rows.set(cells[0], {
      requirement: cells[1],
      owner: cells[2],
      action: cells[3],
      evidence: cells[4],
    });
  }

  return rows;
}

function runRequiredCommand(label, command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 50,
  });

  if (result.status !== 0) {
    failures.push(`${label} failed`);
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
  }

  return result;
}

function hasGithubCliAuth() {
  const result = spawnSync("gh", ["auth", "status", "--hostname", "github.com"], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 1024 * 1024,
  });

  return result.status === 0;
}

for (const file of requiredFiles) {
  if (!fs.existsSync(path.join(root, file))) {
    missing.push(file);
  }
}

for (const [file, snippets] of requiredSnippets.entries()) {
  const fullPath = path.join(root, file);
  const text = fs.existsSync(fullPath) ? fs.readFileSync(fullPath, "utf8") : "";
  for (const snippet of snippets) {
    if (!text.includes(snippet)) {
      failures.push(`${file}: missing "${snippet}"`);
    }
  }
}

for (const check of forbiddenContentChecks) {
  const fullPath = path.join(root, check.file);
  if (!fs.existsSync(fullPath)) {
    failures.push(`${check.file}: missing file for forbidden content check`);
    continue;
  }

  const text = fs.readFileSync(fullPath, "utf8");
  for (const { pattern, message } of check.patterns) {
    if (pattern.test(text)) {
      failures.push(`${check.file}: ${message}`);
    }
  }
}

const blockersPath = path.join(root, "opensource/robotics-studio-open/docs/release/blockers-2026-05-13.md");
const blockers = fs.existsSync(blockersPath) ? fs.readFileSync(blockersPath, "utf8") : "";
for (const area of ["Legal", "Trademark", "Sample dataset IP", "Security", "Signing", "PyPI", "Homebrew", "DNS", "Hugging Face", "CI", "Accessibility", "Performance", "Launch"]) {
  if (!blockers.includes(area)) failures.push(`blockers missing area: ${area}`);
}

const prdPath = path.join(root, "docs/prds/robotics-studio-open-prd.md");
const externalActionsPath = path.join(root, "opensource/robotics-studio-open/docs/release/remaining-external-actions-2026-05-13.md");
const prdText = fs.existsSync(prdPath) ? fs.readFileSync(prdPath, "utf8") : "";
const externalActionsText = fs.existsSync(externalActionsPath) ? fs.readFileSync(externalActionsPath, "utf8") : "";
const uncheckedPrdItems = collectPrdCheckboxes(prdText).filter((item) => !item.checked);
const checkedPrdItems = collectPrdCheckboxes(prdText).filter((item) => item.checked);
const externalActionRows = collectRunbookRows(externalActionsText);

for (const item of uncheckedPrdItems) {
  const row = externalActionRows.get(item.id);
  if (!row) {
    failures.push(`remaining external action runbook missing unchecked PRD item ${item.id}: ${item.text}`);
  } else if (!row.owner || !row.action || !row.evidence) {
    failures.push(`remaining external action runbook row ${item.id} lacks owner, action, or evidence`);
  }
}

for (const id of externalActionRows.keys()) {
  if (!uncheckedPrdItems.some((item) => item.id === id)) {
    failures.push(`remaining external action runbook has no matching unchecked PRD item: ${id}`);
  }
}

const coverageMatrixPath = path.join(root, "docs/prds/robotics-studio-open-coverage-matrix.md");
const coverageMatrix = fs.existsSync(coverageMatrixPath) ? fs.readFileSync(coverageMatrixPath, "utf8") : "";
const staleOpenCoverageRows = coverageMatrix
  .split(/\r?\n/)
  .filter((line) => line.startsWith("| ") && /\|\s*Open\s*\|/.test(line));
for (const line of staleOpenCoverageRows) {
  failures.push(`coverage matrix has stale Open status row: ${line}`);
}

const checkboxCountSummary = `${checkedPrdItems.length} checked, ${uncheckedPrdItems.length} unchecked`;
if (!coverageMatrix.includes(checkboxCountSummary)) {
  failures.push(`coverage matrix missing current checkbox summary: ${checkboxCountSummary}`);
}

const docsLinkVerifier = spawnSync(process.execPath, [
  path.join(root, "opensource/robotics-studio-open/scripts/verify-doc-links.mjs"),
], {
  cwd: root,
  encoding: "utf8",
});
if (docsLinkVerifier.status !== 0) {
  failures.push("robotics docs link verifier failed");
  if (docsLinkVerifier.stdout) process.stdout.write(docsLinkVerifier.stdout);
  if (docsLinkVerifier.stderr) process.stderr.write(docsLinkVerifier.stderr);
}

const localQaVerifiers = [
  ["robotics engine pytest verifier", "bash", ["-lc", "PYTHONPATH=opensource/robostudio-engine/src python -m pytest -q opensource/robostudio-engine/tests"]],
  ["robotics accessibility verifier", "bash", [path.join(root, "opensource/robotics-studio-open/scripts/verify-accessibility.sh")]],
  ["robotics performance baseline verifier", "bash", [path.join(root, "opensource/robotics-studio-open/scripts/verify-performance-baseline.sh")]],
  ["robotics security review verifier", "bash", [path.join(root, "opensource/robotics-studio-open/scripts/verify-security-review.sh")]],
  ["robotics launch asset verifier", process.execPath, [path.join(root, "opensource/robotics-studio-open/scripts/verify-launch-assets.mjs")]],
  ["robotics public endpoint probe", process.execPath, [path.join(root, "opensource/robotics-studio-open/scripts/verify-public-endpoint-probe.mjs")]],
  ["robotics release credential preflight", process.execPath, [path.join(root, "opensource/robotics-studio-open/scripts/verify-release-credential-preflight.mjs")]],
  ["robotics branch publication state verifier", process.execPath, [path.join(root, "opensource/robotics-studio-open/scripts/verify-current-branch-publication-state.mjs")]],
  ["robotics execution prompt coverage verifier", process.execPath, [path.join(root, "opensource/robotics-studio-open/scripts/verify-execution-prompt-coverage.mjs")]],
  ["robotics growth experiment verifier", process.execPath, [path.join(root, "opensource/robotics-studio-open/scripts/verify-growth-experiments.mjs")]],
  ["robotics community readiness verifier", process.execPath, [path.join(root, "opensource/robotics-studio-open/scripts/verify-community-readiness.mjs")]],
  ["robotics event demo kit verifier", process.execPath, [path.join(root, "opensource/robotics-studio-open/scripts/verify-event-demo-kit.mjs")]],
  ["robotics quarterly cadence verifier", process.execPath, [path.join(root, "opensource/robotics-studio-open/scripts/verify-quarterly-cadence.mjs")]],
  ["robotics launch execution evidence verifier", process.execPath, [path.join(root, "opensource/robotics-studio-open/scripts/verify-launch-execution-evidence.mjs")]],
  ["robotics product partner readiness verifier", process.execPath, [path.join(root, "opensource/robotics-studio-open/scripts/verify-product-partner-readiness.mjs")]],
  ["robotics release blocker template verifier", process.execPath, [path.join(root, "opensource/robotics-studio-open/scripts/verify-release-blocker-template.mjs")]],
  ["robotics external closure gates verifier", process.execPath, [path.join(root, "opensource/robotics-studio-open/scripts/verify-external-closure-gates.mjs")]],
  ["robotics external closure evidence verifier", process.execPath, [path.join(root, "opensource/robotics-studio-open/scripts/verify-external-closure-evidence.mjs")]],
  ["robotics external closure evidence template verifier", process.execPath, [path.join(root, "opensource/robotics-studio-open/scripts/verify-external-closure-evidence-template.mjs")]],
  ["robotics external blocker live evidence verifier", process.execPath, [path.join(root, "opensource/robotics-studio-open/scripts/verify-external-blocker-live-evidence.mjs")]],
  ["robotics release blocker issue payload verifier", process.execPath, [path.join(root, "opensource/robotics-studio-open/scripts/verify-release-blocker-issues.mjs")]],
  ["robotics release blocker issue draft verifier", process.execPath, [path.join(root, "opensource/robotics-studio-open/scripts/verify-release-blocker-issue-drafts.mjs")]],
  ["robotics release blocker issue creation verifier", process.execPath, [path.join(root, "opensource/robotics-studio-open/scripts/verify-release-blocker-issue-creation.mjs")]],
  ["robotics release blocker label verifier", process.execPath, [path.join(root, "opensource/robotics-studio-open/scripts/verify-release-blocker-labels.mjs")]],
  ["robotics release blocker live preflight", process.execPath, [path.join(root, "opensource/robotics-studio-open/scripts/verify-release-blocker-live-preflight.mjs")]],
  ["robotics release GitHub repo state verifier", process.execPath, [path.join(root, "opensource/robotics-studio-open/scripts/verify-release-github-repo-state.mjs")]],
  ["robotics release GitHub live drift verifier", process.execPath, [path.join(root, "opensource/robotics-studio-open/scripts/verify-release-github-live-drift.mjs")]],
  ["robotics release GitHub Actions history verifier", process.execPath, [path.join(root, "opensource/robotics-studio-open/scripts/verify-release-github-actions-history.mjs")]],
  ["robotics release blocker apply plan verifier", process.execPath, [path.join(root, "opensource/robotics-studio-open/scripts/verify-release-blocker-apply-plan.mjs")]],
  ["robotics PRD final audit verifier", process.execPath, [path.join(root, "opensource/robotics-studio-open/scripts/verify-prd-final-audit.mjs")]],
];

for (const [label, command, args] of localQaVerifiers) {
  runRequiredCommand(label, command, args);
}

const powershellCacheRoot = fs.mkdtempSync(path.join(os.tmpdir(), "robotics-pwsh-cache-"));
let windowsInstallerDryRun;
try {
  windowsInstallerDryRun = spawnSync("pwsh", [
    "-NoLogo",
    "-NoProfile",
    "-File",
    path.join(root, "opensource/open-studio-platform/installers/robotics-studio-open/install.ps1"),
    "-DryRun",
  ], {
    cwd: root,
    encoding: "utf8",
    env: {
      ...process.env,
      XDG_CACHE_HOME: powershellCacheRoot,
    },
    maxBuffer: 1024 * 1024,
  });
} finally {
  fs.rmSync(powershellCacheRoot, { recursive: true, force: true });
}
if (
  windowsInstallerDryRun.status !== 0 ||
  !windowsInstallerDryRun.stdout.includes("manifest=https://updates.auraone.ai/release-evidence/robotics-studio-open/stable.json") ||
  !windowsInstallerDryRun.stdout.includes("install_path=\\Programs\\Robotics Studio Open\\robostudio.exe")
) {
  failures.push("robotics Windows installer PowerShell dry-run failed");
  if (windowsInstallerDryRun.stdout) process.stdout.write(windowsInstallerDryRun.stdout);
  if (windowsInstallerDryRun.stderr) process.stderr.write(windowsInstallerDryRun.stderr);
}

const releaseGuardTmp = fs.mkdtempSync(path.join(os.tmpdir(), "robotics-release-guard-"));
try {
  fs.copyFileSync(
    path.join(root, "opensource/robotics-studio-open/scripts/build-release-artifacts.sh"),
    path.join(releaseGuardTmp, "build-release-artifacts.sh"),
  );
  const releaseGuard = spawnSync("bash", ["build-release-artifacts.sh", "0.1.0", "dmg"], {
    cwd: releaseGuardTmp,
    encoding: "utf8",
  });
  const blockerPath = path.join(releaseGuardTmp, "dist/ROBOTICS_STUDIO_OPEN_RELEASE_BLOCKER.txt");
  if (releaseGuard.status !== 1 || !fs.existsSync(blockerPath)) {
    failures.push("robotics release artifact guard did not fail closed when build inputs were missing");
    if (releaseGuard.stdout) process.stdout.write(releaseGuard.stdout);
    if (releaseGuard.stderr) process.stderr.write(releaseGuard.stderr);
  }
} finally {
  fs.rmSync(releaseGuardTmp, { recursive: true, force: true });
}

const updateManifestTmp = fs.mkdtempSync(path.join(os.tmpdir(), "robotics-update-manifest-"));
try {
  const binDir = path.join(updateManifestTmp, "bin");
  const artifactsDir = path.join(updateManifestTmp, "artifacts");
  fs.mkdirSync(binDir, { recursive: true });
  fs.mkdirSync(artifactsDir, { recursive: true });
  fs.copyFileSync(
    path.join(root, "opensource/robotics-studio-open/scripts/publish-update-manifest.sh"),
    path.join(updateManifestTmp, "publish-update-manifest.sh"),
  );
  const fakeWrangler = path.join(binDir, "wrangler");
  fs.writeFileSync(fakeWrangler, "#!/usr/bin/env bash\necho wrangler should not run >&2\nexit 99\n", { mode: 0o755 });
  const updateManifestGuard = spawnSync("bash", ["publish-update-manifest.sh", "0.1.0", "beta", artifactsDir], {
    cwd: updateManifestTmp,
    encoding: "utf8",
    env: {
      ...process.env,
      CLOUDFLARE_API_TOKEN: "dummy-token-for-negative-path",
      CLOUDFLARE_ACCOUNT_ID: "dummy-account-for-negative-path",
      PATH: `${binDir}${path.delimiter}${process.env.PATH || ""}`,
    },
  });
  if (updateManifestGuard.status !== 1 || !updateManifestGuard.stderr.includes("SHA256SUMS is required")) {
    failures.push("robotics update manifest publisher did not fail before wrangler when SHA256SUMS was missing");
    if (updateManifestGuard.stdout) process.stdout.write(updateManifestGuard.stdout);
    if (updateManifestGuard.stderr) process.stderr.write(updateManifestGuard.stderr);
  }
} finally {
  fs.rmSync(updateManifestTmp, { recursive: true, force: true });
}

if (missing.length || failures.length) {
  console.error("Robotics release ops verification failed.");
  for (const file of missing) console.error(`missing: ${file}`);
  for (const failure of failures) console.error(`invalid: ${failure}`);
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  checkedFiles: requiredFiles.length,
  checkedPrdItems: checkedPrdItems.length,
  uncheckedPrdItems: uncheckedPrdItems.length,
  externalActionRows: externalActionRows.size,
  staleCoverageOpenRows: staleOpenCoverageRows.length,
  executedLocalQaVerifiers: localQaVerifiers.length,
  windowsInstallerDryRun: true,
  externalAccess: {
    githubToken: Boolean(process.env.GH_TOKEN || process.env.GITHUB_TOKEN),
    githubCliAuth: hasGithubCliAuth(),
    pypiToken: Boolean(process.env.PYPI_API_TOKEN),
    hfToken: Boolean(process.env.HF_TOKEN || process.env.HUGGINGFACE_HUB_TOKEN),
    cloudflareToken: Boolean(process.env.CLOUDFLARE_API_TOKEN),
    appleSigning: Boolean(process.env.APPLE_ID && process.env.APPLE_TEAM_ID && process.env.APPLE_APP_SPECIFIC_PASSWORD),
    windowsSigning: Boolean(process.env.WINDOWS_EV_CERT_THUMBPRINT),
  },
  blockerRegister: "opensource/robotics-studio-open/docs/release/blockers-2026-05-13.md",
}, null, 2));
