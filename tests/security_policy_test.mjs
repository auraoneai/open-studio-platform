import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const root = new URL("..", import.meta.url);

test("security policy covers disclosure, PGP placeholder, response targets, safe harbor, and credit", () => {
  const text = fs.readFileSync(new URL("SECURITY.md", root), "utf8");

  for (const snippet of [
    "security@auraone.ai",
    "PGP key",
    "https://auraone.ai/open/security/pgp.txt",
    "What To Report",
    "signing-key issues",
    "update compromise",
    "Response Targets",
    "Safe Harbor",
    "Researcher Credit",
    "request anonymity",
  ]) {
    assert.match(text, new RegExp(snippet.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("security PGP placeholder remains explicit until the real key is published", () => {
  const text = fs.readFileSync(new URL("security/contacts/pgp-placeholder.asc", root), "utf8");

  assert.match(text, /BEGIN PGP PUBLIC KEY BLOCK/);
  assert.match(text, /REPLACE_WITH_SECURITY_PGP_FINGERPRINT/);
  assert.match(text, /REPLACE_WITH_ARMORED_PUBLIC_KEY/);
});
