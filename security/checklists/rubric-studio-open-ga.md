# Rubric Studio Open GA Security Review Checklist

Date opened: 2026-05-13
Owner: Platform Security
Scope: Rubric Studio Open desktop, browser edition, VS Code extension, CLI, release pipeline, update channel, intake export path.

## Automated Gates

- [ ] Dependency vulnerability scan passes for Node, Rust, and Python release surfaces.
- [ ] Secret scanning passes with `opensource/open-studio-platform/configs/gitleaks/gitleaks.toml`. Current scoped Open Studio/Rubric/Robotics/Agent tree scans pass as of 2026-05-19; the repository-wide git-history scan still reports 33 redacted pre-existing `generic-private-key` findings and remains open for history cleanup or reviewed baseline approval.
- [x] Semgrep static analysis passes with `opensource/open-studio-platform/configs/semgrep/security.yml`. Verified 2026-05-19 with `uvx semgrep --config ...` across Open Studio Platform, Rubric, Robotics, and Agent paths; 0 findings.
- [ ] CycloneDX SBOM generated and attached to the release.
- [ ] License scan confirms no GPL, AGPL, SSPL, BUSL, Commons Clause, PolyForm, Elastic License, or unapproved LGPL linkage.
- [ ] Telemetry schema validator is in CI and rejects forbidden PII/content fields.
- [ ] Crash reporter scrubber tests cover API keys, paths, hostnames, emails, and prompt/sample text.
- [ ] Intake packet schema tests validate preview, cancel, and explicit-send paths.
- [ ] Tauri CSP has no `unsafe-eval`; all added ACL capabilities have Platform owner review.

## Manual Security Review

- [ ] Threat model is reviewed and signed by Platform owner.
- [ ] Network destinations are documented in `SECURITY.md`.
- [ ] No-network mode opens, edits, validates, and exports a local project.
- [ ] macOS signed and notarized DMG installs on a fresh machine without Gatekeeper override.
- [ ] Windows signed MSI installs on a fresh Windows 11 x64 machine.
- [ ] Linux AppImage signature verification and install script pass on Ubuntu 24.04.
- [ ] Auto-update stable channel verifies signed manifest before download.
- [ ] Crash reporting is default off; opt-in sends only scrubbed crash metadata.
- [ ] Telemetry is default off; event log shows every queued event before send.
- [ ] Keychain stores BYO API keys on every supported OS; no plaintext fallback unless the user explicitly accepts Linux file fallback.
- [ ] Intake export preview shows the full packet; cancel sends nothing; send returns a Cloud intake URL.
- [ ] Engine subprocess crash does not crash the desktop shell.
- [ ] Independent security reviewer report is filed or a launch blocker remains open.

## Sign-off

Security reviewer:

Platform owner:

Release manager:
