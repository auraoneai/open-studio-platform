import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import test from "node:test";

import {
  packageVersion,
  release,
  validateAgentManifest,
} from "../src/index.js";

const execFileAsync = promisify(execFile);

const manifest = {
  serverName: "support-crm-mcp",
  version: "0.8.4",
  tools: [
    {
      name: "lookup_order",
      inputSchema: {
        type: "object",
        properties: { order_id: { type: "string" } },
      },
      risk: [],
    },
  ],
  resources: [
    {
      uri: "orders://events/{order_id}",
      name: "Order events",
      mimeType: "application/jsonl",
    },
  ],
  prompts: [{ name: "refund_triage", description: "Triage a refund." }],
};

test("exports current Agent Studio release metadata", () => {
  assert.equal(packageVersion, "0.2.2");
  assert.equal(release.version, "0.2.0");
  assert.match(release.macos.sha256, /^[a-f0-9]{64}$/);
});

test("accepts an Agent Studio MCP manifest", () => {
  assert.deepEqual(validateAgentManifest(manifest), {
    valid: true,
    issues: [],
  });
});

test("reports duplicate tools and invalid schemas", () => {
  const result = validateAgentManifest({
    ...manifest,
    tools: [
      manifest.tools[0],
      { name: "lookup_order", inputSchema: [] },
    ],
  });
  assert.equal(result.valid, false);
  assert.ok(
    result.issues.some((issue) => issue.code === "item.name.duplicate"),
  );
  assert.ok(
    result.issues.some((issue) => issue.code === "tool.input-schema"),
  );
});

test("CLI reports the current version", async () => {
  const { stdout } = await execFileAsync(
    process.execPath,
    ["src/cli.js", "--version"],
    { cwd: new URL("..", import.meta.url) },
  );
  assert.equal(stdout.trim(), "0.2.2");
});
