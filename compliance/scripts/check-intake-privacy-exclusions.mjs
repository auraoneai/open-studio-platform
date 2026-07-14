#!/usr/bin/env node
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();
const policy = JSON.parse(
  await readFile(
    path.join(
      repoRoot,
      "opensource/open-studio-platform/compliance/intake-privacy-exclusions.json",
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
        "opensource/open-studio-platform/crates",
        "opensource/open-studio-platform/packages",
        "opensource/open-studio-platform/templates",
        "opensource/open-studio-platform/schemas",
      ].map((dir) => path.resolve(repoRoot, dir));

const failures = [];

function inspectManifest(manifest, location) {
  const privacy = manifest.privacy ?? manifest.privacy_contract;
  if (!privacy || typeof privacy !== "object") {
    failures.push(`${location} missing privacy contract`);
    return;
  }

  for (const required of policy.requiredExclusions) {
    if (privacy[required] !== true) {
      failures.push(`${location} must set privacy.${required}=true`);
    }
  }

  const contact = manifest.contact ?? manifest.submitter ?? {};
  for (const field of policy.explicitUserInputFields) {
    const value = contact[field] ?? manifest[field];
    if (value && typeof value === "string") {
      for (const pattern of policy.disallowedAutofillPatterns) {
        if (new RegExp(pattern, "i").test(value)) {
          failures.push(
            `${location}.${field} appears auto-populated from ${pattern}`,
          );
        }
      }
    }
  }
}

function inspectSource(text, file) {
  if (!/intake|auraonepkg|display_name|privacy_exclusions/i.test(text)) {
    return;
  }
  for (const pattern of policy.disallowedSourcePatterns) {
    if (new RegExp(pattern, "i").test(text)) {
      failures.push(
        `${file} matches disallowed intake privacy source pattern ${pattern}`,
      );
    }
  }
}

async function walk(dir) {
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
    if (!/\.(json|ts|tsx|js|jsx|rs)$/.test(entry.name)) {
      continue;
    }
    const relative = path.relative(repoRoot, full);
    const text = await readFile(full, "utf8");
    if (/intake.*manifest.*\.json$|.*auraonepkg.*\.json$/i.test(entry.name)) {
      try {
        inspectManifest(JSON.parse(text), relative);
      } catch {
        failures.push(`${relative} is not valid JSON`);
      }
    } else {
      inspectSource(text, relative);
    }
  }
}

if (selfTest) {
  inspectManifest(
    {
      contact: { display_name: "User Entered", email: "user@example.com" },
      privacy: {
        user_pii_other_than_explicit_intake: true,
        os_account_identity: true,
        git_identity: true,
        api_keys_or_tokens: true,
        raw_secret_values: true,
      },
    },
    "self.valid",
  );
  const before = failures.length;
  inspectManifest(
    {
      contact: { email: "git config user.email" },
      privacy: { user_pii_other_than_explicit_intake: false },
    },
    "self.invalid",
  );
  if (failures.length === before) {
    console.error("self-test failed: invalid intake manifest was not detected");
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
  `intake privacy exclusion check passed (${scanRoots.length} scan roots)`,
);
