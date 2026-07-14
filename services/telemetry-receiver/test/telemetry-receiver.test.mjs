import test from "node:test";
import assert from "node:assert/strict";
import { handleTelemetryRequest } from "../src/index.mjs";

function event(overrides = {}) {
  return {
    $schema: "https://schemas.auraone.ai/open-studio/telemetry/v1.json",
    event_id: "550e8400-e29b-41d4-a716-446655440000",
    event_name: "app_launched",
    event_version: 1,
    app: { flagship: "rubric-studio-open", version: "0.1.0", channel: "stable" },
    device: {
      install_id: "550e8400-e29b-41d4-a716-446655440001",
      os: "darwin",
      os_version: "15.0",
      arch: "aarch64"
    },
    session_id: "550e8400-e29b-41d4-a716-446655440002",
    timestamp: "2026-05-14T00:00:00.000Z",
    payload: {},
    ...overrides
  };
}

test("accepts a valid telemetry batch and stores it", async () => {
  const stored = {};
  const response = await handleTelemetryRequest(
    new Request("https://o.auraone.ai/v1/events", {
      method: "POST",
      body: JSON.stringify({ events: [event()] }),
      headers: { "content-type": "application/json" }
    }),
    {
      TELEMETRY_BUCKET: {
        async put(key, value, options) {
          stored.key = key;
          stored.value = value;
          stored.options = options;
        }
      }
    }
  );

  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.accepted, true);
  assert.equal(body.event_count, 1);
  assert.match(stored.key, /^rubric-studio-open\/\d{4}-\d{2}-\d{2}\//);
  assert.equal(stored.options.customMetadata.flagship, "rubric-studio-open");
});

test("rejects forbidden telemetry payload keys", async () => {
  const response = await handleTelemetryRequest(
    new Request("https://o.auraone.ai/v1/events", {
      method: "POST",
      body: JSON.stringify({ events: [event({ payload: { file_path: "/Users/me/project" } })] }),
      headers: { "content-type": "application/json" }
    }),
    {}
  );
  const body = await response.json();

  assert.equal(response.status, 422);
  assert.equal(body.error_code, "telemetry_validation_failed");
  assert.match(JSON.stringify(body.diagnostics), /forbidden|paths/);
});

test("enforces the 100 event batch limit", async () => {
  const response = await handleTelemetryRequest(
    new Request("https://o.auraone.ai/v1/events", {
      method: "POST",
      body: JSON.stringify({ events: Array.from({ length: 101 }, () => event()) }),
      headers: { "content-type": "application/json" }
    }),
    {}
  );
  const body = await response.json();

  assert.equal(response.status, 413);
  assert.equal(body.error_code, "batch_too_large");
});
