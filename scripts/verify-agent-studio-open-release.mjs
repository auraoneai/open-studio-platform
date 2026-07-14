#!/usr/bin/env node
import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";

const releaseDir = process.argv[2] || "dist/signed";

if (!fs.existsSync(releaseDir)) {
  console.error(`release directory not found: ${releaseDir}`);
  process.exit(1);
}

const files = fs
  .readdirSync(releaseDir, { recursive: true, withFileTypes: true })
  .filter((entry) => entry.isFile())
  .map((entry) => path.join(entry.path, entry.name))
  .filter((file) => !file.endsWith("SHA256SUMS"));

if (files.length === 0) {
  console.error(`no release artifacts found in ${releaseDir}`);
  process.exit(1);
}

const sums = files
  .sort()
  .map((file) => {
    const digest = crypto
      .createHash("sha256")
      .update(fs.readFileSync(file))
      .digest("hex");
    return `${digest}  ${path.relative(releaseDir, file)}`;
  })
  .join("\n");

fs.writeFileSync(path.join(releaseDir, "SHA256SUMS"), `${sums}\n`);
console.log(`verified ${files.length} Agent Studio Open release artifacts`);
