#!/usr/bin/env node
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();
const policy = JSON.parse(
  await readFile(
    path.join(
      repoRoot,
      "opensource/open-studio-platform/compliance/telemetry-forbidden-fields.json",
    ),
    "utf8",
  ),
);

const args = process.argv.slice(2);
const selfTest = args.includes("--self-test");
const roots = args
  .filter((arg) => !arg.startsWith("--"))
  .map((arg) => path.resolve(repoRoot, arg));
const scanRoots =
  roots.length > 0
    ? roots
    : [
        "opensource/open-studio-platform/crates/auraone-platform-telemetry",
        "opensource/open-studio-platform/packages/platform-contracts/src/telemetry.ts",
        "opensource/open-studio-platform/schemas/telemetry.schema.json",
        "opensource/open-studio-platform/schemas/telemetry-events.json",
      ].map((dir) => path.resolve(repoRoot, dir));

const allowedExtensions = new Set([
  ".json",
  ".jsonc",
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".rs",
]);
const failures = [];

function inspectObject(value, location, seen = new Set()) {
  if (!value || typeof value !== "object" || seen.has(value)) {
    return;
  }
  seen.add(value);
  for (const [key, child] of Object.entries(value)) {
    const normalized = key.toLowerCase().replace(/[_-]/g, "");
    for (const forbidden of policy.forbiddenFieldNames) {
      const forbiddenNormalized = forbidden.toLowerCase().replace(/[_-]/g, "");
      if (
        normalized === forbiddenNormalized ||
        normalized.endsWith(forbiddenNormalized)
      ) {
        failures.push(
          `${location}.${key} uses forbidden telemetry field "${forbidden}"`,
        );
      }
    }
    inspectObject(child, `${location}.${key}`, seen);
  }
}

function inspectText(text, file) {
  const lines = text.split(/\r?\n/);
  lines.forEach((line, index) => {
    if (/forbidden|scrub|redact|deny|reject|test|errors\.push/i.test(line)) {
      return;
    }
    if (
      !/payload|trackEvent|recordEvent|sendEvent|createTelemetryEvent|telemetry\.(track|record|send)/i.test(
        line,
      )
    ) {
      return;
    }
    for (const pattern of policy.forbiddenSourcePatterns) {
      const field = pattern
        .replaceAll("\\b", "")
        .replaceAll("\\", "")
        .replaceAll("[_-]?", "_")
        .replaceAll("(", "")
        .replaceAll(")", "");
      const keyPattern = new RegExp(
        `["']?${field}["']?\\s*:|payload\\.insert\\(\\s*["']${field}["']`,
        "i",
      );
      if (keyPattern.test(line)) {
        failures.push(
          `${file}:${index + 1} uses forbidden telemetry payload key ${field}`,
        );
      }
    }
  });
}

async function inspectFile(full) {
  if (!allowedExtensions.has(path.extname(full))) {
    return;
  }
  const relative = path.relative(repoRoot, full);
  if (
    path.extname(full) === ".json" &&
    !path.basename(full).includes("telemetry")
  ) {
    return;
  }
  const text = await readFile(full, "utf8");
  if (full.endsWith(".json")) {
    try {
      inspectObject(JSON.parse(text), relative);
    } catch {
      inspectText(text, relative);
    }
  } else {
    inspectText(text, relative);
  }
}

async function walk(dir) {
  let info;
  try {
    info = await stat(dir);
  } catch {
    return;
  }
  if (info.isFile()) {
    await inspectFile(dir);
    return;
  }
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (
        ["node_modules", "target", "dist", "coverage", ".git"].includes(
          entry.name,
        )
      ) {
        continue;
      }
      await walk(full);
      continue;
    }
    await inspectFile(full);
  }
}

if (selfTest) {
  inspectObject(
    { event_name: "app_opened", payload: { source: "welcome" } },
    "self.valid",
  );
  const before = failures.length;
  inspectObject({ payload: { prompt: "raw prompt" } }, "self.invalid");
  if (failures.length === before) {
    console.error("self-test failed: forbidden prompt field was not detected");
    process.exit(1);
  }
  failures.length = 0;
}

for (const root of scanRoots) {
  await walk(root);
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(
  `telemetry forbidden-field check passed (${scanRoots.length} scan roots)`,
);
