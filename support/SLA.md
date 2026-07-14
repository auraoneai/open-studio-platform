# AuraOne Open Support SLA

This SLA covers Open Studio Platform issues and shared platform issues in Rubric Studio Open, Robotics Studio Open, and Agent Studio Open.

## Channels

- Security disclosures: `security@auraone.ai`
- Product bugs and support: GitHub Issues in the relevant repository
- Community discussion: AuraOne Open Discord channels listed in `community/channels.md`
- Maintainer escalation: private maintainer channel for active incidents only

## Response Targets

| Category        | Examples                                                                                          | First response   | Target action                            |
| --------------- | ------------------------------------------------------------------------------------------------- | ---------------- | ---------------------------------------- |
| SEV-1 security  | Active exploit, signing-key compromise, update compromise, secret leak, remote code execution     | 24 hours         | Patched release or mitigation in 7 days  |
| SEV-2 security  | Confirmed vulnerability without active exploit, telemetry or intake privacy leak, keychain bypass | 48 hours         | Patched release or mitigation in 30 days |
| SEV-3 bug       | Crash, data loss risk, broken install or update, intake upload failure                            | 3 business days  | Triage, workaround, or fix plan          |
| General bug     | UI defect, docs bug, non-blocking workflow issue                                                  | 5 business days  | Triage and backlog decision              |
| Feature request | New capability or integration                                                                     | 10 business days | Accept, decline, or request design       |
| Community PR    | External code contribution                                                                        | 5 business days  | First maintainer review                  |
| Maintainer PR   | Code owner change                                                                                 | 1 business day   | Review by required owner                 |

## Boundaries

- Do not request secrets, API keys, full local file paths, raw prompts, raw traces, proprietary datasets, or private customer content in public issues.
- Route vulnerability reports out of public issues and into `security@auraone.ai`.
- Commercial support, managed reviewer operations, SSO, RBAC, audit ledgers, and hosted Cloud outages are not covered by this OSS SLA unless they affect the shared open-source intake path.
