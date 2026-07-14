# @auraone/agent-studio

MCP manifest validation and release metadata companion for
[Agent Studio Open](https://auraone.ai/open/agent-studio-open), AuraOne's
local-first visual workbench for debugging, replaying, comparing, and
regression-testing AI agents that speak MCP and A2A.

![Agent Studio Open deterministic replay workspace with trace context, replay controls, assertions, and baseline-versus-candidate evidence](https://www.auraone.ai/open/agent-studio-open/screenshots/replay-run.webp)

## Install

```bash
npm install @auraone/agent-studio
```

This dependency-free package validates the discovered MCP manifest boundary and
exposes current browser, docs, source, PyPI CLI, and verified macOS release
metadata. It does not bundle the React/Tauri visual application or the Python
`agentstudio` runtime.

## Validate An MCP Manifest

```js
import { validateAgentManifest } from "@auraone/agent-studio";

const result = validateAgentManifest({
  serverName: "support-crm-mcp",
  version: "0.8.4",
  tools: [{
    name: "lookup_order",
    inputSchema: {
      type: "object",
      properties: { order_id: { type: "string" } },
    },
    risk: [],
  }],
  resources: [],
  prompts: [],
});

if (!result.valid) {
  console.error(result.issues);
}
```

The validator checks required server metadata, collection types, unique tool,
resource, and prompt identifiers, tool input schemas, and resource contracts.
The full Studio adds endpoint discovery, tool composition, trace recording,
replay, comparison, risk review, and evidence export.

## CLI

```bash
npx @auraone/agent-studio --version
npx @auraone/agent-studio --json
npx @auraone/agent-studio validate ./manifest.json
```

Validation exits `0` for a valid manifest, `1` for validation issues, and `2`
for invalid CLI usage or unreadable JSON.

## Full Studio And Runtime

- Package: `@auraone/agent-studio@0.2.2`
- Browser: [agentstudio.auraone.ai](https://agentstudio.auraone.ai)
- Documentation: [Agent Studio Open docs](https://auraone.ai/resources/docs/agent-studio-open)
- Source: [auraoneai/agent-studio-open](https://github.com/auraoneai/agent-studio-open)
- Python runtime: `python -m pip install auraone-agent-studio-open==0.2.1`
- Signed macOS release:
  [Agent Studio Open 0.2.0](https://github.com/auraoneai/agent-studio-open/releases/tag/v0.2.0)

The npm package contains no private font binaries, provider keys, trace
payloads, telemetry uploader, desktop executable, or Python sidecar. Validation
runs locally.

## License

MIT
