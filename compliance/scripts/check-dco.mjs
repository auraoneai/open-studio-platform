#!/usr/bin/env node
import { execFileSync } from "node:child_process";

const args = process.argv.slice(2);
const rangeArg = args.find((arg) => arg.startsWith("--range="));
const range =
  rangeArg?.slice("--range=".length) ?? process.env.DCO_COMMIT_RANGE;

function git(args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

const commits = range
  ? git(["rev-list", range]).split("\n").filter(Boolean)
  : [git(["rev-parse", "HEAD"])];

const failures = [];

for (const commit of commits) {
  const body = git(["show", "-s", "--format=%B", commit]);
  if (!/^Signed-off-by:\s+.+\s+<[^<>@\s]+@[^<>@\s]+>$/im.test(body)) {
    failures.push(`${commit.slice(0, 12)} missing Signed-off-by trailer`);
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(
  `DCO check passed (${commits.length} commit${commits.length === 1 ? "" : "s"})`,
);
