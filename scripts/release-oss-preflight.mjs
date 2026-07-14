#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const platformRoot = path.resolve(scriptDir, "..");
const repoRoot = path.resolve(platformRoot, "../..");
const planArg = valueAfter("--release-plan") ?? "distribution/release-plan.uiuxoss.json";
const planPath = path.resolve(platformRoot, planArg);
const allowBlocked = process.argv.includes("--allow-blocked");
const json = process.argv.includes("--json");

function valueAfter(flag) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : null;
}

if (!fs.existsSync(planPath)) {
  console.error(`release plan does not exist: ${planPath}`);
  process.exit(1);
}

const plan = JSON.parse(fs.readFileSync(planPath, "utf8"));
const errors = [];
const blockers = [];

if (plan.mode !== "dry-run") errors.push("release plan mode must be dry-run");
if (plan.publication?.enabled !== false) errors.push("dry-run release plan must disable publication");
if (plan.sourceCommit === null) {
  blockers.push("release plan has no exact pushed source commit");
} else if (!/^[0-9a-f]{40}$/.test(plan.sourceCommit ?? "")) {
  errors.push("release plan sourceCommit must be null or an exact 40-character Git commit");
}
if (!Array.isArray(plan.products) || plan.products.length !== 3) {
  errors.push("release plan must contain exactly the three flagship products");
}

const head = spawnSync("git", ["rev-parse", "HEAD"], { cwd: repoRoot, encoding: "utf8" });
if (head.status !== 0) {
  errors.push("could not resolve repository HEAD");
} else if (plan.sourceCommit && head.stdout.trim() !== plan.sourceCommit) {
  blockers.push(
    `release plan sourceCommit ${plan.sourceCommit} does not match current HEAD ${head.stdout.trim()}`,
  );
}

for (const product of plan.products ?? []) {
  if (product.status === "blocked") blockers.push(...product.blockers.map((item) => `${product.id}: ${item}`));
  if (product.sourceVersion !== "0.2.0" || product.releaseVersion !== "0.2.0") {
    errors.push(`${product.id}: sourceVersion and releaseVersion must both be 0.2.0`);
  }
  for (const key of ["archivalEvidence", "stagedEvidence"]) {
    if (!fs.existsSync(path.join(platformRoot, product[key] ?? ""))) {
      errors.push(`${product.id}: ${key} does not exist`);
    }
  }
}

const gateResults = [];
for (const gate of plan.gates ?? []) {
  const parts = gate.command.split(" ");
  const command = parts.shift();
  const result = spawnSync(command, parts, {
    cwd: platformRoot,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 20,
  });
  const expectedBlockedGate = gate.id === "release-evidence-publishable";
  const passed = result.status === 0;
  const blockedAsExpected = expectedBlockedGate && result.status === 2;
  gateResults.push({
    id: gate.id,
    command: gate.command,
    passed,
    blockedAsExpected,
    exitCode: result.status,
    stdout: (result.stdout ?? "").trim(),
    stderr: (result.stderr ?? "").trim(),
  });
  if (!passed && !blockedAsExpected) {
    errors.push(`${gate.id}: gate exited ${result.status}`);
  }
  if (blockedAsExpected) {
    blockers.push(`${gate.id}: canonical evidence is not publishable`);
  }
}

const report = {
  ok: errors.length === 0 && (allowBlocked || blockers.length === 0),
  dryRun: true,
  publicationAttempted: false,
  plan: path.relative(platformRoot, planPath),
  sourceCommit: plan.sourceCommit,
  currentHead: head.stdout?.trim() ?? null,
  gates: gateResults,
  errors: [...new Set(errors)],
  blockers: [...new Set(blockers)],
};

if (json) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`OSS release dry-run: ${report.ok ? "PASS" : "BLOCKED"}`);
  console.log(`Publication attempted: ${report.publicationAttempted}`);
  for (const gate of gateResults) {
    console.log(`${gate.id}: ${gate.passed ? "passed" : gate.blockedAsExpected ? "blocked as expected" : "failed"}`);
  }
  for (const error of report.errors) console.error(`ERROR: ${error}`);
  for (const blocker of report.blockers) console.error(`BLOCKED: ${blocker}`);
}

process.exit(report.ok ? 0 : errors.length ? 1 : 2);
