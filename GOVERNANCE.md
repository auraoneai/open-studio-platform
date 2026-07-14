# Governance

The Platform engineering lead owns shared substrate decisions. Flagship leads own product-specific screens and engines. Any PR touching platform-owned surfaces requires Platform owner review.

## Decision Model

- Routine fixes: normal PR review.
- Shared API additions or behavior changes: Platform owner approval.
- Vendor changes, schema major versions, security posture changes, signing/update pipeline changes, or new shared services: RFC required.

## Maintainers

- Platform owner: `@auraone/platform-owner`
- Rubric Studio Open lead: `@auraone/rubric-lead`
- Robotics Studio Open lead: `@auraone/robotics-lead`
- Agent Studio Open lead: `@auraone/agent-lead`

## Operating Cadence

The weekly platform sync, CODEOWNERS enforcement requirements, quarterly health review, and release-blocking drift rules live in `docs/platform-operating-cadence.md`.
