# RFC Process

RFCs are required for platform-level decisions that affect more than one flagship or alter a user-trust contract.

## When to Open an RFC

Open an RFC for:

- Vendor changes.
- Major schema versions.
- Breaking API changes.
- New or removed outbound network destinations.
- Changes to telemetry, crash reporting, intake, updater, keychain, signing, CSP, or Tauri ACL posture.
- New shared UX contracts across flagships.
- Any decision that would require coordinated migration in more than one flagship.

## File Naming

Create RFCs in `rfcs/`:

```text
opensource/open-studio-platform/rfcs/0001-short-title.md
```

Use the next available four-digit number.

## Lifecycle

| State | Meaning |
|---|---|
| Draft | Author is still shaping the proposal. |
| Review | Ready for Platform owner, flagship lead, and security review. |
| Accepted | Approved and ready to implement. |
| Rejected | Not proceeding; rationale recorded. |
| Superseded | Replaced by a later RFC. |

## Required Sections

Use `rfcs/0000-template.md`.

An RFC must include:

- Summary.
- Motivation.
- Detailed design.
- Security and privacy impact.
- Compatibility and migration plan.
- Alternatives considered.
- Verification plan.
- Rollout and rollback plan.

## Acceptance

Acceptance requires Platform owner approval and at least one other flagship engineering lead approval. Security-sensitive RFCs also require explicit security approval.
