import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const root = new URL("..", import.meta.url);

function read(path) {
  return fs.readFileSync(new URL(path, root), "utf8");
}

test("contributor docs explain DCO signoff, no CLA, and git alias guidance", () => {
  const contributing = read("CONTRIBUTING.md");
  const policy = read("compliance/dco/dco-policy.md");
  const readme = read("compliance/dco/README.md");
  const combined = `${contributing}\n${policy}\n${readme}`;

  for (const snippet of [
    "Developer Certificate of Origin",
    "No CLA is required",
    "Signed-off-by:",
    "git commit -s",
    "git config --global alias.cs \"commit -s\"",
    "git cs",
    "DCO GitHub App",
  ]) {
    assert.match(combined, new RegExp(snippet.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
  }
});
