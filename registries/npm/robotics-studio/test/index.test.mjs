import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import test from "node:test";

import {
  packageVersion,
  release,
  validateDatasetManifest,
} from "../src/index.js";

const execFileAsync = promisify(execFile);

const manifest = {
  schema: "auraone.robotics.dataset-manifest.v1",
  name: "so101_kitchen_v3",
  format: "LeRobot v3 metadata",
  provenance: "repository-synthetic-fixture",
  meta: { control_rate_hz: 30 },
  episodes: [
    {
      id: "episode-001",
      task: "pick_apple",
      duration_s: 12.75,
      frame_rate_hz: 30,
      sensors: [],
    },
  ],
};

test("exports current Robotics Studio release metadata", () => {
  assert.equal(packageVersion, "0.2.1");
  assert.equal(release.version, "0.2.0");
  assert.match(release.macos.sha256, /^[a-f0-9]{64}$/);
});

test("accepts a Robotics Studio dataset manifest", () => {
  assert.deepEqual(validateDatasetManifest(manifest), {
    valid: true,
    issues: [],
  });
});

test("reports duplicate episode IDs and invalid rates", () => {
  const result = validateDatasetManifest({
    ...manifest,
    episodes: [
      manifest.episodes[0],
      { id: "episode-001", frame_rate_hz: 0 },
    ],
  });
  assert.equal(result.valid, false);
  assert.ok(
    result.issues.some((issue) => issue.code === "episode.id.duplicate"),
  );
  assert.ok(
    result.issues.some((issue) => issue.code === "episode.frame-rate"),
  );
});

test("CLI reports the current version", async () => {
  const { stdout } = await execFileAsync(
    process.execPath,
    ["src/cli.js", "--version"],
    { cwd: new URL("..", import.meta.url) },
  );
  assert.equal(stdout.trim(), "0.2.1");
});
