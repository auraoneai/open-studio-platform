# Open Studio Linux Package Matrix

Date: 2026-07-12

Status: `0.2.0` packaging metadata is staged for all three flagships.
Publishable Linux release readiness is blocked. The current checkout does not contain the
required AppImage, deb, and rpm artifacts, detached per-artifact signatures,
package-repository metadata, or clean-install evidence for the complete matrix.
The `0.1.0` evidence under `distribution/release-evidence/` is retained only as
historical audit evidence. It does not prove `0.2.0` availability, signing, or
installability and must never be substituted into the staged package metadata.

| Product | Version | AppImage desktop file | AppStream metainfo | deb control | rpm spec | Executable |
|---|---:|---|---|---|---|---|
| Rubric Studio Open | 0.2.0 | `appimage/rubric-studio-open.desktop` | `appimage/ai.auraone.rubricstudio.metainfo.xml` | `deb/rubric-studio-open.control` | `rpm/rubric-studio-open.spec` | `rubricstudio` |
| Robotics Studio Open | 0.2.0 | `appimage/robotics-studio-open.desktop` | `appimage/ai.auraone.roboticsstudio.metainfo.xml` | `deb/robotics-studio-open.control` | `rpm/robotics-studio-open.spec` | `robostudio` |
| Agent Studio Open | 0.2.0 | `appimage/agent-studio-open.desktop` | `appimage/ai.auraone.agentstudio.metainfo.xml` | `deb/agent-studio-open.control` | `rpm/agent-studio-open.spec` | `agentstudio` |

## Build Matrix

| Format | Architectures | Build runner | Signing step | Status |
|---|---|---|---|---|
| AppImage | x86_64, arm64 | Ubuntu x86_64 and Ubuntu arm64 runners with Tauri Linux dependencies | Detached GPG `.asc` plus `.sha256` via `scripts/sign-linux.sh` | Blocked pending artifacts, signatures, and clean-install evidence |
| deb | amd64, arm64 | Ubuntu runners or containerized package builder | Repository metadata signing plus per-artifact detached GPG signatures | Blocked pending artifacts, repository metadata, and clean-install evidence |
| rpm | x86_64, aarch64 | Fedora/RHEL-compatible builder | Repository metadata signing plus per-artifact detached GPG signatures | Blocked pending artifacts, repository metadata, and clean-install evidence |

## Required Verification

```bash
pnpm --dir opensource/open-studio-platform verify:linux-package-matrix
pnpm --dir opensource/open-studio-platform verify:linux-artifacts
AURAONE_GPG_KEY_ID=<fingerprint> opensource/open-studio-platform/scripts/sign-linux.sh <artifact>
```

Do not mark Linux package/signature closure complete until the verifier finds
the exact release artifacts in the public GitHub Releases, verifies their
detached signatures and checksums, and accepts fresh repository/install
evidence. Historical evidence packets may support an audit, but they cannot be
used to claim a new release is publishable.
