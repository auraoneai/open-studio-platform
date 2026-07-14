# MCP Marketplace Listing Draft: Agent Studio Open

Name: Agent Studio Open

Category: Client tooling, testing, debugging

Homepage: https://agentstudio.auraone.ai/

Repository: https://github.com/auraoneai/agent-studio-open

License: MIT

Short description:

Local-first IDE for debugging, replaying, comparing, and regression-testing MCP
and A2A agents.

Long description:

Agent Studio Open connects to MCP servers over stdio, SSE, HTTP, and WebSocket,
inspects tools/resources/prompts, composes schema-aware tool calls, records
sessions, replays sessions deterministically, compares model behavior, imports
OpenTelemetry/Phoenix traces, runs A2A contract checks, and exports regression
suites to CI. Trace data stays local by default; telemetry and crash reporting
are opt-in only.

Security notes:

- User API keys are stored through the OS keychain abstraction.
- Secrets are redacted from logs, trace cards, and CI exports.
- Remote MCP endpoints are treated as untrusted.
- Local stdio servers run through the documented sandbox launcher where the
  operating system supports it.

Submission blocker:

As of 2026-05-13, official MCP marketplace submission access and review
requirements require Anthropic coordination. The launch ops blocker note is in
`docs/release/agent-studio-open-registry-blockers-2026-05-13.md`.
