# Security Disclosure Process

Report security issues privately to `security@auraone.ai`.

Do not open a public GitHub issue for suspected vulnerabilities, leaked secrets, signing-key issues, update-server problems, intake packet privacy bugs, telemetry privacy bugs, keychain bypasses, crash-reporting leaks, or supply-chain compromise.

## What To Include

- Affected product or package.
- Version, commit SHA, or release artifact hash.
- Operating system and architecture.
- Reproduction steps or proof of concept.
- Impact assessment, including whether secrets, PII, local files, update integrity, or code execution are involved.
- Any disclosure timeline constraints.

## Response Targets

- SEV-1 security issue with active exploit: acknowledge within 24 hours, patched release target within 7 days.
- SEV-2 security issue without active exploit: acknowledge within 48 hours, patched release target within 30 days.
- Lower severity issue: acknowledge within 5 business days and triage into the public or private backlog as appropriate.

## Safe Harbor

AuraOne will not pursue legal action for good-faith research that:

- Avoids privacy violations, data destruction, service disruption, and persistence.
- Uses only accounts, systems, and data you are authorized to test.
- Reports findings promptly and privately.
- Gives AuraOne a reasonable opportunity to remediate before public disclosure.

## PGP

A production PGP key must be published before GA. Until then, use the placeholder in `security/contacts/pgp-placeholder.asc` only as a reminder of the required publication format. Do not use the placeholder for real vulnerability reports.
