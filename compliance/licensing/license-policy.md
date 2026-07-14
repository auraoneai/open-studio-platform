# License Policy

AuraOne Open Studio Platform and the three Open Studio flagships ship under MIT.

## Required Posture

- Platform source code: MIT.
- Flagship source code: MIT unless a Platform RFC approves an exception.
- Permissive third-party licenses such as MIT, BSD, ISC, and Apache-2.0 are
  allowed by default when the package is otherwise suitable for the shipped
  surface.
- Contributor model: DCO, no CLA.
- Shipped desktop binaries: no GPL or AGPL linked dependencies.
- LGPL dependencies: allowed only when dynamically linked, documented, and reviewed before release.
- Third-party notices: generated for every release and reviewed before publication.

## Automated Enforcement

- Rust licenses are enforced by `cargo-deny` using `configs/cargo-deny/deny.toml`.
- npm licenses are enforced by `compliance/scripts/check-npm-licenses.mjs` using `configs/license/npm-license-policy.json`.
- Release SBOMs are generated in CycloneDX format.
- Security CI must fail on denied, unknown, or unreviewed licenses.

## Manual Review Triggers

Manual Platform Security and Legal review is required when:

- A dependency has `UNKNOWN`, custom, proprietary, GPL, AGPL, SSPL, BUSL, Commons Clause, PolyForm, Elastic License, or other non-standard terms.
- A dependency is LGPL and may be statically linked.
- A product wants to bundle sample data, model weights, video, traces, prompts, or generated assets.
- A dependency ships native code or downloads runtime binaries during install.
