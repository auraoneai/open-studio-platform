import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const root = new URL("..", import.meta.url);

function read(path) {
  return fs.readFileSync(new URL(path, root), "utf8");
}

test("shared flagship handoff checklist covers the PRD per-flagship security gates", () => {
  const text = read("security/checklists/flagship-handoff-security-review.md");

  for (const snippet of [
    "Threat model document",
    "Permission review",
    "Network audit",
    "Telemetry audit",
    "No-network mode",
    "Code signing",
    "notarization",
    "Stable update-channel signing",
    "Crash reporter opt-in flow",
    "Telemetry opt-in flow",
    "Keychain integration",
    "Intake packet flow",
    "Product sidecar subprocess limits",
    "__TAURI__",
    "Platform Security sign-off",
    "exact commit SHA",
    "SBOM hash",
    "CI run URL",
  ]) {
    assert.match(text, new RegExp(snippet.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
  }
});

test("each flagship has a GA security checklist artifact", () => {
  const checklists = [
    ["rubric", "security/checklists/rubric-studio-open-ga.md"],
    ["robotics", "security/checklists/robotics-studio-open-ga.md"],
    ["agent", "security/checklists/agent-studio-open-ga.md"],
  ];

  for (const [flagship, path] of checklists) {
    const text = read(path);
    assert.match(text, /Security (Review )?Checklist/i, `${flagship} checklist must identify itself`);
    assert.match(text, /signed|signing/i, `${flagship} checklist must cover signing`);
    assert.match(text, /telemetry/i, `${flagship} checklist must cover telemetry`);
    assert.match(text, /intake/i, `${flagship} checklist must cover intake`);
  }
});
