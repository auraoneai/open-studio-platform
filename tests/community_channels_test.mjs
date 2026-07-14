import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const root = new URL("..", import.meta.url);

function read(path) {
  return fs.readFileSync(new URL(path, root), "utf8");
}

test("community channel docs cover required public and private routes", () => {
  const text = read("community/channels.md");

  for (const snippet of [
    "GitHub Issues",
    "GitHub Discussions",
    "Discord `#rubric-studio-open`",
    "Discord `#robotics-studio-open`",
    "Discord `#agent-studio-open`",
    "Discord `#open-studio-platform`",
    "security@auraone.ai",
    "partners@auraone.ai",
    "Do not post secrets",
  ]) {
    assert.match(text, new RegExp(snippet.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("discussion seed docs cover all three flagships", () => {
  const text = read("community/github-discussions-seeds.md");

  for (const snippet of [
    "auraoneai/rubric-studio-open",
    "auraoneai/robotics-studio-open",
    "auraoneai/agent-studio-open",
    "Security and privacy questions",
    "Do not post private prompts",
    "Do not post proprietary lab videos",
    "Move reproducible bugs to GitHub Issues",
  ]) {
    assert.match(text, new RegExp(snippet.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});
