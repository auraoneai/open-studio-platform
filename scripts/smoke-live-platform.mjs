#!/usr/bin/env node
import { createHash } from "node:crypto";
import dns from "node:dns";

const telemetryResolveIp = process.env.AURAONE_TELEMETRY_RESOLVE_IP;
if (telemetryResolveIp) {
  const family = telemetryResolveIp.includes(":") ? 6 : 4;
  const originalLookup = dns.lookup.bind(dns);
  dns.lookup = (hostname, options, callback) => {
    if (hostname === "o.auraone.ai") {
      if (typeof options === "function") {
        options(null, telemetryResolveIp, family);
      } else if (options?.all) {
        callback(null, [{ address: telemetryResolveIp, family }]);
      } else {
        callback(null, telemetryResolveIp, family);
      }
      return;
    }
    originalLookup(hostname, options, callback);
  };
}

const endpoints = {
  updateHealth: "https://updates.auraone.ai/healthz",
  updateFallbackHealth: "https://updates2.auraone.ai/healthz",
  updateChannel: "https://updates.auraone.ai/rubric-studio-open/channels/stable.json",
  updateManifest: "https://updates.auraone.ai/rubric-studio-open/darwin/aarch64/0.0.0?channel=stable",
  releaseKey: "https://updates.auraone.ai/keys/auraone-open.gpg",
  intakeHealth: "https://intake.auraone.ai/healthz",
  intakePackets: "https://intake.auraone.ai/v1/packets/",
  installScript: "https://install.auraone.ai/rubric-studio-open",
  installSignature: "https://install.auraone.ai/rubric-studio-open.asc",
  schemaFlatIntake: "https://schemas.auraone.ai/intake-packet.schema.json",
  schemaFlatTelemetry: "https://schemas.auraone.ai/telemetry.schema.json",
  schemaVersionedIntake: "https://schemas.auraone.ai/open-studio/intake-packet/v1.json",
  schemaVersionedTelemetry: "https://schemas.auraone.ai/open-studio/telemetry/v1.json",
  telemetryHealth: "https://o.auraone.ai/healthz",
  telemetryEvents: "https://o.auraone.ai/v1/events"
};

const failures = [];

async function check(name, fn) {
  try {
    const detail = await fn();
    console.log(`ok ${name}${detail ? ` - ${detail}` : ""}`);
  } catch (error) {
    failures.push(`${name}: ${error.message}`);
    console.error(`not ok ${name} - ${error.message}`);
  }
}

async function fetchOk(url, options = {}, expectedStatus = 200) {
  const response = await fetch(url, options);
  const text = await response.text();
  if (response.status !== expectedStatus) {
    throw new Error(`${url} returned ${response.status}: ${text.slice(0, 240)}`);
  }
  return { response, text };
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function u16(value) {
  const bytes = Buffer.alloc(2);
  bytes.writeUInt16LE(value);
  return bytes;
}

function u32(value) {
  const bytes = Buffer.alloc(4);
  bytes.writeUInt32LE(value);
  return bytes;
}

function makeStoredZip(files) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const nameBytes = Buffer.from(name);
    const data = Buffer.from(content);
    const crc = crc32(data);
    const local = Buffer.concat([
      u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc), u32(data.length), u32(data.length),
      u16(nameBytes.length), u16(0), nameBytes, data
    ]);
    localParts.push(local);
    centralParts.push(Buffer.concat([
      u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc), u32(data.length), u32(data.length),
      u16(nameBytes.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), nameBytes
    ]));
    offset += local.length;
  }
  const central = Buffer.concat(centralParts);
  const eocd = Buffer.concat([u32(0x06054b50), u16(0), u16(0), u16(centralParts.length), u16(centralParts.length), u32(central.length), u32(offset), u16(0)]);
  return Buffer.concat([...localParts, central, eocd]);
}

function sha256Hex(value) {
  return createHash("sha256").update(value).digest("hex");
}

function intakePacket() {
  const payload = "title = \"Launch smoke\"\n";
  const manifest = {
    manifest_version: "1.0.0",
    product: "rubric-studio-open",
    product_version: "0.1.0",
    platform_version: "0.3.0",
    created_at: new Date().toISOString(),
    project_id: "550e8400-e29b-41d4-a716-446655440010",
    creator: { display_name: "AuraOne Launch Smoke" },
    intent: "launch smoke test",
    redaction: {
      file_paths: true,
      hostnames: true,
      api_keys: true,
      user_pii_other_than_explicit_intake: true,
      custom_rules_applied: []
    },
    consent: {
      user_acknowledged_preview: true,
      user_acknowledged_transport: true,
      timestamp: new Date().toISOString()
    },
    payload_manifest: [{
      path: "payload/rubric.toml",
      role: "rubric_definition",
      sha256: sha256Hex(payload),
      size_bytes: Buffer.byteLength(payload)
    }],
    provenance: {
      engine_libs: {},
      os: "darwin",
      os_version: "15.0",
      app_install_id_hash: "c".repeat(64)
    },
    transport: {
      destination: endpoints.intakePackets,
      intended_at: new Date().toISOString()
    }
  };
  return makeStoredZip({
    "manifest.json": `${JSON.stringify(manifest, null, 2)}\n`,
    "payload/rubric.toml": payload
  });
}

function telemetryEvent() {
  return {
    $schema: "https://schemas.auraone.ai/open-studio/telemetry/v1.json",
    event_id: "550e8400-e29b-41d4-a716-446655440020",
    event_name: "app_launched",
    event_version: 1,
    app: { flagship: "rubric-studio-open", version: "0.1.0", channel: "stable" },
    device: {
      install_id: "550e8400-e29b-41d4-a716-446655440021",
      os: "darwin",
      os_version: "15.0",
      arch: "aarch64"
    },
    session_id: "550e8400-e29b-41d4-a716-446655440022",
    timestamp: new Date().toISOString(),
    payload: {}
  };
}

await check("updates health", async () => {
  await fetchOk(endpoints.updateHealth);
});
await check("updates2 health", async () => {
  await fetchOk(endpoints.updateFallbackHealth);
});
await check("update channel metadata", async () => {
  const { text } = await fetchOk(endpoints.updateChannel);
  const body = JSON.parse(text);
  if (body.channel !== "stable") throw new Error("stable channel metadata mismatch");
});
await check("update manifest route", async () => {
  const { text } = await fetchOk(endpoints.updateManifest);
  const body = JSON.parse(text);
  if (!body.manifest_signature) throw new Error("manifest_signature is missing");
});
await check("release GPG public key", async () => {
  const { text } = await fetchOk(endpoints.releaseKey);
  if (!text.includes("BEGIN PGP PUBLIC KEY BLOCK")) throw new Error("public key is not armored PGP");
});
await check("intake health", async () => {
  await fetchOk(endpoints.intakeHealth);
});
await check("intake packet upload", async () => {
  const form = new FormData();
  form.set("product", "rubric-studio-open");
  form.set("install_id_hash", "d".repeat(64));
  form.set("packet", new File([intakePacket()], "launch-smoke.auraonepkg", { type: "application/vnd.auraone.intake-packet+zip" }));
  const { text } = await fetchOk(endpoints.intakePackets, { method: "POST", body: form });
  const body = JSON.parse(text);
  if (!body.cloud_url || body.import_status !== "queued") throw new Error("intake response did not include queued cloud_url");
});
await check("install script", async () => {
  const { text } = await fetchOk(endpoints.installScript);
  if (!text.includes("Verified SHA256SUMS signature fingerprint")) throw new Error("install script is missing signature verification");
});
await check("install script signature", async () => {
  const { text } = await fetchOk(endpoints.installSignature);
  if (!text.includes("BEGIN PGP SIGNATURE")) throw new Error("install signature is not armored PGP");
});
await check("flat intake schema", async () => {
  await fetchOk(endpoints.schemaFlatIntake);
});
await check("flat telemetry schema", async () => {
  await fetchOk(endpoints.schemaFlatTelemetry);
});
await check("versioned intake schema", async () => {
  await fetchOk(endpoints.schemaVersionedIntake);
});
await check("versioned telemetry schema", async () => {
  await fetchOk(endpoints.schemaVersionedTelemetry);
});
await check("telemetry health", async () => {
  await fetchOk(endpoints.telemetryHealth);
});
await check("telemetry event upload", async () => {
  const { text } = await fetchOk(endpoints.telemetryEvents, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ events: [telemetryEvent()] })
  });
  const body = JSON.parse(text);
  if (!body.accepted || body.event_count !== 1) throw new Error("telemetry response did not accept one event");
});

if (failures.length > 0) {
  console.error(`\n${failures.length} live smoke check(s) failed:`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("\nLive Open Studio Platform smoke checks passed");
