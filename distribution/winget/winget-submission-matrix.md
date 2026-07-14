# Open Studio winget Submission Matrix

Date: 2026-07-12

Status: `0.2.0` manifests are staged for all three flagships and are
intentionally unpublishable. Every current installer manifest contains explicit
blocked values instead of a fabricated SHA-256 or ProductCode. The historical
`0.1.0` directories are retained for audit only and are not current submission
candidates.

Final submission remains blocked until the public MSI artifacts are built from
one exact pushed commit, trusted Authenticode signing and timestamping are
verified, clean Windows install and upgrade QA is attached, the staged fields
are replaced from signed artifact metadata, `winget validate` succeeds, and
submission or acceptance evidence exists.

| Product | Current staged manifest | Historical metadata | Current state | Next action |
|---|---|---|---|---|
| Rubric Studio Open | `AuraOne.RubricStudioOpen/0.2.0` | `AuraOne.RubricStudioOpen/0.1.0` | Blocked placeholders for x64 and arm64 | Produce EV-signed MSI artifacts, extract real digests and ProductCodes, verify clean install, then validate and submit |
| Robotics Studio Open | `AuraOne.RoboticsStudioOpen/0.2.0` | `AuraOne.RoboticsStudioOpen/0.1.0` | Blocked placeholders for x64 and arm64 | Produce EV-signed MSI artifacts, extract real digests and ProductCodes, verify clean install, then validate and submit |
| Agent Studio Open | `AuraOne.AgentStudioOpen/0.2.0` | `AuraOne.AgentStudioOpen/0.1.0` | Blocked placeholders for x64; the archival 0.1.0 MSI was unsigned | Rebuild with trusted Authenticode signing, extract real digest and ProductCode, verify clean install, then validate and submit |

The authoritative staged target and required evidence are recorded in
`distribution/release-evidence/<product>/0.2.0.json`. Historical `0.1.0`
checksums or ProductCodes must never be copied into the `0.2.0` manifests.

After signed public MSI artifacts exist:

```bash
pnpm --dir opensource/open-studio-platform windows-msi:prepare -- --flagship <flagship-id> --version 0.2.0 --arch <x64|arm64> --source-dir <signed-msi-dir> --out-dir dist/release --base-url <release-url> --metadata-out dist/release/windows-msi-<arch>.json --require-signed
pnpm --dir opensource/open-studio-platform winget:prepare -- --metadata dist/release/windows-msi-<arch>.json --write --require-signed
winget validate opensource/open-studio-platform/distribution/winget/<PackageIdentifier>/0.2.0
```

Do not submit any manifest containing `BLOCKED_UNTIL_SIGNED_MSI_SHA256_*` or
`BLOCKED-UNTIL-VERIFIED-WIX-PRODUCT-CODE-*`. A real checksum and ProductCode
also remain insufficient without trusted Authenticode, clean-install, and
winget validation evidence.
