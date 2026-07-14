# Contributing

AuraOne Open Studio Platform uses the Developer Certificate of Origin rather than a CLA. Every commit must include a `Signed-off-by:` trailer.

```bash
git commit --signoff
```

Equivalent short form:

```bash
git commit -s
```

Optional local alias:

```bash
git config --global alias.cs "commit -s"
git cs
```

By signing off, you certify the Developer Certificate of Origin 1.1 at <https://developercertificate.org/>.

## Development

```bash
cargo test --workspace
pnpm install
pnpm verify
pnpm typecheck
pnpm build
```

Platform-owned files are reviewed by the Platform owner in `CODEOWNERS`. Flagship-specific additions must not duplicate platform surfaces for signing, telemetry, keychain, updater, crash reporting, intake packets, installer distribution, docs theme, or the Tauri shell template.

## RFCs

Substantial platform changes use `rfcs/NNNN-title.md`. An RFC requires the Platform owner and one flagship engineering lead to approve before implementation lands.
