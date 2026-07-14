# Intake Packets

An `.auraonepkg` is a ZIP archive with:

- `manifest.json`
- `payload/`
- `signatures/manifest.sig`

The user must review the packet preview and explicitly consent before transport to `https://intake.auraone.ai/v1/packets/`.

## Cloud import queue

The intake service stores accepted packets in R2 and sends a queue message to
`auraone-open-cloud-import` with packet, product, manifest, and project
metadata. The returned `cloud_url` means the packet is queued; it does not prove
that AuraOne Cloud has imported the project.

Before GA, attach evidence for:

- Cloud queue consumer deployment
- End-to-end smoke import using a real `packet_id`
- Audit log linkage between packet, R2 key, Cloud project id, timestamp, and actor

Use `pnpm --dir opensource/open-studio-platform run verify:cloud-import-consumer`
to validate the local producer contract, local consumer processing contract, and required external evidence files.
