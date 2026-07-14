# Agent Studio Open GA Security Review Checklist

Date opened: 2026-05-13
Owner: Platform Security
Scope: Agent Studio Open desktop app, browser edition if shipped, MCP server integrations, trace replay, tool-call inspection, release pipeline, update channel, and intake export path.

## Automated Gates

- [ ] Dependency vulnerability scan passes for Node, Rust, Python, and packaged MCP integration surfaces.
- [ ] Secret scanning passes with `opensource/open-studio-platform/configs/gitleaks/gitleaks.toml`.
- [ ] Semgrep static analysis passes with `opensource/open-studio-platform/configs/semgrep/security.yml`.
- [ ] CycloneDX SBOM generated and attached to the release.
- [ ] License scan confirms no GPL, AGPL, SSPL, BUSL, Commons Clause, PolyForm, Elastic License, or unapproved LGPL linkage.
- [ ] Telemetry schema validator rejects prompts, raw tool arguments, tool responses, file paths, secrets, tokens, MCP server URLs, and unredacted trace IDs.
- [ ] Crash reporter scrubber tests cover API keys, prompts, tool arguments, stack traces, paths, hostnames, emails, and MCP connection strings.
- [ ] Intake packet schema tests validate preview, cancel, explicit-send, trace redaction, and rejected-secret paths.
- [ ] Tauri CSP has no `unsafe-eval`; all added ACL capabilities have Platform owner review.

## Manual Security Review

- [ ] Threat model is reviewed and signed by Platform owner.
- [ ] Permission review documents every OS permission in `SECURITY.md`.
- [ ] Network audit lists every outbound destination, including MCP servers and model-provider endpoints, in `SECURITY.md` and Tauri CSP.
- [ ] Telemetry audit maps every registered event to a payload schema and verifies no PII/content fields.
- [ ] No-network mode opens, edits, replays, and exports a local trace/project with networking disabled.
- [ ] macOS signed and notarized DMG installs on a fresh machine without Gatekeeper override.
- [ ] Windows signed MSI installs on a fresh Windows 11 x64 machine.
- [ ] Linux AppImage signature verification and install script pass on Ubuntu 24.04.
- [ ] Auto-update stable channel verifies signed manifest before download.
- [ ] Crash reporting is default off; opt-in sends only scrubbed crash metadata.
- [ ] Telemetry is default off; event log shows every queued event before send.
- [ ] Keychain stores provider keys, MCP credentials, Sentry credentials, and Cloud tokens on every supported OS; no plaintext fallback unless the user explicitly accepts Linux file fallback.
- [ ] Intake export preview shows the full packet; cancel sends nothing; send returns a Cloud intake URL.
- [ ] MCP server subprocess limits are enforced; child crashes, malformed JSON-RPC, and hung tools do not crash the desktop shell.
- [ ] No `__TAURI__` shell exposure exists beyond approved commands and capabilities.
- [ ] Independent security reviewer report is filed or a launch blocker remains open.

## Agent-Specific Checks

- [ ] MCP traces and tool-call payloads are scrubbed before telemetry, crash, or intake use.
- [ ] Tool names, server URLs, and trace IDs are treated as sensitive unless explicitly redacted.
- [ ] Prompt, completion, scratchpad, chain-of-thought, tool output, environment variable, and clipboard contents are excluded from telemetry and crash reports.
- [ ] Untrusted MCP servers run with least privilege and cannot request filesystem, shell, network, or credential access outside explicit user-approved scopes.
- [ ] Trace replay fixtures include malformed tool calls, oversized payloads, secret-looking values, and non-UTF-8 bytes.
- [ ] Model-provider keys never leave the OS keychain and are never included in support bundles.

## Sign-off

Security reviewer:

Platform owner:

Release manager:
