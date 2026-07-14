# Platform v0.1 Security Review Checklist

Owner: Platform Security
Applies to: Open Studio Platform v0.1 and Rubric Studio Open handoff
Status: Required before any v0.1 release candidate is promoted to GA

## Evidence Rules

- Every checked item must link to a command output, CI run, release artifact, issue, or signed reviewer note.
- External dependencies that cannot be completed locally, such as a paid third-party audit or DNS provisioning, remain unchecked with a dated blocker and exact next action.
- Security sign-off is not valid if any required automated check is skipped.

## Supply Chain

- [ ] `cargo deny check --config opensource/open-studio-platform/configs/cargo-deny/deny.toml` passes for every platform crate.
- [ ] `cargo audit --config opensource/open-studio-platform/configs/cargo-audit/audit.toml` passes for every Cargo lockfile.
- [ ] `pnpm audit --prod --audit-level high` or the equivalent package-manager audit passes for every shipped Node package.
- [ ] `node opensource/open-studio-platform/compliance/scripts/check-npm-licenses.mjs` passes for every shipped package.
- [ ] No GPL or AGPL dependency is linked into any shipped desktop binary.
- [ ] LGPL dependencies, if any, are dynamically linked and recorded in `compliance/licensing/lgpl-dynamic-linking-register.md`.
- [ ] A CycloneDX SBOM is generated and attached to the release.
- [ ] Third-party license notices are generated and reviewed against `compliance/licensing/NOTICE.template.md`.

## Secrets And Signing

- [ ] `gitleaks detect --config opensource/open-studio-platform/configs/gitleaks/gitleaks.toml --redact` passes.
- [ ] GitHub Actions secrets are referenced only by name and are never echoed.
- [ ] macOS, Windows, Linux, GPG, and Tauri updater signing keys have documented owners, storage, rotation, and revocation.
- [ ] No API keys, tokens, cloud credentials, signing keys, or Sentry DSNs are embedded in source, test fixtures, or binaries.

## Desktop Trust Contract

- [ ] Tauri CSP and capabilities are reviewed against the current template.
- [ ] Every outbound destination is listed in the security docs and reflected in Tauri CSP.
- [ ] OS keychain behavior is verified on macOS, Windows, Linux Secret Service, and Linux encrypted fallback.
- [ ] Update manifests are signed, verified before install, and honor the kill-switch path.
- [ ] Crash reporting is opt-in, default off, scrubbed, and uses the approved Sentry project.

## Telemetry And Privacy

- [ ] `node opensource/open-studio-platform/compliance/scripts/check-telemetry-forbidden-fields.mjs --self-test` passes.
- [ ] Telemetry is opt-in and default off.
- [ ] Every telemetry event is registered, schema-valid, and visible in the in-app telemetry log.
- [ ] No event includes content, prompts, file paths, secrets, tokens, raw traces, email, or unredacted user text.
- [ ] Crash and telemetry consent copy is reviewed by Platform Security and Legal.

## Intake Packets

- [ ] `node opensource/open-studio-platform/compliance/scripts/check-intake-privacy-exclusions.mjs --self-test` passes.
- [ ] `.auraonepkg` manifests include required privacy exclusions.
- [ ] Display name and email are populated only from explicit user input.
- [ ] Intake packaging refuses secrets, API keys, tokens, raw credentials, OS usernames, git identity, and unintended PII.
- [ ] The privacy preview accurately lists every payload and exclusion before upload.
- [ ] Staging intake upload validates packet signatures, schema, payload roles, size limits, and error paths.

## Release Readiness

- [ ] Security disclosure docs, support SLA, maintainer responsibilities, and community-channel docs are published.
- [ ] DCO checks are active on the platform repo and flagship repos.
- [ ] CODEOWNERS or equivalent branch protection requires Platform Security review for security, telemetry, updater, keychain, intake, signing, and release changes.
- [ ] Third-party security audit is completed or remains unchecked with a dated blocker and vendor next action.
- [ ] Final reviewer signs the release notes with the exact commit SHA, SBOM hash, and CI run URL.
