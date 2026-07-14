#!/usr/bin/env node

import { readFile } from "node:fs/promises";

import {
  packageName,
  packageVersion,
  release,
  validateRubricBundle,
} from "./index.js";

async function run(argv) {
  if (argv.includes("--version") || argv.includes("-v")) {
    console.log(packageVersion);
    return 0;
  }

  if (argv.includes("--json")) {
    console.log(JSON.stringify({ packageName, packageVersion, release }, null, 2));
    return 0;
  }

  if (argv[0] === "validate") {
    const filename = argv[1];
    if (!filename) {
      console.error("Usage: rubric-studio validate <project.json>");
      return 2;
    }

    try {
      const input = JSON.parse(await readFile(filename, "utf8"));
      const result = validateRubricBundle(input);
      console.log(JSON.stringify(result, null, 2));
      return result.valid ? 0 : 1;
    } catch (error) {
      console.error(
        error instanceof Error ? error.message : "Unable to read project JSON.",
      );
      return 2;
    }
  }

  console.log(`Rubric Studio Open ${release.version}`);
  console.log(`Browser: ${release.browserUrl}`);
  console.log(`Docs: ${release.docsUrl}`);
  console.log(`Release: ${release.releaseUrl}`);
  console.log("");
  console.log("Commands:");
  console.log("  rubric-studio --json");
  console.log("  rubric-studio validate <project.json>");
  return 0;
}

process.exitCode = await run(process.argv.slice(2));
