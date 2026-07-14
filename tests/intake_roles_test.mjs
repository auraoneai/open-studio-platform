import assert from "node:assert/strict";
import fs from "node:fs";

const registry = JSON.parse(fs.readFileSync(new URL("../schemas/intake-roles.json", import.meta.url), "utf8"));
const roles = registry.roles.map((entry) => entry.role);

assert.equal(registry.schema_version, "1.2.0");
for (const required of [
  "rubric_definition",
  "robotics_reviewed_subset_manifest",
  "robotics_episode_reference",
  "robotics_failure_cluster",
  "robotics_intervention_note",
  "robotics_embodiment_card",
  "robotics_sensor_qa_report",
  "agent_mcp_server_metadata",
  "agent_trace_card",
  "agent_regression_test_suite",
  "agent_otel_spans",
]) {
  assert.ok(roles.includes(required), `${required} is registered`);
}

const roboticsRawDenied = registry.roles.find((entry) => entry.role === "robotics_episode_reference");
assert.equal(roboticsRawDenied.raw_payload_allowed, false);

const agentRawDenied = registry.roles.find((entry) => entry.role === "agent_otel_spans");
assert.equal(agentRawDenied.raw_payload_allowed, false);
