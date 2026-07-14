import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  containsPlaceholder,
  expectedArtifactName,
  sha256File,
  validateReleaseEvidence,
} from "../lib/release-evidence.mjs";

const platformRoot = new URL("../..", import.meta.url).pathname;

function load(relativePath) {
  return JSON.parse(readFileSync(new URL(`../../${relativePath}`, import.meta.url), "utf8"));
}

function makeLocalReadyMacOSManifest() {
  const dir = mkdtempSync(join(tmpdir(), "release-evidence-ready-"));
  const manifest = load("distribution/release-evidence/rubric-studio-open/0.2.0.json");
  const artifact = manifest.artifacts.find((item) => item.platform === "macos");
  const localPath = artifact.name;
  const artifactPath = join(dir, localPath);
  const contents = "signed-notarized-dmg-bytes";
  writeFileSync(artifactPath, contents);
  artifact.status = "ready";
  artifact.url = null;
  artifact.sha256 = sha256File(artifactPath);
  artifact.sizeBytes = Buffer.byteLength(contents);
  artifact.localPath = localPath;
  artifact.signing.status = "ready";
  return { artifact, dir, manifest };
}

test("canonical flagship evidence validates in archival mode", () => {
  for (const product of ["rubric-studio-open", "agent-studio-open", "robotics-studio-open"]) {
    const manifest = load(`distribution/release-evidence/${product}/0.1.0.json`);
    const result = validateReleaseEvidence(manifest, { platformRoot });
    assert.deepEqual(result.errors, [], `${product}: ${result.errors.join("; ")}`);
  }
});

test("staged 0.2.0 evidence validates without claiming release artifacts", () => {
  for (const product of ["rubric-studio-open", "agent-studio-open", "robotics-studio-open"]) {
    const manifest = load(`distribution/release-evidence/${product}/0.2.0.json`);
    const result = validateReleaseEvidence(manifest, { platformRoot });
    assert.deepEqual(result.errors, [], `${product}: ${result.errors.join("; ")}`);
    assert.equal(manifest.evidenceKind, "staged");
    assert.equal(manifest.product.version, "0.2.0");
    assert.equal(manifest.release.status, "blocked");
    assert.equal(manifest.release.releaseUrl, null);
    assert.ok(manifest.release.plannedReleaseUrl);
    const ready = manifest.artifacts.filter(
      (artifact) => artifact.status === "ready",
    );
    assert.equal(ready.length, 1);
    assert.equal(ready[0].id, "macos-aarch64-dmg");
    assert.equal(ready[0].url, null);
    assert.match(ready[0].sha256, /^[a-f0-9]{64}$/);
    assert.ok(ready[0].sizeBytes > 0);
    assert.ok(ready[0].localPath);
    assert.equal(ready[0].signing.status, "ready");
    assert.ok(ready[0].blockers.length > 0);
    assert.ok(
      manifest.artifacts
        .filter((artifact) => artifact.status !== "ready")
        .every(
          (artifact) =>
            artifact.status === "blocked" &&
            artifact.url === null &&
            artifact.sha256 === null &&
            artifact.sizeBytes === null &&
            artifact.plannedUrl,
        ),
    );
  }
});

test("staged macOS artifacts may be locally ready without claiming publication", () => {
  const { artifact, dir, manifest } = makeLocalReadyMacOSManifest();
  const result = validateReleaseEvidence(manifest, { platformRoot: dir });
  assert.deepEqual(result.errors, []);
  assert.equal(artifact.url, null);
  assert.ok(artifact.blockers.length > 0);
  assert.ok(manifest.channels.every((channel) => ["blocked", "not-applicable"].includes(channel.status)));
  assert.equal(manifest.updater.status, "blocked");

  const publishable = validateReleaseEvidence(manifest, {
    platformRoot: dir,
    publishable: true,
  });
  assert.ok(publishable.blockers.some((blocker) => blocker.includes("artifact status is ready")));
  assert.ok(publishable.blockers.some((blocker) => blocker.includes("updater status is blocked")));
});

test("staged ready artifacts require truthful local fields and retained blockers", () => {
  const { dir, manifest } = makeLocalReadyMacOSManifest();
  const cases = [
    {
      name: "live URL",
      mutate: (artifact) => {
        artifact.url = artifact.plannedUrl;
      },
      expected: "staged ready artifacts cannot claim a live URL",
    },
    {
      name: "sha256",
      mutate: (artifact) => {
        artifact.sha256 = null;
      },
      expected: "staged ready artifacts require a valid sha256",
    },
    {
      name: "sizeBytes",
      mutate: (artifact) => {
        artifact.sizeBytes = 0;
      },
      expected: "staged ready artifacts require positive sizeBytes",
    },
    {
      name: "localPath",
      mutate: (artifact) => {
        artifact.localPath = null;
      },
      expected: "staged ready artifacts require an existing localPath",
    },
    {
      name: "existing localPath",
      mutate: (artifact) => {
        artifact.localPath = "missing.dmg";
      },
      expected: "localPath does not exist",
    },
    {
      name: "ready signing",
      mutate: (artifact) => {
        artifact.signing.status = "blocked";
      },
      expected: "staged ready artifact signing.status must be ready",
    },
    {
      name: "publication blockers",
      mutate: (artifact) => {
        artifact.blockers = [];
      },
      expected: "staged ready artifacts must retain publication blockers",
    },
  ];

  for (const { name, mutate, expected } of cases) {
    const candidate = structuredClone(manifest);
    const artifact = candidate.artifacts.find((item) => item.platform === "macos");
    mutate(artifact);
    const result = validateReleaseEvidence(candidate, { platformRoot: dir });
    assert.ok(
      result.errors.some((error) => error.includes(expected)),
      `${name}: ${result.errors.join("; ")}`,
    );
  }
});

test("staged local-ready artifacts cannot publish channels or the updater", () => {
  const { dir, manifest } = makeLocalReadyMacOSManifest();
  const channel = manifest.channels.find((item) => item.id === "github-release");
  channel.status = "ready";
  manifest.updater.status = "ready";
  const result = validateReleaseEvidence(manifest, { platformRoot: dir });
  assert.ok(result.errors.some((error) => error.includes("staged channel status")));
  assert.ok(result.errors.some((error) => error.includes("staged updater status")));
});

test("canonical evidence remains blocked in publishable mode", () => {
  const manifest = load("distribution/release-evidence/rubric-studio-open/0.2.0.json");
  const result = validateReleaseEvidence(manifest, { platformRoot, publishable: true });
  assert.equal(result.errors.length, 0);
  assert.ok(result.blockers.some((blocker) => blocker.includes("evidence kind")));
  assert.ok(result.blockers.some((blocker) => blocker.includes("source commit")));
  assert.ok(result.blockers.some((blocker) => blocker.includes("winget")));
});

test("staged evidence cannot contain a live URL, digest, or verified artifact state", () => {
  const manifest = load("distribution/release-evidence/robotics-studio-open/0.2.0.json");
  const artifact = manifest.artifacts[0];
  artifact.status = "verified";
  artifact.url = artifact.plannedUrl;
  artifact.sha256 = "1".repeat(64);
  artifact.sizeBytes = 1234;
  artifact.blockers = [];
  artifact.signing.status = "verified";
  const result = validateReleaseEvidence(manifest, { platformRoot });
  assert.ok(result.errors.some((error) => error.includes("staged artifact status")));
  assert.ok(result.errors.some((error) => error.includes("cannot claim live URL")));
  assert.ok(result.errors.some((error) => error.includes("staged signing status")));
});

test("placeholder values are rejected even when nested", () => {
  const manifest = load("distribution/release-evidence/agent-studio-open/0.1.0.json");
  manifest.channels[0].url = "https://example.com/{{VERSION}}/asset";
  assert.equal(containsPlaceholder(manifest), true);
  const result = validateReleaseEvidence(manifest, { platformRoot });
  assert.ok(result.errors.includes("manifest contains a placeholder token"));
});

test("verified local artifacts must match size and checksum", () => {
  const dir = mkdtempSync(join(tmpdir(), "release-evidence-"));
  writeFileSync(join(dir, "artifact.dmg"), "release-bytes");
  const manifest = load("distribution/release-evidence/rubric-studio-open/0.1.0.json");
  const artifact = manifest.artifacts[0];
  artifact.status = "verified";
  artifact.localPath = "artifact.dmg";
  artifact.sizeBytes = 1;
  artifact.sha256 = "0".repeat(64);
  artifact.blockers = [];
  artifact.signing.status = "verified";
  const result = validateReleaseEvidence(manifest, { platformRoot: dir });
  assert.ok(result.errors.some((error) => error.includes("sizeBytes")));
  assert.ok(result.errors.some((error) => error.includes("sha256")));
});

test("artifact naming is deterministic per product and format", () => {
  assert.equal(
    expectedArtifactName(
      { id: "robotics-studio-open", version: "1.2.3" },
      "windows",
      "arm64",
      "msi",
    ),
    "Robotics-Studio-Open_1.2.3_arm64_en-US.msi",
  );
});
