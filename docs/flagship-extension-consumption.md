# Flagship Extension Consumption

This note is the consumption contract for Platform v0.2 and v0.3 extension crates.

## Rubric First

Rubric Studio Open consumes Platform v0.1 only. It must not depend on the robotics or agent crates. This keeps the first flagship on the smallest substrate: Tauri shell, AuraGlass IDE kit, telemetry, keychain, updater, crash, and intake v1.0.

## Robotics Extensions

Robotics Studio Open may add these Platform v0.2 crates:

- `auraone-platform-video`: build decode plans and select GPU-first backends with libav fallback.
- `auraone-platform-dataset-stream`: stream large dataset files through bounded chunks without leaking absolute paths.
- `auraone-platform-ros-bag`: detect ROS bag layouts and provide the adapter contract used by robotics-specific readers.

Robotics intake packets use `schemas/intake-roles.json` roles introduced in `1.1.0`. Raw video frames, raw sensor bodies, and local filesystem paths remain forbidden.

## Agent Extensions

Agent Studio Open may add these Platform v0.3 crates:

- `auraone-platform-mcp`: use JSON-RPC request/response types with stdio, HTTP, and SSE transports.
- `auraone-platform-otlp`: bind local-only OTLP receivers by default and parse OTLP JSON spans into redaction-ready envelopes.
- `auraone-platform-llm-gateway`: route BYO-key model calls through a uniform request/response and streaming interface without exposing raw API keys.

Agent intake packets use roles introduced in `1.2.0`. MCP metadata and OTLP spans must be redacted before packaging.
