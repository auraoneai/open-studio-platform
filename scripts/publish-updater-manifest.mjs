import { createHash, sign } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const flagship = process.env.AURAONE_FLAGSHIP ?? "agent-studio-open";
const channel = process.env.AURAONE_RELEASE_CHANNEL ?? "stable";
const version = process.env.GITHUB_REF_NAME?.replace(/^v/, "") ?? "0.0.0";
const privateKey = process.env.AURAONE_UPDATE_SIGNING_KEY;

if (!privateKey) {
  throw new Error("AURAONE_UPDATE_SIGNING_KEY is required");
}

const bundleDir = process.env.AURAONE_BUNDLE_DIR ?? "src-tauri/target/release/bundle";
const files = await walk(bundleDir);
const platforms = {};
const checksums = {};

for (const file of files.filter((path) => /\.(app\.tar\.gz|msi|AppImage|deb|rpm|dmg)$/.test(path))) {
  const bytes = await readFile(file);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const platform = platformFromArtifact(file);
  platforms[platform] = {
    signature: sign(null, Buffer.from(sha256, "utf8"), privateKey).toString("base64"),
    url: `https://updates.auraone.ai/${flagship}/${channel}/${version}/${file.split("/").pop()}`
  };
  checksums[file.split("/").pop()] = sha256;
}

const manifest = {
  schema_version: "1.0.0",
  flagship,
  version,
  notes: process.env.AURAONE_RELEASE_NOTES ?? "",
  pub_date: new Date().toISOString(),
  platforms,
  checksums,
  rollout: {
    percentage: Number(process.env.AURAONE_ROLLOUT_PERCENTAGE ?? 10),
    mandatory: process.env.AURAONE_UPDATE_MANDATORY === "true",
    min_version: process.env.AURAONE_MIN_VERSION ?? "0.0.0",
    kill_switch: process.env.AURAONE_UPDATE_KILL_SWITCH === "true"
  },
  channel,
  manifest_signature_algorithm: "ed25519",
  manifest_signature: ""
};

manifest.manifest_signature = sign(
  null,
  Buffer.from(stableStringify(manifest)),
  privateKey,
).toString("base64");

await writeFile("updater-manifest.json", JSON.stringify(manifest, null, 2));

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

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  const results = [];
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...await walk(path));
    } else {
      results.push(path);
    }
  }
  return results;
}

function platformFromArtifact(path) {
  if (path.includes("aarch64") && path.includes("darwin")) return "darwin-aarch64";
  if (path.includes("x86_64") && path.includes("darwin")) return "darwin-x86_64";
  if (path.endsWith(".msi") || path.endsWith(".exe")) return "windows-x86_64";
  if (path.endsWith(".AppImage") || path.endsWith(".deb") || path.endsWith(".rpm")) return "linux-x86_64";
  return "unknown";
}
