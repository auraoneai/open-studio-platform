---
id: intake-packets
title: Intake Packets
---

# Intake Packets

`.auraonepkg` is the shared zip envelope for local-to-cloud handoff. Flagships own payload content; the platform owns manifest shape, privacy exclusions, preview UI, transport, and response handling.

## Cloud Import Contract

The live intake Worker accepts a valid packet, stores the original archive in R2,
and publishes one message to Cloudflare Queue `auraone-open-cloud-import`. The
downstream AuraOne Cloud consumer must treat the queue message as the hand-off
contract:

- `packet_id`
- `product`
- `received_at`
- `r2_key`
- `install_id_hash`
- `project_id`
- `manifest_version`
- `product_version`
- `platform_version`

The intake response returns a `cloud_url` immediately with `import_status:
queued`. A launch-close claim requires evidence that AuraOne Cloud consumed the
queue message, created or updated the Cloud project, and wrote an audit event
linking `packet_id`, `r2_key`, `project_id`, timestamp, and actor.

Run the local producer/consumer-evidence gate with:

```bash
pnpm --dir opensource/open-studio-platform run verify:cloud-import-consumer
```
