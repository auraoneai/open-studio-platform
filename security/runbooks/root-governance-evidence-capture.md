# Root Governance Evidence Capture Runbook

Date opened: 2026-05-20
Owner: GitHub organization admin / Platform owner
Scope: Root private repository `gchahal1982/AuraFoundry`, DCO enforcement, root CODEOWNERS, and platform-owner team mapping.

## Verification Command

```bash
pnpm --dir opensource/open-studio-platform run verify:root-governance
```

The verifier checks local root governance files, attempts to read root `main` branch protection through the GitHub API, and validates external evidence under:

```text
docs/evidence/product/open-studio-root-governance/<evidence-key>.<md|json|txt|png|pdf>
```

or under `$AURAONE_ROOT_GOVERNANCE_EVIDENCE_DIR`.

Capture templates live under:

```text
docs/evidence/product/open-studio-root-governance/templates/<evidence-key>.md
```

The verifier reports `missingExternalEvidenceInstructions` with the preferred
accepted evidence path, all accepted extensions, and the matching template for
each missing or rejected item.

## Required External Evidence

| Evidence key | Required contents |
|---|---|
| `root-branch-protection` | Repository, protected branch, required `DCO / dco` check, strict status checks, two approving reviews, CODEOWNERS review, capture timestamp. |
| `platform-owner-team-map` | GitHub team slug, maintainer/owner, relevant CODEOWNERS pattern, redacted roster or member count, capture timestamp. |
| `root-dco-enforcement` | DCO workflow or app name, required status check, sample protected PR or settings export, capture timestamp. |

## Capture Guidance

Use a GitHub account or repository plan that can access private repository branch protection settings. A JSON export from the GitHub API is preferred. A screenshot/PDF is acceptable if it shows the root repository, branch name, required checks, review requirements, CODEOWNERS requirement, and timestamp. Redact private team members where needed, but retain enough team or membership evidence to prove the CODEOWNERS platform-owner mapping.

## Current Blocker State

As of 2026-05-20, local root CODEOWNERS, root DCO workflow, and
`opensource/open-studio-platform/CODEOWNERS` pass the local checks. The live
GitHub read-only audit still blocks root governance closure:

- `gh repo view` confirms the authenticated account is `ADMIN` on
  `gchahal1982/AuraFoundry`.
- `gh api repos/gchahal1982/AuraFoundry/branches/main` returns
  `"protected": false`.
- `gh api repos/gchahal1982/AuraFoundry/branches/main/protection` returns
  HTTP 403 with `Upgrade to GitHub Pro or make this repository public to enable
  this feature.`
- `gh api repos/gchahal1982/AuraFoundry/teams --paginate` returns an empty
  list, so no GitHub team mapping is visible for the root repository.

The blocker is therefore not missing local code. It is root repository
governance state and evidence: `main` is not proven protected, branch-protection
settings cannot be read/applied on the current private-repository plan/API path,
and platform-owner/team evidence is absent. Attach an API export from an account
and plan that can read branch protection, a dated settings PDF/screenshot, and a
dated platform-owner team or owner mapping export before closing this gate.

## Non-Closure Rule

The public Rubric, Robotics, and Agent DCO/CODEOWNERS gates are separately tracked by `verify:dco-enforcement`. This runbook covers only the root private repository and platform-owner mapping. Do not infer root closure from public repository settings.
