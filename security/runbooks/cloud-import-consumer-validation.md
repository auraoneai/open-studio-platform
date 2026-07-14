# Cloud Import Consumer Validation Runbook

Date opened: 2026-05-20
Owner: AuraOne Cloud import owner
Scope: `https://intake.auraone.ai/v1/packets/`, Cloudflare Queue `auraone-open-cloud-import`, AuraOne Cloud project import consumer, and import audit trail.

## Verification Command

```bash
pnpm --dir opensource/open-studio-platform run verify:cloud-import-consumer
```

The verifier runs a local intake producer probe against `services/intake-receiver`, confirms the Worker queue producer contract, validates the queued message shape, runs a local queue-consumer probe against `services/cloud-import-consumer`, and checks for external Cloud consumer evidence under:

```text
docs/evidence/product/open-studio-cloud-import/<evidence-key>.<md|json|txt|png|pdf>
```

or under `$AURAONE_CLOUD_IMPORT_EVIDENCE_DIR`.

## Required External Evidence

The following artifacts are required before AC-21-11 can be called complete. Do not create these files from assumptions or planned work.

| Evidence key | Required contents |
|---|---|
| `queue-consumer-deployment` | Consumer service or Worker name, environment, queue binding/subscription, deployment timestamp, owner. |
| `consumer-smoke-import` | Real `packet_id`, R2 key, Cloud project URL, import terminal state, timestamp. |
| `import-audit-log-linkage` | Real `packet_id`, Cloud project id, audit event id or log query, operator/account used, timestamp. |

Current launch evidence is attached under `docs/evidence/product/open-studio-cloud-import/`.
On 2026-05-20, `auraone-open-cloud-import-consumer` was deployed to production,
subscribed to `auraone-open-cloud-import`, processed smoke packet
`2cdef54f-932a-4c64-91de-a8dea53db0c9`, and wrote audit event
`open-import-2cdef54f-932a-4c64-91de-a8dea53db0c9`.

## Manual Smoke Procedure

1. Confirm the intake Worker is bound to producer queue `auraone-open-cloud-import`.
2. Deploy `services/cloud-import-consumer` or identify the equivalent AuraOne Cloud consumer subscribed to that queue.
3. Configure `AURAONE_CLOUD_IMPORT_API_URL` and `AURAONE_CLOUD_IMPORT_API_TOKEN` in the deployed consumer environment.
4. Submit a valid `.auraonepkg` through the live intake endpoint.
5. Confirm the consumer reads the queue message and imports into a Cloud project.
6. Confirm the returned `cloud_url` resolves to the imported Cloud project after auth.
7. Capture the import audit log event that links `packet_id`, R2 key, Cloud project id, timestamp, and actor.
8. Redact secrets and store the three evidence artifacts in the verifier path above.

## Non-Closure Rule

The intake receiver producer path and queue-consumer contract are implemented locally and can be tested without external state. Local queue producer and consumer probes alone are not sufficient. If the deployed consumer, live smoke import, or live audit linkage evidence is missing or stale for a future release, do not close the launch gate until fresh evidence is attached.
