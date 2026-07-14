#!/usr/bin/env node

import { readFile } from "node:fs/promises";

import {
  packageName,
  packageVersion,
  release,
  validateDatasetManifest,
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
      console.error("Usage: robotics-studio validate <manifest.json>");
      return 2;
    }
    try {
      const input = JSON.parse(await readFile(filename, "utf8"));
      const result = validateDatasetManifest(input);
      console.log(JSON.stringify(result, null, 2));
      return result.valid ? 0 : 1;
    } catch (error) {
      console.error(
        error instanceof Error ? error.message : "Unable to read manifest JSON.",
      );
      return 2;
    }
  }

  console.log(`Robotics Studio Open ${release.version}`);
  console.log(`Browser: ${release.browserUrl}`);
  console.log(`Release: ${release.releaseUrl}`);
  console.log("");
  console.log("Commands:");
  console.log("  robotics-studio --json");
  console.log("  robotics-studio validate <manifest.json>");
  return 0;
}

process.exitCode = await run(process.argv.slice(2));
