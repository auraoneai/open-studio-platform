# Maintainer Security Responsibilities

Platform maintainers are responsible for preserving the shared trust contract across Rubric Studio Open, Robotics Studio Open, Agent Studio Open, and the Open Studio Platform.

## Required Reviews

Platform Security review is required for changes to:

- Tauri capabilities, CSP, deep links, IPC, file-system access, and sidecar execution.
- OS keychain code and IPC wrappers that touch secrets.
- Update manifests, signing, notarization, release workflows, installer scripts, and checksums.
- Telemetry schema, event registry, transport, consent UI, event log, and scrubbing.
- Crash reporting, minidump collection, Sentry configuration, and scrubbing.
- `.auraonepkg` manifests, role registry, redaction, preview, upload transport, and Cloud import behavior.
- Dependency policy, license policy, SBOM generation, DCO enforcement, and disclosure docs.

## Triage Duties

- Triage security reports according to `support/SLA.md`.
- Keep private issues private until disclosure is approved.
- Add release-blocking labels for active vulnerabilities, secret leaks, signing failures, update integrity failures, and telemetry or intake privacy regressions.
- Ensure every release has an SBOM, dependency audit result, license scan result, secret scan result, and security checklist sign-off.

## Community Duties

- Route general support to GitHub Issues.
- Route security disclosures to `security@auraone.ai`.
- Avoid requesting users to paste secrets, tokens, private prompts, local file paths, traces, or proprietary datasets into public issues.
- Redact sensitive data from maintainer-authored examples and reproduction cases.
