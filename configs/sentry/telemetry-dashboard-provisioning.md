# Open Studio Sentry And Telemetry Dashboard Provisioning

Date: 2026-05-20

Status: Sentry org/project provisioning is complete for Rubric Studio Open,
Robotics Studio Open, and Agent Studio Open. DSNs were validated from an
out-of-repo runtime env file and synthetic events were uploaded. Rubric uptime
provider monitors are now provisioned in Sentry Uptime for the product domain
and the status/update/docs/intake endpoint set.

2026-05-20 credentialed browser check: the Sentry org `auraone-open` is live,
and the projects `rubric-studio-open`, `robotics-studio-open`, and
`agent-studio-open` exist. Raw DSNs are not committed; they were copied from the
authenticated Sentry UI into `/tmp/auraone-sentry-dsns.env` with mode `0600`
for local verification only. `sentry-cli` is still optional because browser
project evidence plus runtime DSN evidence is sufficient for this launch gate.
`SENTRY_AUTH_TOKEN` is required only when running the optional API probe with
`--probe-sentry`.

Latest evidence is recorded in
`docs/evidence/product/open-studio-sentry-2026-05-20/` and
`docs/evidence/product/open-studio-observability-readiness-2026-05-20.md`.
The credential-safe readiness verifier now uses committed project, dashboard,
upload, and uptime evidence paths, plus the GitHub-hosted DSN secret probe, when
local DSN files are absent:

```bash
pnpm --dir opensource/open-studio-platform run verify:observability -- --probe-uptime --probe-github-secrets
# Optional API proof when a token is available:
SENTRY_AUTH_TOKEN=... pnpm --dir opensource/open-studio-platform run verify:observability -- --probe-uptime --probe-sentry
```

## Projects

Use `configs/sentry/projects.json` as the source of truth:

| Project slug | Display name | Required DSN secret |
|---|---|---|
| `rubric-studio-open` | Rubric Studio Open | `RUBRIC_STUDIO_OPEN_SENTRY_DSN` |
| `robotics-studio-open` | Robotics Studio Open | `ROBOTICS_STUDIO_OPEN_SENTRY_DSN` |
| `agent-studio-open` | Agent Studio Open | `AGENT_STUDIO_OPEN_SENTRY_DSN` |

All projects are opt-in and default off. Apply
`configs/sentry-scrub.json` before accepting events.

2026-05-20 synthetic upload event IDs:

| Project slug | Message event ID | Crash event ID |
|---|---|---|
| `rubric-studio-open` | `ebbaf4eb076046be8d55bfb19a4642e8` | `8892ba98350841ad83f4c70459f958b0` |
| `robotics-studio-open` | `31930598f39f4e3d93fceebbe80a2630` | `26e7a83d797e4409879fba340780b76f` |
| `agent-studio-open` | `a6d59cbde7c34945a1fe29f55b77442e` | `3a8a12e78afc40f3a8e1966172d885c1` |

## Dashboard Panels

Provision one dashboard per flagship with the same panel set:

| Panel | Query intent |
|---|---|
| Activation | first launch, first meaningful local workflow, first export |
| Import/load health | local file opens, parser failures, unsupported format errors |
| Export health | local disk, GitHub/HF/registry, and AuraOne intake export attempts |
| Crash-free sessions | crash-free rate, affected opt-in install count, release version |
| Installer/update health | updater checks, checksum failures, install-channel failures |
| Privacy guardrail | rejected events by scrub rule and forbidden-field class |

## Required Evidence Before PRD Rows Close

- Sentry project URLs for each flagship.
- DSN secret names present in the release environment, not committed to the repo.
- Screenshot or JSON export of each dashboard with synthetic test events.
- Evidence that forbidden fields from `configs/sentry-scrub.json` are scrubbed.
- Release issue link recording owner sign-off.

Evidence file layout:

| Evidence key | Environment variable |
|---|---|
| Rubric project URL/export | `RUBRIC_STUDIO_OPEN_SENTRY_PROJECT_EVIDENCE` |
| Robotics project URL/export | `ROBOTICS_STUDIO_OPEN_SENTRY_PROJECT_EVIDENCE` |
| Agent project URL/export | `AGENT_STUDIO_OPEN_SENTRY_PROJECT_EVIDENCE` |
| Rubric synthetic upload | `RUBRIC_STUDIO_OPEN_SENTRY_UPLOAD_EVIDENCE` |
| Robotics synthetic upload | `ROBOTICS_STUDIO_OPEN_SENTRY_UPLOAD_EVIDENCE` |
| Agent synthetic upload | `AGENT_STUDIO_OPEN_SENTRY_UPLOAD_EVIDENCE` |
| Dashboard screenshots/exports | `AURAONE_SENTRY_DASHBOARD_EVIDENCE_DIR` containing files with each project slug |

## Rubric Uptime Monitoring

Rubric uptime monitor configuration is provisioned in Sentry Uptime and recorded
in `distribution/status/rubric-studio-open.json`. The 2026-05-20 browser flow
created the product-domain monitor plus endpoint-level monitors for status,
update manifest, docs, and intake health, then validated each endpoint monitor
with Sentry's `Test Monitor` action.

Provisioned monitors:

| Monitor | URL | Sentry monitor |
|---|---|---|
| Rubric product domain | `https://rubric-studio.auraone.ai/` | `https://auraone-open.sentry.io/monitors/7342390/?project=4511419761295360` |
| Rubric public status page | `https://auraone.ai/status/rubric-studio-open` | `https://auraone-open.sentry.io/monitors/7342459/?project=4511419761295360` |
| Rubric stable update manifest | `https://updates.auraone.ai/rubric-studio-open/darwin/aarch64/0.0.0?channel=stable` | `https://auraone-open.sentry.io/monitors/7342470/?project=4511419761295360` |
| Rubric docs custom domain | `https://docs.rubricstudio.auraone.ai/` | `https://auraone-open.sentry.io/monitors/7342479/?project=4511419761295360` |
| Rubric intake endpoint health | `https://intake.auraone.ai/healthz` | `https://auraone-open.sentry.io/monitors/7342490/?project=4511419761295360` |

Evidence: `docs/evidence/product/open-studio-sentry-2026-05-20/rubric-studio-open-uptime-monitor.md`
and `docs/evidence/product/open-studio-sentry-2026-05-20/rubric-studio-open-endpoint-uptime-monitors.md`.

Historical provisioning command outline:

```bash
sentry-cli projects create rubric-studio-open --team open-studio
sentry-cli projects create robotics-studio-open --team open-studio
sentry-cli projects create agent-studio-open --team open-studio
```

The projects were provisioned through the authenticated browser flow instead of
`sentry-cli`.
