# Rubric Studio Open Threat Model

Date: 2026-05-13
Owner: Platform Security

## Assets

- User-authored rubric criteria, samples, calibration sets, and judge prompts.
- BYO provider API keys stored through the platform keychain abstraction.
- Per-install telemetry and crash consent settings.
- `.auraonepkg` intake packets and local outbox contents.
- Signed update manifests and release artifacts.

## Trust Boundaries

- Renderer to Tauri IPC.
- Tauri core to Python sidecar subprocesses.
- Local project files to validators, preview, and export adapters.
- Desktop app to update, telemetry, crash, and intake endpoints.
- Release CI to signing/notarization/HSM operations.

## Primary Risks And Controls

| Risk                                                      | Control                                                                                       | Evidence                                        |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Malicious project file triggers renderer script execution | Strict CSP, no `unsafe-eval`, schema parsing before rendering, no untrusted HTML injection    | Tauri config review and Semgrep gate            |
| API key leaks to disk or network                          | OS keychain API only; telemetry schema blocks secret fields; intake redaction blocks API keys | Keychain tests, telemetry tests, intake preview |
| Sidecar process escapes intended scope                    | JSON-line protocol, explicit executable registry, subprocess timeouts and crash isolation     | Sidecar sandbox tests                           |
| Update channel compromise                                 | Ed25519-signed updater manifests, SHA256SUMS, signed artifacts, release attestations          | Release workflow and updater verifier tests     |
| Intake export sends unexpected content                    | Explicit click only, full preview, redaction policy, cancel sends nothing                     | Intake e2e and packet schema tests              |
| GPL contamination in shipped app                          | License denylist in Node/Rust/Python scans; NOTICE generation before release                  | License scan artifacts                          |

## Required Fresh-Machine Checks

- macOS 14 or newer, Apple Silicon and Intel where available.
- Windows 11 x64 and ARM64 where available.
- Ubuntu 24.04 x64 AppImage path.

Unsupported target checks remain blockers until run on real hardware or a trusted hosted runner.
