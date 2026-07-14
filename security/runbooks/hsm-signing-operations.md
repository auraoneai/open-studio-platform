# HSM Signing Operations Runbook

Owner: Platform Release Engineering
Backup owner: AuraOne CEO or named security delegate
Applies to: macOS Developer ID, Windows EV code signing, managed Azure Artifact Signing custody, Linux release GPG, and Tauri updater signing keys
Status: Required before any signed Open Studio Platform release

## 1. Preconditions

1. The release candidate is built by CI from a protected branch or signed tag.
2. The release workflow has produced unsigned artifacts, `SHA256SUMS`, SBOM, provenance, and build logs.
3. The signing certificates and release keys are present only in the approved YubiHSM 2, managed cloud signing provider, or documented sealed-envelope backup.
4. The hardened signing runner is patched, disk-encrypted, network-restricted to GitHub, timestamp services, and Cloudflare R2, and has no persistent workspace from previous signing sessions.
5. Two named contacts are reachable before signing starts: the Platform owner and the backup owner.

## 2. Signing Request Queue

1. CI writes one encrypted signing request per artifact to the private signing queue.
2. Each request must include the repository, workflow run ID, commit SHA, artifact name, expected SHA-256 hash, target flagship, release channel, and requested signing mode.
3. Requests expire after 15 minutes. CI must fail closed if a signed artifact has not appeared within that window.
4. The signing daemon refuses requests from non-protected branches, unknown workflow IDs, or artifacts missing a matching checksum entry.
5. The queue is append-only. Operators do not edit requests in place; rejected requests are closed with a reason and CI must submit a fresh request.

## 3. Operator Procedure

1. Verify that the release issue links the workflow run, SBOM hash, checksum hash, and release notes.
2. Confirm the current date, release channel, and target app match the approved release issue.
3. Insert the YubiHSM 2 into the hardened signing runner and unlock it with the approved operator credential.
4. Start the signing daemon in foreground mode and tail the queue audit log.
5. For each request, download the artifact from CI and independently compute `sha256sum` or `shasum -a 256`.
6. Compare the computed hash with the CI-logged hash and the queue request hash. Any mismatch aborts the full signing session.
7. Sign only through the platform wrapper scripts:
   - `scripts/sign-macos.sh`
   - `scripts/notarize.sh`
   - `scripts/sign-windows.ps1`
   - `scripts/sign-linux.sh`
   - `scripts/make-updater-manifest.mjs`
   Windows signing may use a local certificate thumbprint, PFX pair, or managed
   Azure Artifact Signing provider. For managed signing, the runner must set
   `AURAONE_WINDOWS_SIGNING_PROVIDER=azure-artifact-signing`,
   `AURAONE_ARTIFACT_SIGNING_DLIB_PATH`, and either
   `AURAONE_ARTIFACT_SIGNING_METADATA_PATH` or the
   `AURAONE_ARTIFACT_SIGNING_ENDPOINT`,
   `AURAONE_ARTIFACT_SIGNING_ACCOUNT_NAME`, and
   `AURAONE_ARTIFACT_SIGNING_CERTIFICATE_PROFILE_NAME` secret trio.
8. Verify the resulting signature or notarization status before upload.
9. Upload signed artifacts, updated checksums, signatures, and updater manifests back to the CI handoff location.
10. Remove the YubiHSM 2, close the signing daemon, and confirm the queue contains no open stale requests.

## 4. Artifact Verification Commands

Operators must record the relevant command output in the release issue.

```bash
shasum -a 256 <artifact>
codesign --verify --deep --strict --verbose=2 <app>
spctl --assess --type execute --verbose <app>
stapler validate <app-or-dmg>
gpg --batch --verify SHA256SUMS.asc SHA256SUMS
```

Windows verification must be recorded from a Windows runner:

```powershell
signtool.exe verify /pa /v <installer.msi>
Get-AuthenticodeSignature <installer.msi>
```

## 5. Two-Person Controls

1. The Platform owner is the primary operator for routine signing.
2. The backup owner may operate signing only when the Platform owner is unavailable or when incident response requires key recovery.
3. Signing key export, backup restoration, certificate re-issuance, revocation, or HSM reset requires two-person approval from the Platform owner and backup owner.
4. The release issue must include both approvers for any emergency signing session, key rotation, backup restoration, or revocation.
5. No operator may sign an artifact they locally rebuilt outside the approved CI workflow.

## 6. Storage And Backup

1. The YubiHSM 2 is stored in a locked cabinet when not in use.
2. The offline backup envelope contains only the approved recovery material for Linux GPG and Tauri updater keys. It does not contain Apple or Windows private keys unless the issuing CA supports approved escrow.
3. Backup access is logged with date, reason, approvers, and post-access integrity check.
4. Backup restoration is tested only in a rehearsal environment unless an active incident requires production recovery.
5. Retired keys remain archived until all supported releases using those signatures are outside the support window.

## 7. Audit Evidence

Every signing session must leave these records attached to the release issue or private security issue:

1. Workflow run URL and commit SHA.
2. Queue request IDs and queue audit log hash.
3. Unsigned artifact SHA-256 hashes.
4. Signed artifact SHA-256 hashes.
5. Signature, notarization, timestamp, or GPG verification output.
6. Operator name, backup contact availability, and HSM serial number suffix.
7. Any rejected request with rejection reason.

## 8. Windows Custody Evidence Gate

Before any Windows artifact can be treated as release-ready, release engineering
must attach credential-safe evidence for all three Windows custody keys accepted
by `pnpm --dir opensource/open-studio-platform run verify:signing-custody`:

1. `custody-attestation`: EV token/HSM custody, PFX custody, or Azure
   Artifact/Trusted Signing account evidence; certificate subject or managed
   profile name; owner; backup owner; reviewer; captured timestamp; and
   expiration or rotation date.
2. `release-environment-binding`: protected GitHub release environment export
   or screenshot; reviewer policy; and the required secret names without secret
   values.
3. `signing-provider-verification`: wrapper dry-run or provider configuration
   output, `signtool` or managed provider version output, and proof that no
   private key, PFX, PIN, token, password, or tenant secret was printed.

Evidence can live in the private path named by
`AURAONE_WINDOWS_SIGNING_CUSTODY_EVIDENCE_DIR` or in the repo-local fallback:

```text
docs/evidence/product/windows-signing-custody/<evidence-key>.<md|json|txt|png|pdf>
```

Capture forms live under
`docs/evidence/product/windows-signing-custody/templates/`. The verifier rejects
those templates, short intent notes, placeholder language, invalid JSON, and
undersized binary files.

## 9. Failure Handling

1. If the queue request expires, CI fails the release and no operator manually uploads artifacts.
2. If artifact hashes mismatch, stop signing, preserve artifacts, disable the release job, and open a private security issue.
3. If the HSM is unavailable, do not bypass it with local private keys. Escalate to the backup owner and follow the backup restoration path.
4. If timestamp or notarization services are down, pause the release unless an incident commander approves a documented emergency mitigation.
5. If a signed artifact cannot be verified, discard it and rerun signing from the original unsigned artifact after root-cause analysis.
