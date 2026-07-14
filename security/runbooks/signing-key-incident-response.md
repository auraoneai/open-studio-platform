# Signing Key Incident Response Runbook

Owner: Platform Security
Backup owner: AuraOne CEO or named security delegate
Applies to: suspected or confirmed compromise, loss, misuse, or expiration failure for Open Studio Platform signing material
Status: Required before any signed Open Studio Platform release

## 1. Severity

Treat any suspected compromise of Apple Developer ID, Windows EV, Linux GPG, Tauri updater, notarization, timestamping, or release-upload credentials as SEV-1. Start this runbook even when the evidence is incomplete.

## 2. Immediate Containment

1. Freeze all release workflows for affected flagships.
2. Disable update publication and set the update Worker kill switch for affected channels.
3. Revoke or suspend GitHub Actions secrets that can reach signing keys, notarization credentials, R2 buckets, update manifests, or release uploads.
4. Preserve the signing queue, CI logs, artifact hashes, updater manifests, and Worker logs.
5. Assign an incident commander, signing lead, communications lead, and recorder.
6. Open a private security issue with the incident timeline and restrict it to Platform Security and named executives.

## 3. Triage Questions

1. Which key or credential is affected: Apple Developer ID, Windows EV, Linux GPG, Tauri updater, notary credential, timestamp account, GitHub release token, or Cloudflare credential?
2. Was the key used to sign an unapproved artifact?
3. Did a signed artifact, checksum, manifest, or installer reach GitHub Releases, Cloudflare R2, Homebrew, winget, or users?
4. Is there evidence of HSM theft, backup envelope access, queue tampering, or operator credential compromise?
5. Which flagship versions and update channels trust the affected key?

## 4. Revocation And Rotation

1. Apple Developer ID: revoke the certificate in Apple Developer, generate a replacement certificate, and rerun notarization only after release CI is clean.
2. Windows EV: contact the CA immediately, revoke the EV certificate, obtain a replacement, and reset SmartScreen reputation expectations in release notes.
3. Linux GPG: publish a revocation certificate, publish the replacement public key and fingerprint, rotate apt/yum repository metadata, and update installer fingerprint configuration.
4. Tauri updater: rotate the Ed25519 key pair, update flagship Tauri public-key configuration, publish replacement manifests, and block updates signed by the compromised key.
5. Cloudflare/GitHub credentials: rotate tokens, invalidate active sessions, review audit logs, and redeploy Workers from a trusted commit.
6. Sealed-envelope backup: if opened or suspected exposed, replace the backup material and log the two-person approval.

## 5. User Protection

1. Pull affected release artifacts from GitHub Releases, R2, Homebrew, winget, and install endpoints.
2. Publish a clean advisory that identifies affected versions, fixed versions, and verification steps.
3. If malicious updates may have shipped, use the updater kill switch and require reinstall from freshly signed installers.
4. Update install scripts and docs to reject the compromised fingerprint or updater public key.
5. Provide checksum and signature verification steps for users who need to validate local artifacts.

## 6. Forensics

1. Snapshot CI logs, queue logs, signing runner logs, HSM audit data, Cloudflare logs, GitHub audit logs, and release artifacts.
2. Compare every signed artifact hash against the expected CI-produced unsigned artifact hash.
3. Identify the first suspicious queue request, workflow run, token use, or operator login.
4. Preserve a copy of any suspect artifact for the private investigation. Do not redistribute it publicly.
5. Document whether the incident was key theft, operator compromise, CI compromise, R2/update compromise, or process failure.

## 7. Recovery

1. Rebuild affected release candidates from a reviewed commit after CI secrets are rotated.
2. Sign with the replacement HSM-backed key material.
3. Verify signatures, notarization, checksums, updater manifests, and installer fingerprints on fresh macOS, Windows, and Linux hosts.
4. Deploy update Worker and install endpoint changes from a trusted workflow run.
5. Unfreeze release workflows only after Platform Security signs off in the incident issue.

## 8. Rehearsal

1. Run a signing compromise tabletop at least annually and after any signing architecture change.
2. Rehearse revocation using non-production keys for Linux GPG and Tauri updater flows.
3. Rehearse the 15-minute queue timeout and CI fail-closed behavior.
4. Record gaps in `security/checklists/platform-v0.1-security-review.md` or as release-blocking issues.
5. Update this runbook within 5 business days of the rehearsal.

## 9. Closure Criteria

1. Affected keys are revoked or formally ruled out.
2. Replacement keys, fingerprints, and updater public keys are published where required.
3. Every affected artifact, manifest, installer script, registry entry, and docs page is replaced or removed.
4. Users and downstream flagship teams receive final guidance.
5. The incident issue includes a timeline, root cause, blast radius, remediation evidence, and follow-up owners.
