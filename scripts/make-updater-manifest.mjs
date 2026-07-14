#!/usr/bin/env node
import { createHash, createPrivateKey, sign } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { basename } from "node:path";

function usage() {
  console.error(`Usage: make-updater-manifest.mjs --flagship id --version X.Y.Z --channel stable --out path --artifact target:path:url [--notes text]
  [--rollout-percentage 10] [--min-version 0.0.0] [--mandatory] [--kill-switch]

Each --artifact value is target:path:url, for example:
  darwin-aarch64:dist/app.dmg:https://github.com/.../app.dmg

If a sibling .sig file exists, its contents are used as the Tauri artifact
signature. Otherwise AURAONE_UPDATE_SIGNING_KEY_PEM is used to create a base64
Ed25519 signature over the artifact SHA-256 digest.`);
}

const args = process.argv.slice(2);
const opts = { artifacts: [], notes: "" };
for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  if (arg === "--artifact") opts.artifacts.push(args[++i]);
  else if (arg === "--flagship") opts.flagship = args[++i];
  else if (arg === "--version") opts.version = args[++i];
  else if (arg === "--channel") opts.channel = args[++i];
  else if (arg === "--out") opts.out = args[++i];
  else if (arg === "--notes") opts.notes = args[++i];
  else if (arg === "--rollout-percentage") opts.rolloutPercentage = Number(args[++i]);
  else if (arg === "--min-version") opts.minVersion = args[++i];
  else if (arg === "--mandatory") opts.mandatory = true;
  else if (arg === "--kill-switch") opts.killSwitch = true;
  else if (arg === "-h" || arg === "--help") {
    usage();
    process.exit(0);
  } else {
    throw new Error(`unknown option: ${arg}`);
  }
}

for (const required of ["flagship", "version", "channel", "out"]) {
  if (!opts[required]) {
    usage();
    process.exit(2);
  }
}
if (opts.artifacts.length === 0) throw new Error("at least one --artifact is required");

const privateKeyPem = process.env.AURAONE_UPDATE_SIGNING_KEY_PEM || "";
const privateKey = privateKeyPem ? createPrivateKey(privateKeyPem) : null;

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function artifactSignature(path, digestHex) {
  const sigPath = `${path}.sig`;
  if (existsSync(sigPath)) return readFileSync(sigPath, "utf8").trim();
  if (!privateKey) {
    throw new Error(`missing ${sigPath} and AURAONE_UPDATE_SIGNING_KEY_PEM`);
  }
  return sign(null, Buffer.from(digestHex, "hex"), privateKey).toString("base64");
}

function stableStringify(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

const platforms = {};
const checksums = {};

for (const value of opts.artifacts) {
  const [target, path, ...urlParts] = value.split(":");
  const url = urlParts.join(":");
  if (!target || !path || !url) throw new Error(`invalid --artifact value: ${value}`);
  const bytes = readFileSync(path);
  const digest = sha256(bytes);
  platforms[target] = {
    signature: artifactSignature(path, digest),
    url
  };
  checksums[basename(path)] = digest;
}

const body = {
  schema_version: "1.0.0",
  flagship: opts.flagship,
  version: opts.version,
  notes: opts.notes,
  pub_date: new Date().toISOString(),
  platforms,
  checksums,
  rollout: {
    percentage: Number.isFinite(opts.rolloutPercentage) ? opts.rolloutPercentage : 10,
    mandatory: Boolean(opts.mandatory),
    min_version: opts.minVersion || "0.0.0",
    kill_switch: Boolean(opts.killSwitch)
  },
  channel: opts.channel,
  manifest_signature_algorithm: "ed25519",
  manifest_signature: ""
};

if (privateKey) {
  const canonical = stableStringify(body);
  body.manifest_signature = sign(null, Buffer.from(canonical), privateKey).toString("base64");
}

writeFileSync(opts.out, `${JSON.stringify(body, null, 2)}\n`);
console.log(`Wrote updater manifest: ${opts.out}`);
