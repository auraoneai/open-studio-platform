# Open Studio Release Distribution

This directory is the checked-in distribution source for the three AuraOne Open
Studio flagships.

- `release-evidence/` contains both canonical archival records and the current
  staged target. The index identifies one `current` record and preserves prior
  records under `archive`; a staged record is never publishable.
- `../schemas/release-evidence.schema.json` defines the public evidence contract.
- `operations/INSTALL_UPDATE_ROLLBACK.md` defines install, update, failure, and
  rollback procedures.
- `homebrew/Casks/` contains deliberately blocked `0.2.0` cask templates for
  the shared `auraoneai/open` tap. `homebrew/archive/0.1.0/` preserves the
  historical casks and recorded digests.
- `winget/` contains deliberately blocked `0.2.0` manifest templates for
  publisher `AuraOne`, with the historical `0.1.0` directories retained.
- `linux/` and `windows/` describe the staged `0.2.0` artifact matrices and
  the signing, checksum, package identity, installation, and update evidence
  required before publication.
- `windows/` tracks Microsoft package identity, signed MSI, clean-install, and
  winget submission evidence requirements. After Windows MSI assets are signed,
  run `pnpm --dir opensource/open-studio-platform windows-msi:prepare -- ...`
  on the Windows signing runner to extract SHA-256, Authenticode status, and WiX
  ProductCode metadata, then run `pnpm --dir opensource/open-studio-platform
  winget:prepare -- --metadata <metadata.json> --write` to replace the staged
  winget placeholders.
- `../scripts/generate-checksums.sh` writes release `SHA256SUMS`.
- `../scripts/sign-linux.sh` signs Linux artifacts and checksum files with the
  AuraOne Open release GPG key.
- `../scripts/publish-release.sh` publishes GitHub Releases and mirrors artifacts
  to Cloudflare R2 for `updates.auraone.ai`.

Run the archival evidence gate:

```bash
pnpm --dir opensource/open-studio-platform verify:release-evidence
```

Validate that every current distribution surface targets `0.2.0`, remains
unpublishable, and still preserves `0.1.0` audit evidence:

```bash
pnpm --dir opensource/open-studio-platform verify:distribution-staging
```

Run the coordinated dry-run without publication:

```bash
pnpm --dir opensource/open-studio-platform release:oss:dry-run
```

The dry-run is expected to report current external and artifact blockers while
proving that the plan and validators execute coherently. The publishable gate
must remain closed until every required artifact and channel is independently
verified:

```bash
pnpm --dir opensource/open-studio-platform verify:release-evidence:publishable
```

The `BLOCKED_*`, `BLOCKED-*`, and other staged values under `homebrew/Casks/`
and `winget/*/0.2.0/` are non-publishable templates. Do not submit them to
Homebrew, winget, Linux repositories, VS Code Marketplace, or the updater
service. Replace them only from signed artifact metadata generated for the
exact pushed release commit.
