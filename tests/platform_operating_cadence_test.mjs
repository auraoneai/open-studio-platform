import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const root = new URL("..", import.meta.url);

function read(path) {
  return fs.readFileSync(new URL(path, root), "utf8");
}

test("platform operating cadence documents weekly sync and quarterly health review", () => {
  const text = read("docs/platform-operating-cadence.md");

  for (const snippet of [
    "Weekly Platform Sync",
    "15-minute weekly sync",
    "Rubric, Robotics, and Agent leads",
    "five-business-day deadline",
    "Quarterly Platform Health Review",
    "Diff each flagship",
    "drift backlog",
    "Release Blocking Rules",
  ]) {
    assert.match(text, new RegExp(snippet.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("platform operating cadence documents CODEOWNERS enforcement requirements", () => {
  const text = read("docs/platform-operating-cadence.md");
  const codeowners = read("CODEOWNERS");

  for (const snippet of [
    "Require review from Code Owners",
    "platform contract tests",
    "security checks",
    "template sync",
    "@auraone/platform-owner",
    "@auraone/security",
  ]) {
    assert.match(text, new RegExp(snippet.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }

  assert.match(codeowners, /@auraone\/platform-owner/);
  assert.match(codeowners, /\/security\/ @auraone\/platform-owner @auraone\/security/);
});
