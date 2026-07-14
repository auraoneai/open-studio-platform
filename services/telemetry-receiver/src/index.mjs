const FLAGSHIPS = new Set(["rubric-studio-open", "robotics-studio-open", "agent-studio-open"]);
const CHANNELS = new Set(["stable", "beta", "nightly"]);
const OSES = new Set(["darwin", "windows", "linux"]);
const ARCHES = new Set(["x86_64", "aarch64"]);
const EVENTS = new Set([
  "app_launched",
  "welcome_wizard_completed",
  "update_check_performed",
  "update_applied",
  "feature_used",
  "error_encountered",
  "session_ended",
  "intake_packet_exported",
  "robotics_dataset_opened",
  "robotics_feature_used",
  "robotics_export_completed",
  "agent_protocol_surface_used"
]);

const TELEMETRY_SCHEMA_ID = "https://schemas.auraone.ai/open-studio/telemetry/v1.json";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SEMVER_RE = /^[0-9]+\.[0-9]+\.[0-9]+(?:[-+][0-9A-Za-z.-]+)?$/;
const EVENT_NAME_RE = /^[a-z][a-z0-9_]*$/;
const FORBIDDEN_KEY_RE = /(content|text|prompt|sample|rubric|criterion|trace|path|hostname|ip|email|display_name|api_key|token|secret)/i;
const API_KEY_RE = /(sk-[A-Za-z0-9_-]{16,}|xox[baprs]-[A-Za-z0-9-]{16,}|gh[pousr]_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{20,})/;

function json(body, init = {}) {
  return new Response(JSON.stringify(body, null, 2), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": init.cacheControl || "no-store",
      ...(init.headers || {})
    }
  });
}

function error(status, code, message, extra = {}) {
  return json({ error_code: code, error_message: message, ...extra }, { status });
}

function validatePayloadValue(value, keyPath, errors) {
  if (Array.isArray(value)) {
    if (value.length > 32) errors.push(`${keyPath || "payload"} must not contain arrays longer than 32 items`);
    value.forEach((item, index) => validatePayloadValue(item, `${keyPath}[${index}]`, errors));
    return;
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value);
    if (entries.length > 16) errors.push(`${keyPath || "payload"} must not contain objects with more than 16 keys`);
    for (const [key, nested] of entries) {
      const nextPath = keyPath ? `${keyPath}.${key}` : key;
      if (FORBIDDEN_KEY_RE.test(key)) errors.push(`payload key is forbidden: ${nextPath}`);
      validatePayloadValue(nested, nextPath, errors);
    }
    return;
  }

  if (typeof value === "string") {
    if (value.length > 256) errors.push(`payload string is too long: ${keyPath}`);
    if (value.includes("/") || value.includes("\\") || /^https?:\/\//i.test(value)) {
      errors.push(`payload string must not contain paths or URLs: ${keyPath}`);
    }
    if (API_KEY_RE.test(value)) errors.push(`payload string looks like a secret: ${keyPath}`);
  }
}

export function validateTelemetryEvent(event) {
  const errors = [];
  if (event?.$schema !== TELEMETRY_SCHEMA_ID) errors.push("event must use the platform telemetry schema id");
  if (!UUID_RE.test(event?.event_id || "")) errors.push("event_id must be a UUID");
  if (!EVENT_NAME_RE.test(event?.event_name || "")) errors.push("event_name must be snake_case");
  if (!EVENTS.has(event?.event_name)) errors.push(`event_name is not registered: ${event?.event_name}`);
  if (!Number.isInteger(event?.event_version) || event.event_version < 1) errors.push("event_version must be a positive integer");
  if (!FLAGSHIPS.has(event?.app?.flagship)) errors.push("app.flagship must be a registered Open Studio flagship");
  if (!SEMVER_RE.test(event?.app?.version || "")) errors.push("app.version must be semver");
  if (!CHANNELS.has(event?.app?.channel)) errors.push("app.channel must be stable, beta, or nightly");
  if (!UUID_RE.test(event?.device?.install_id || "")) errors.push("device.install_id must be a UUID");
  if (!OSES.has(event?.device?.os)) errors.push("device.os must be darwin, windows, or linux");
  if (typeof event?.device?.os_version !== "string" || event.device.os_version.length < 1 || event.device.os_version.length > 32) {
    errors.push("device.os_version must be a short string");
  }
  if (!ARCHES.has(event?.device?.arch)) errors.push("device.arch must be x86_64 or aarch64");
  if (!UUID_RE.test(event?.session_id || "")) errors.push("session_id must be a UUID");
  if (Number.isNaN(Date.parse(event?.timestamp || ""))) errors.push("timestamp must be ISO 8601");
  if (!event?.payload || typeof event.payload !== "object" || Array.isArray(event.payload)) {
    errors.push("payload must be an object");
  } else {
    validatePayloadValue(event.payload, "", errors);
  }
  return errors;
}

async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function handleTelemetryRequest(request, env = {}) {
  const url = new URL(request.url);
  if (url.pathname === "/healthz") return json({ ok: true, service: "auraone-open-telemetry-receiver" });
  if (request.method !== "POST" || url.pathname !== "/v1/events") return error(404, "not_found", "not found");

  let body;
  try {
    body = await request.json();
  } catch {
    return error(400, "invalid_json", "request body must be JSON");
  }

  const events = Array.isArray(body?.events) ? body.events : Array.isArray(body) ? body : null;
  if (!events) return error(400, "invalid_request", "request body must be { events: [...] }");
  if (events.length < 1) return error(400, "empty_batch", "events batch must not be empty");
  if (events.length > 100) return error(413, "batch_too_large", "events batch must contain at most 100 events");

  const diagnostics = [];
  for (const [index, event] of events.entries()) {
    const errors = validateTelemetryEvent(event);
    if (errors.length > 0) diagnostics.push({ index, errors });
  }
  if (diagnostics.length > 0) {
    return error(422, "telemetry_validation_failed", "telemetry validation failed", { diagnostics });
  }

  const receivedAt = new Date().toISOString();
  const batchId = crypto.randomUUID();
  if (env.TELEMETRY_BUCKET) {
    const first = events[0];
    const installHash = await sha256Hex(String(first.device.install_id));
    const key = `${first.app.flagship}/${receivedAt.slice(0, 10)}/${batchId}.json`;
    await env.TELEMETRY_BUCKET.put(key, JSON.stringify({ batch_id: batchId, received_at: receivedAt, events }, null, 2), {
      httpMetadata: { contentType: "application/json; charset=utf-8" },
      customMetadata: {
        flagship: first.app.flagship,
        channel: first.app.channel,
        install_id_hash: installHash,
        event_count: String(events.length)
      }
    });
  }

  return json({ accepted: true, batch_id: batchId, received_at: receivedAt, event_count: events.length });
}

export default {
  fetch(request, env) {
    return handleTelemetryRequest(request, env);
  }
};
