# Telemetry Privacy Contract

Telemetry is opt-in, default off, schema-validated, scrubbed, and visible to the user.

## Forbidden Data

Telemetry events must not include:

- User content, prompts, chat messages, rubric text, traces, tool arguments, datasets, videos, local file contents, or proprietary records.
- File paths, home directories, repository remotes, OS usernames, hostnames, or account names.
- Emails, names, organization identifiers, IP-derived location, or unredacted IDs that identify a person.
- API keys, tokens, passwords, private keys, credentials, or authorization headers.

## Required Controls

- Consent is off by default.
- The user can view the current-session event log.
- Turning telemetry off clears queued events.
- The event registry documents every event and payload key.
- CI runs forbidden-field checks before release.
