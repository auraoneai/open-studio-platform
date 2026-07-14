#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from "node:fs";

function usage() {
  console.error(
    "Usage: make-tauri-updater-manifest.mjs --version X.Y.Z --out path " +
      "--artifact target:path:url [--notes text]",
  );
}

const args = process.argv.slice(2);
const options = { artifacts: [], notes: "" };
for (let index = 0; index < args.length; index += 1) {
  const argument = args[index];
  if (argument === "--artifact") options.artifacts.push(args[++index]);
  else if (argument === "--version") options.version = args[++index];
  else if (argument === "--out") options.out = args[++index];
  else if (argument === "--notes") options.notes = args[++index];
  else if (argument === "-h" || argument === "--help") {
    usage();
    process.exit(0);
  } else {
    throw new Error(`unknown option: ${argument}`);
  }
}

if (!options.version || !options.out || options.artifacts.length === 0) {
  usage();
  process.exit(2);
}

const platforms = {};
for (const value of options.artifacts) {
  const [target, path, ...urlParts] = value.split(":");
  const url = urlParts.join(":");
  if (!target || !path || !url) {
    throw new Error(`invalid --artifact value: ${value}`);
  }
  if (!existsSync(path)) throw new Error(`updater artifact does not exist: ${path}`);
  if (!existsSync(`${path}.sig`)) {
    throw new Error(`Tauri updater signature does not exist: ${path}.sig`);
  }
  if (!url.startsWith("https://")) {
    throw new Error(`updater artifact URL must use HTTPS: ${url}`);
  }
  const signature = readFileSync(`${path}.sig`, "utf8").trim();
  if (!/^[A-Za-z0-9+/=]+$/.test(signature)) {
    throw new Error(`invalid Tauri updater signature encoding: ${path}.sig`);
  }
  if (platforms[target]) throw new Error(`duplicate updater target: ${target}`);
  platforms[target] = { signature, url };
}

const manifest = {
  version: options.version,
  notes: options.notes,
  pub_date: new Date().toISOString(),
  platforms,
};

writeFileSync(options.out, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Wrote Tauri updater manifest: ${options.out}`);
