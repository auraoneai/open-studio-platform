# GPL And LGPL Posture

AuraOne Open Studio Platform is MIT-licensed. The platform cannot ship GPL-linked desktop binaries because reciprocal GPL obligations conflict with the intended MIT distribution model for the shared Tauri shell and flagship apps.

## GPL And AGPL

GPL and AGPL dependencies are denied for shipped desktop binaries, Tauri sidecars, updater code, intake packaging, telemetry, keychain, crash reporting, and platform UI packages.

If a GPL tool is useful during development, it may be used only as a developer-local tool or CI utility when:

- It is not bundled into the shipped app.
- It is not linked into product code.
- Its output does not create derivative code with incompatible license terms.
- Legal approves the usage before release.

## LGPL

LGPL dependencies are conditionally allowed only when dynamically linked and documented in `lgpl-dynamic-linking-register.md`.

Each LGPL entry must include:

- Dependency name and version.
- License expression.
- Which binary or package uses it.
- How it is dynamically linked.
- How users can replace or relink the library where required by the license.
- Reviewer and review date.

Static linking to LGPL libraries is release-blocking unless Legal approves a specific exception and the release docs describe the user's relinking rights.
