# GA Approval Evidence Capture Runbook

Date opened: 2026-05-20
Owner: Release manager
Scope: Open Studio GA checklist sign-off, third-party security audit evidence,
bug bounty launch evidence, and legal/trademark/privacy launch approval.

## Verification Command

```bash
pnpm --dir opensource/open-studio-platform run verify:ga-approvals
```

The verifier checks that the GA/security checklist files exist and validates external approval artifacts under:

```text
docs/evidence/product/open-studio-ga-approvals/<evidence-key>.<md|json|txt|png|pdf>
```

or under `$AURAONE_GA_APPROVAL_EVIDENCE_DIR`.

Capture templates live under:

```text
docs/evidence/product/open-studio-ga-approvals/templates/<evidence-key>.md
```

The verifier reports `missingExternalEvidenceInstructions` with the preferred
accepted evidence path, all accepted extensions, and the matching template for
each missing or rejected item.

## Required External Evidence

| Evidence key | Required contents |
|---|---|
| `rubric-ga-checklist-signoff` | Checklist version, security reviewer, Platform owner, release manager, timestamp. |
| `robotics-ga-checklist-signoff` | Checklist version, security reviewer, Platform owner, release manager, timestamp. |
| `agent-ga-checklist-signoff` | Checklist version, security reviewer, Platform owner, release manager, timestamp. |
| `third-party-security-audit` | Auditor, scope, report id or URL, severity disposition, signature timestamp. |
| `bug-bounty-launch` | Program host, scope, safe harbor, reward tiers, launch timestamp. |
| `legal-launch-approval` | Legal reviewer, approved surfaces, approval timestamp, open exceptions, artifact URL. |

## Capture Guidance

Checklist evidence can be a signed checklist export, a release approval memo that references the exact checklist revision, or a signed ticket export. Audit evidence must come from the auditor or a signed exception approved by the required launch authority. Legal evidence must explicitly cover launch claims, trademark/IP posture, privacy policy, terms, and any product-page claims being published.

## Current Blocker State

As of 2026-05-20, all five checklist files exist locally, but Rubric and Agent
still have blank sign-off fields and every checklist has unchecked execution
items. The verifier intentionally does not fail on unchecked local checklist
items alone; it fails the gate because no external sign-off, audit, or legal
approval evidence has been attached. Do not mark any GA approval item complete
until the corresponding accepted evidence file exists outside the template
subtree.

## Non-Closure Rule

Draft checklists, local checklist files with blank sign-off fields, planned audit scopes, and approval templates do not close the GA gate. The verifier intentionally accepts only non-placeholder external evidence files.
