# AuraOne Open Studio Tauri App Template

This template is the canonical Tauri 2 shell consumed by Rubric Studio Open, Robotics Studio Open, and Agent Studio Open.

## Pinned Toolchain

| Dependency | Version |
| --- | --- |
| Tauri CLI | `2.11.1` |
| Tauri Rust crate | `2.11.1` |
| `@tauri-apps/api` | `2.11.0` |
| Rust | `1.94.0` via `src-tauri/rust-toolchain.toml` |
| Node | `20.19.5` |
| pnpm | `10.18.0` |
| React | `18.3.1` |
| TypeScript | `5.9.3` |
| Vite | `5.4.21` |
| AuraGlass | `aura-glass@3.1.1` |

## Security Defaults

- `auraone://` URL scheme is registered in `src-tauri/tauri.conf.json`.
- CSP omits `unsafe-eval` and pins `connect-src` to the Platform endpoints.
- Tauri global API is disabled with `withGlobalTauri: false`.
- Capabilities are scoped to project-folder I/O, dialogs, notifications, OS metadata, process sidecars, updater, clipboard, and deep-link handling.
- `shell:open`, `shell:execute`, and arbitrary HTTP permissions are excluded by default.
- IPC commands validate folder paths and never log secrets.
- The template keeps `bundle.externalBin` empty so it compiles before a flagship sidecar exists; each flagship adds its own signed Python/Rust sidecar binary during product integration.
- The included icon is a valid RGBA placeholder for template verification; each flagship replaces it with validated PNG/ICO/ICNS product assets before release.

## Project-As-Folder

The shell opens a user-selected folder and stores a lightweight `.auraone/project.json` descriptor inside it. The flagship owns the contents of the folder; the platform owns the open-folder, recent-project, deep-link, and command-palette contracts.

Supported entry points:

- File picker: command `project.open-folder`
- Drag and drop: renderer forwards folder paths to IPC
- Deep link: `auraone://<flagship>/open?path=/absolute/project`
- CLI: pass a folder path directly, or use `--project /absolute/project`

## Sidecar IPC Policy

Flagships default to subprocess sidecars for engine-library work. The shared `auraone-platform-sidecar` crate owns the JSON-line request envelope, subprocess timeout, output limit, and crash isolation contract. PyO3 embedding is allowed only when a measured interactive path would exceed 50 ms per call over the JSON-line sidecar protocol.

Each flagship must document PyO3 exceptions in its security review and keep sidecars listed in `bundle.externalBin` so release signing covers nested binaries before the app bundle is signed.

## Build Matrix

| OS | Arch | Format |
| --- | --- | --- |
| macOS 12+ | x86_64 | `.dmg`, `.app.tar.gz` |
| macOS 12+ | aarch64 | `.dmg`, `.app.tar.gz` |
| macOS 12+ | universal | `.dmg` |
| Windows 10+ | x86_64 | `.msi`, portable `.exe` |
| Windows 10+ | aarch64 | `.msi` advisory |
| Linux glibc 2.31+ | x86_64 | `.AppImage`, `.deb`, `.rpm` |
| Linux glibc 2.31+ | aarch64 | `.AppImage`, `.deb` |

## Commands

```bash
pnpm install
pnpm build
pnpm rust:check
pnpm tauri:dev
pnpm tauri:build
```

`pnpm verify` runs the frontend production build and Rust compile check.
