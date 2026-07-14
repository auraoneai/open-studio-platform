# Security Policy

Report vulnerabilities privately to `security@auraone.ai`.

PGP key: pending publication at `https://auraone.ai/open/security/pgp.txt`.

## What To Report

Report suspected vulnerabilities in the Tauri shell, updater, signing pipeline, installer scripts, intake packet handling, telemetry or crash privacy controls, keychain storage, release artifacts, docs deployment, or any flagship-specific parser or sidecar that could affect user data or local machines.

Do not open public GitHub issues for leaked secrets, signing-key issues, update compromise, remote code execution, privilege escalation, intake privacy bugs, telemetry privacy bugs, keychain bypasses, or supply-chain compromise.

## Response Targets

| Severity | First response | Target fix |
|---|---:|---:|
| SEV-1 active exploit | 24 hours | 7 days |
| SEV-2 no active exploit | 48 hours | 30 days |
| Other security issue | 5 business days | next planned release when practical |

## Safe Harbor

Good-faith research that avoids privacy violations, data destruction, persistence, social engineering, and service disruption is authorized. We will not pursue legal action for research that follows this policy.

## Researcher Credit

We credit reporters in the security advisory unless they request anonymity, the report is duplicate, or public credit would increase user risk before remediation is available.

## Outbound Destinations

- `https://updates.auraone.ai` for signed update manifests and release artifacts.
- `https://intake.auraone.ai/v1/packets/` only after explicit user consent in the intake preview.
- `https://o.auraone.ai/v1/events` only when telemetry is opted in.
- Sentry DSN configured per flagship only when crash reporting is opted in.
