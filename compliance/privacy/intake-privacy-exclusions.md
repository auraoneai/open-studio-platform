# Intake Privacy Exclusions

The `.auraonepkg` intake flow is explicit user action only. It must never infer identity or include sensitive local data outside the files the user chooses to package.

## Required Exclusions

Every intake manifest must affirm that the packet excludes:

- User PII other than display name and optional email explicitly typed into the intake dialog.
- OS account identity, usernames, home directories, and device account names.
- Git identity, including `git config user.name`, `git config user.email`, remotes, and commit author data unless the user selected those files as payload content and the flagship-specific redactor approved them.
- API keys, tokens, passwords, credentials, private keys, provider secrets, and raw secret values.
- Raw prompts, traces, customer text, local file paths, datasets, videos, or proprietary records unless product-specific intake roles explicitly allow redacted payloads.

## Required UX

- Show a local preview before upload.
- List included payloads and excluded categories.
- Require explicit user confirmation before upload.
- Do not upload automatically on app start, crash, telemetry consent, or project open.
