import assert from "node:assert/strict";
import fs from "node:fs";

const policy = JSON.parse(fs.readFileSync(new URL("../schemas/intake-schema-policy.json", import.meta.url), "utf8"));
const roles = JSON.parse(fs.readFileSync(new URL("../schemas/intake-roles.json", import.meta.url), "utf8"));

assert.equal(policy.current_major, 1);
assert.deepEqual(policy.accepted_major_versions, [1]);
assert.equal(policy.cloud_acceptance_rule, "last_three_schema_majors");
assert.equal(policy.breaking_change_deprecation_months, 18);
assert.equal(policy.minor_change_policy, "additive_roles_only");
assert.equal(policy.schema_urls.v1, "https://schemas.auraone.ai/open-studio/intake-packet/v1.json");

const introducedVersions = new Set(roles.roles.map((entry) => entry.introduced_in));
assert.deepEqual([...introducedVersions].sort(), ["1.0.0", "1.1.0", "1.2.0"]);

for (const entry of roles.roles) {
  assert.match(entry.introduced_in, /^1\.\d+\.0$/, `${entry.role} must be additive within intake v1`);
}
