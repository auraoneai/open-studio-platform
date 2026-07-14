# Platform Operating Cadence

Owner: Platform owner
Applies to: Rubric Studio Open, Robotics Studio Open, Agent Studio Open, and the Open Studio Platform substrate

## Weekly Platform Sync

The Platform owner runs a 15-minute weekly sync with the Rubric, Robotics, and Agent leads. The meeting exists only to prevent drift and unblock shared platform work.

Required agenda:

1. Review open PRs touching shared surfaces: Tauri template, AuraGlass IDE kit, signing, updater, crash, telemetry, keychain, intake, installer distribution, docs template, security, license, and contributor policy.
2. Identify flagship-local code that should move into `packages/aura-ide-kit`, platform crates, schemas, docs template, release scripts, or security automation.
3. Review open sync PRs from the latest `platform-vX.Y.Z` tag and their five-business-day deadline.
4. Assign one owner and due date for every drift item.
5. Record blockers that require an RFC, external provisioning, or management staffing.

Required output:

1. A dated note in the platform tracking issue or release issue.
2. Updated owner and due date for every open drift item.
3. Links to any RFCs, sync PRs, or checklist items created during the sync.

## CODEOWNERS Review Enforcement

GitHub branch protection must require CODEOWNERS approval before merge for all platform-owned surfaces.

Required protected-branch settings:

1. Require a pull request before merging.
2. Require review from Code Owners.
3. Require status checks for platform contract tests, security checks, template sync, and release workflow lint.
4. Block bypass for non-admins.
5. Restrict direct pushes to protected branches.

The local `CODEOWNERS` file is the source of truth for ownership. GitHub team provisioning remains external for platform-wide owners, but the 2026-05-19/2026-05-20 cross-repo follow-up created and attached `@auraoneai/security` plus the Robotics, Rubric, and Agent maintainer teams to their public flagship repositories. Public Rubric, Robotics, and Agent branch protection now requires two approving reviews plus CODEOWNERS review, and Robotics PR #33/#34 plus Agent PR #8/#9/#10 are merged. Branch protection must still map these platform handles before root-platform GA:

1. `@auraone/platform-owner`
2. `@auraone/security`
3. `@auraone/auraglass`
4. `@auraone/docs`
5. Per-flagship lead teams

## Quarterly Platform Health Review

The Platform owner runs one quarterly health review before the first release candidate in that quarter.

Required review areas:

1. Diff each flagship against the current Tauri template and platform sync manifest.
2. Audit duplicated UI components that should move into `packages/aura-ide-kit`.
3. Audit duplicated release, signing, installer, updater, telemetry, crash, keychain, intake, and docs logic.
4. Review dependency pins, Tauri release notes, security advisories, and private-fork risk.
5. Review unresolved external blockers: signing credentials, HSM, Cloudflare, Sentry, DCO App, Algolia, GitHub teams, Homebrew, winget, third-party audit, and bug bounty.
6. Confirm each flagship's per-GA checklist has an owner and current status.

Required output:

1. A health-review note linked from the next platform release issue.
2. A drift backlog with owners, due dates, and severity.
3. RFCs for any platform API, vendor, schema-major, or security-posture change.
4. A decision on whether any flagship release must be blocked until drift is resolved.

## Release Blocking Rules

1. A flagship release is blocked if its `.open-studio-platform-sync.json` is older than the allowed five-business-day window.
2. A flagship release is blocked if it bypasses platform signing, updater, telemetry, crash, keychain, intake, installer, docs, security, license, or contributor contracts.
3. A flagship release is blocked if CODEOWNERS review is disabled or bypassed for a platform-owned surface.
4. A flagship release is blocked if the quarterly health review identifies critical drift with no approved mitigation.
