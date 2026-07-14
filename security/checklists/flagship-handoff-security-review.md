# Flagship Handoff Security Review

Owner: Platform Security
Applies to: Rubric Studio Open, Robotics Studio Open, Agent Studio Open

Use this checklist when a flagship consumes or updates the Open Studio Platform template, crates, release workflows, telemetry schema, intake schema, or support process.

## Shared Platform Adoption

- [ ] The flagship uses the current `opensource/open-studio-platform/templates/tauri-app/` template without local security relaxations.
- [ ] All platform crates are pinned to the approved release tag.
- [ ] Any flagship-specific platform extension is reviewed by Platform Security.
- [ ] The flagship docs link to the canonical Platform privacy, disclosure, support, DCO, and license pages.

## Flagship-Specific Privacy

- [ ] Product-specific telemetry events are registered and validated by the shared schema.
- [ ] Product-specific intake payload roles are registered in the shared intake role registry.
- [ ] No product-specific payload includes secrets, raw prompts, user text, file paths, credentials, or PII outside explicit intake fields.
- [ ] Product-specific privacy copy matches the actual data flow.

## Flagship-Specific Security

- [ ] Threat model document is published and answers the worst credible malicious project-file outcome for the flagship.
- [ ] Permission review documents every OS permission the app requests in `SECURITY.md`.
- [ ] Network audit lists every outbound destination in `SECURITY.md` and reflects each destination in Tauri CSP.
- [ ] Telemetry audit maps every registered event to a payload schema and verifies no PII/content fields.
- [ ] No-network mode opens, edits, validates, and exports a local project with networking disabled.
- [ ] Code signing is verified by installing and validating artifacts on fresh macOS, Windows, and Linux images.
- [ ] macOS notarization is verified by Gatekeeper on a fresh macOS install.
- [ ] Stable update-channel signing is verified by installing an older signed build, triggering an update, and observing signature verification.
- [ ] Crash reporter opt-in flow defaults off and starts reporting only after explicit opt-in.
- [ ] Telemetry opt-in flow defaults off, starts reporting only after explicit opt-in, and exposes the user-visible event log.
- [ ] Keychain integration is verified on every supported OS backend.
- [ ] Intake packet flow shows the full preview, cancel sends nothing, and send produces a valid Cloud intake entry.
- [ ] Product sidecars are sandboxed, version-pinned, and covered by dependency scans.
- [ ] Product sidecar subprocess limits are enforced, and child crashes do not crash the desktop shell.
- [ ] Product parser surfaces are fuzzed or otherwise validated for malformed input.
- [ ] Product sample data is synthetic or has documented redistribution rights.
- [ ] Product-specific external endpoints are documented, optional where possible, and visible to users.
- [ ] No `__TAURI__` shell exposure exists beyond approved commands and capabilities.

## Release Evidence

- [ ] Security CI workflow passed on the release commit.
- [ ] SBOM and NOTICE files are attached to the release.
- [ ] Platform Security sign-off is recorded in the release notes with the exact commit SHA, SBOM hash, and CI run URL.
- [ ] Remaining external blockers are dated and assigned.

## Per-Flagship Addenda

Rubric Studio Open:

- [ ] Rubric, sample, judge-card, eval-run-manifest, and contamination payloads are redacted before intake packaging.
- [ ] BYO LLM provider keys never leave the OS keychain.

Robotics Studio Open:

- [ ] Video decoder, ROS bag, dataset import, and sensor stream paths are covered by parser hardening tests.
- [ ] Example robotics datasets have documented licenses.

Agent Studio Open:

- [ ] MCP traces and tool-call payloads are scrubbed before telemetry, crash, or intake use.
- [ ] Tool names, server URLs, and trace IDs are treated as potentially sensitive unless explicitly redacted.
