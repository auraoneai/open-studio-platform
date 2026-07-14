import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const root = new URL("..", import.meta.url);

function read(path) {
  return fs.readFileSync(new URL(path, root), "utf8");
}

test("docs template includes required maintainer page content", () => {
  const text = read("docs-template/docs/maintainers.md");

  for (const snippet of [
    "https://auraone.ai/open/maintainers",
    "@auraone/platform-owner",
    "@auraone/security",
    "@auraone/auraglass",
    "@auraone/docs",
    "@auraone/rubric-lead",
    "@auraone/robotics-lead",
    "@auraone/agent-lead",
    "release manager",
    "security reviewer",
    "CODEOWNERS",
  ]) {
    assert.match(text, new RegExp(snippet.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("docs template sidebar links the maintainer page", () => {
  const text = read("docs-template/sidebars.ts");

  assert.match(text, /"maintainers"/);
});
