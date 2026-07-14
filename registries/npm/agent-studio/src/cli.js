#!/usr/bin/env node

import { readFile } from "node:fs/promises";

import {
  packageName,
  packageVersion,
  release,
  validateAgentManifest,
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
      console.error("Usage: agent-studio validate <manifest.json>");
      return 2;
    }
    try {
      const input = JSON.parse(await readFile(filename, "utf8"));
      const result = validateAgentManifest(input);
      console.log(JSON.stringify(result, null, 2));
      return result.valid ? 0 : 1;
    } catch (error) {
      console.error(
        error instanceof Error ? error.message : "Unable to read manifest JSON.",
      );
      return 2;
    }
  }

  console.log(`Agent Studio Open ${release.version}`);
  console.log(`Browser: ${release.browserUrl}`);
  console.log(`Docs: ${release.docsUrl}`);
  console.log(`Release: ${release.releaseUrl}`);
  console.log("");
  console.log("Commands:");
  console.log("  agent-studio --json");
  console.log("  agent-studio validate <manifest.json>");
  return 0;
}

process.exitCode = await run(process.argv.slice(2));
