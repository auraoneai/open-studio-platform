# Open Studio Install, Update, and Rollback

This runbook applies to Rubric Studio Open, Agent Studio Open, and Robotics
Studio Open. The canonical source for every downloadable URL, checksum,
signature state, channel state, and rollback owner is
`distribution/release-evidence/<product>/<version>.json`.

The current target is `0.2.0` and its records have `evidenceKind: "staged"`.
They record planned immutable URLs and required verification while leaving
live URLs, checksums, sizes, signatures, and signed updater manifests null.
The `0.1.0` records are archival evidence only.

## Safety Rules

- Never construct an artifact URL from a version at install or update time.
- Never publish a manifest containing placeholders, inferred checksums, or
  unverified signing claims.
- Never overwrite an immutable version tag or an existing release asset.
- Stop downstream channels when the canonical evidence is not publishable.
- Keep stale, partial, blocked, and not-applicable states visible.
- Never copy a `0.1.0` digest, ProductCode, URL, signature, or notarization
  result into a `0.2.0` record.

## Install Verification

1. Fetch the canonical release-evidence manifest from the stable manifest URL.
2. Select one artifact by explicit platform, architecture, and artifact type.
3. Require artifact status `verified` or `released`.
4. Download the exact `url` recorded in the manifest.
5. Verify the SHA-256 against the manifest before opening or installing.
6. Verify platform signing:
   - macOS: Developer ID, notarization ticket, stapling, and Gatekeeper.
   - Windows: Authenticode chain, timestamp, publisher, and MSI ProductCode.
   - Linux: detached artifact signature, release-key fingerprint, and package
     repository metadata signature.
7. Record install, launch, and uninstall results in a fresh environment.

The shell and PowerShell installers in `installers/` enforce the manifest URL
and checksum boundary. They refuse stale, partial, blocked, or unavailable
artifacts.

## Update Verification

1. Install the last independently verified version.
2. Fetch the signed updater manifest from the explicit URL in release evidence.
3. Verify the updater manifest signature and selected artifact signature.
4. Confirm the updater selects the expected product, channel, architecture, and
   target version.
5. Complete the update and verify application launch, settings migration,
   project compatibility, and update history.
6. Confirm a failed signature, checksum, download, or install leaves the
   existing installation usable.
7. Attach the test timestamp, platform, prior version, target version, and
   verifier to the release record.

## Rollback

The release owner named in the manifest owns the rollback decision.

1. Stop downstream publication and disable updater rollout or set the updater
   kill switch.
2. Mark the affected artifact and channels `failed` or `blocked`; do not delete
   the evidence.
3. Restore the last verified website/catalog manifest independently from source
   availability.
4. For desktop users, publish explicit downgrade guidance only after verifying
   data and settings compatibility.
5. Do not overwrite the broken version. Ship a corrective patch from a new tag.
6. Preserve checksums, signatures, logs, public URLs, user impact, and the
   rollback decision for audit.

No current flagship manifest records a fully verified rollback target. That is
an explicit release blocker, not an implied approval to use `0.1.0`.
