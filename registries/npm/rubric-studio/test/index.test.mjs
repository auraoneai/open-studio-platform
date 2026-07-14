import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import test from "node:test";

import {
  packageVersion,
  release,
  validateRubricBundle,
  validateRubricProject,
} from "../src/index.js";

const execFileAsync = promisify(execFile);

const project = {
  id: "helpful-response",
  name: "Helpful response",
  version: "0.2.0",
  branch: "main",
  commentsVisible: true,
  themes: [{ id: "quality" }],
  criteria: [
    {
      id: "clear",
      label: "Clear",
      themeId: "quality",
      weight: 1,
    },
  ],
  samples: [],
  judges: [],
};

test("exports current release metadata", () => {
  assert.equal(packageVersion, "0.2.1");
  assert.equal(release.version, "0.2.0");
  assert.match(release.browserUrl, /^https:/);
  assert.match(release.macos.sha256, /^[a-f0-9]{64}$/);
});

test("accepts a valid portable project", () => {
  assert.deepEqual(validateRubricProject(project), {
    valid: true,
    issues: [],
  });
});

test("accepts a project bundle", () => {
  assert.equal(validateRubricBundle({ project }).valid, true);
});

test("reports missing and duplicate project fields", () => {
  const result = validateRubricProject({
    ...project,
    id: "",
    themes: [{ id: "quality" }, { id: "quality" }],
  });

  assert.equal(result.valid, false);
  assert.ok(result.issues.some((issue) => issue.code === "project.string"));
  assert.ok(
    result.issues.some((issue) => issue.code === "item.id.duplicate"),
  );
});

test("CLI reports the current package version", async () => {
  const { stdout } = await execFileAsync(
    process.execPath,
    ["src/cli.js", "--version"],
    { cwd: new URL("..", import.meta.url) },
  );

  assert.equal(stdout.trim(), "0.2.1");
});
