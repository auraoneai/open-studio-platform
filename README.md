# AuraOne Open Studio Platform

AuraOne Open Studio Platform is the shared, product-neutral substrate for
Rubric Studio Open, Agent Studio Open, and Robotics Studio Open. Its job is to
keep the three products on one auditable contract for accessible IDE surfaces,
Tauri shell security, privacy-safe telemetry, crash opt-in, keychain access,
signed updates, `.auraonepkg` intake, release evidence, and documentation.

**For:** maintainers building or reviewing an AuraOne Open desktop, browser,
VS Code, or CLI surface.

**Differentiator:** product workflows stay in their own repositories while
security, evidence, UI, and release rules are implemented and tested once.

## Package Map

| Package | Job | Workspace version | Supported consumption today |
| --- | --- | --- | --- |
| [`@auraone/proofline-oss`](packages/proofline-oss/README.md) | OSS-safe tokens and accessible evidence UI primitives. | `0.1.1` | Public npm `0.1.0` or `workspace:*`; `0.1.1` is release-ready. |
| [`@auraone/aura-ide-kit`](packages/aura-ide-kit/README.md) | IDE-class React components and explicit SSR posture. | `0.2.0` | `workspace:*`; first public npm release is pending registry authorization. |
| [`@auraone/platform-contracts`](packages/platform-contracts/README.md) | Runtime-neutral TypeScript contracts for trust and release behavior. | `0.3.0` | `workspace:*`; first public npm release is pending registry authorization. |
| `@auraone/open-studio-platform` | Private workspace orchestrator for packages, Rust crates, templates, docs, and evidence checks. | `0.4.0` | Source workspace only; it is not an installable runtime package. |

The repository also owns the Tauri template, Rust extension crates, docs
template, compliance checks, distribution manifests, and release-evidence
preflight used by the flagships.

## Minimal Source Quickstart

Use Node.js `20.19.5` or newer and pnpm `10.18.0`:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm build
```

Run the shared proof gates with:

```bash
pnpm typecheck
pnpm test
pnpm release:oss:dry-run
```

The release dry run is intentionally evidence-driven. A successful command can
still report a product as blocked when signed artifacts or publication proof
do not exist.

## What Flagships Inherit

All three Studios inherit:

- Tauri 2 shell conventions and per-command IPC boundaries.
- Canonical CSP, deep-link, keychain, update, telemetry, crash, and intake
  contracts.
- Proofline foundations and the Aura IDE Kit component layer.
- Default-off telemetry and crash posture with local event-log inspection.
- Signed update manifest shapes, signing wrappers, and release checklists.
- `.auraonepkg` schemas with explicit payload roles and privacy exclusions.
- MIT/DCO, security review, documentation, and release-evidence controls.

Robotics additionally consumes extension hooks for dataset adapters, video
decode probes, and ROS readers. Rubric consumes rubric intake roles and
provider-secret scopes. Agent consumes MCP, OTLP, and LLM-gateway extension
contracts. Product-specific behavior remains in each Studio tree; this
workspace does not implement those workflows.

## Runtime And Trust Boundary

- **Runtime:** Proofline and Aura IDE Kit run in React browser or desktop-webview
  surfaces. Platform Contracts is plain TypeScript. Desktop capabilities live
  behind the Tauri/Rust boundary.
- **Data:** contract helpers validate and describe telemetry, crash, keychain,
  updater, and intake behavior. They do not upload product content by
  themselves. A consuming product must make any transport explicit.
- **Network:** endpoint constants and update-manifest types are declarations,
  not background network clients. The canonical CSP limits approved production
  connections, and products can offer a no-network mode.
- **Fonts:** no private licensed font binary belongs in this workspace, an npm
  tarball, a GitHub release source archive, or a Studio package. Public builds
  use the Proofline system-font fallback. An authorized branded deployment may
  provide licensed typography only through a host-owned, approved same-origin
  stylesheet; if it is absent or blocked, the UI must remain complete with the
  system fallback. Isolated capture tooling may use a temporary loopback
  boundary, but it must never copy those binaries into public artifacts.

## Release And Registry Truth

Status verified on **July 13, 2026**:

- `@auraone/proofline-oss@0.1.0` is the current public npm package.
- `@auraone/proofline-oss@0.1.1`, `@auraone/aura-ide-kit@0.2.0`, and
  `@auraone/platform-contracts@0.3.0` pass their package gates and are
  release-ready, but npm publication is blocked until write authorization
  satisfies the registry's 2FA-bypass requirement.
- `auraoneai/open-studio-platform` is the public canonical source repository
  for the shared packages, contracts, templates, and release controls.
- `@auraone/open-studio-platform@0.4.0` remains a private workspace
  orchestrator and is not an installable runtime package.
- `distribution/release-evidence/index.json` marks all three Studio `0.2.0`
  candidates as `blocked`. Archived `0.1.0` evidence is stale for Rubric and
  Agent and partial for Robotics.

The proof artifacts are the package tests, Rust tests, public-asset scanner,
platform contract tests, distribution staging checks, and versioned
`distribution/release-evidence/` records. A README, version number, capture, or
planned URL is not release proof.

## Next Action

Consumers should pin workspace or local-file dependencies and run the focused
package gates before integrating. Release owners should publish package
provenance and replace staged Studio records with verified checksums,
signatures, install/offline checks, notarization, and live registry URLs before
advertising a new public channel.
