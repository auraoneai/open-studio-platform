---
id: maintainers
title: Maintainers
---

# Maintainers

The live maintainer page for each flagship is published at `https://auraone.ai/open/maintainers` before GA. This template defines the required content and review ownership.

## Platform

| Area | Required owner |
|---|---|
| Open Studio Platform substrate | `@auraone/platform-owner` |
| Security review, disclosure, and incident response | `@auraone/security` |
| AuraGlass IDE kit adoption | `@auraone/auraglass` |
| Docs template and release notes | `@auraone/docs` |

## Flagships

| Flagship | Required lead |
|---|---|
| Rubric Studio Open | `@auraone/rubric-lead` |
| Robotics Studio Open | `@auraone/robotics-lead` |
| Agent Studio Open | `@auraone/agent-lead` |

## Maintenance Rules

1. Every flagship must name one release manager and one security reviewer before GA.
2. Platform-owned changes require `@auraone/platform-owner` review through CODEOWNERS.
3. Security, telemetry, updater, keychain, intake, signing, and release changes require Platform Security review.
4. Maintainer changes are documented in release notes and mirrored into GitHub team membership before release.
5. If a maintainer is unavailable for more than five business days during a release window, the backup owner listed in the release issue takes over.
