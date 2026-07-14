# Architecture

Each flagship uses:

- Tauri 2 shell
- React and AuraGlass frontend
- Rust core commands
- Product sidecars over JSON lines when needed
- Platform contracts for keychain, telemetry, crash reporting, updates, and intake
