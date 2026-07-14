# Rubric Studio Open OSS Support Runbook

Primary support channel: GitHub Issues in `auraoneai/rubric-studio-open`.

## Triage Targets

- Security disclosure: route to `security@auraone.ai`; do not request details in public issues.
- Install failure: label `install`, request OS, architecture, install method, artifact version, and checksum verification result.
- Update failure: label `updater`, request channel, app version, update manifest URL, and signature error text.
- Engine crash: label `engine`, request redacted project fixture and sidecar log category only.
- Intake export issue: label `intake`, request packet schema validation result and whether send was explicit.

## SLA

- Security: acknowledge within 24 hours.
- Install/update regressions: acknowledge within 24 hours during first four GA weeks.
- General issues: first response within two business days.

Support should route product questions to Discussions and avoid creating private
support tickets for OSS-only usage unless a security disclosure is involved.
