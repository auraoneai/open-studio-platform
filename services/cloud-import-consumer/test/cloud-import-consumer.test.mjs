import test from "node:test";
import assert from "node:assert/strict";
import {
  handleQueueBatch,
  importPacketMessage,
  validateQueueMessage,
} from "../src/index.mjs";

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
      u16(nameBytes.length), u16(0), nameBytes, data,
    ]);
    localParts.push(local);
    centralParts.push(Buffer.concat([
      u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0), u32(crc), u32(data.length), u32(data.length),
      u16(nameBytes.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), nameBytes,
    ]));
    offset += local.length;
  }
  const central = Buffer.concat(centralParts);
  const eocd = Buffer.concat([
    u32(0x06054b50), u16(0), u16(0), u16(centralParts.length), u16(centralParts.length), u32(central.length), u32(offset), u16(0),
  ]);
  return Buffer.concat([...localParts, central, eocd]);
}

function manifest(overrides = {}) {
  return {
    manifest_version: "1.0.0",
    product: "rubric-studio-open",
    product_version: "0.1.0",
    platform_version: "0.1.0",
    created_at: "2026-05-20T00:00:00.000Z",
    project_id: "018f7ec2-67a7-7cc9-9d28-7ed3c5f8a114",
    creator: { display_name: "Cloud Import Test", email: "release@example.com" },
    intent: "handoff",
    redaction: {
      file_paths: true,
      hostnames: true,
      api_keys: true,
      user_pii_other_than_explicit_intake: true,
      custom_rules_applied: [],
    },
    consent: {
      user_acknowledged_preview: true,
      user_acknowledged_transport: true,
      timestamp: "2026-05-20T00:00:00.000Z",
    },
    payload_manifest: [{
      path: "payload/rubric.toml",
      role: "rubric_definition",
      sha256: "a".repeat(64),
      size_bytes: 6,
    }],
    provenance: {
      engine_libs: {},
      os: "darwin",
      os_version: "15.0",
      app_install_id_hash: "b".repeat(64),
    },
    transport: {
      destination: "https://intake.auraone.ai/v1/packets/",
      intended_at: "2026-05-20T00:00:00.000Z",
    },
    ...overrides,
  };
}

function queueMessage(overrides = {}) {
  return {
    packet_id: "550e8400-e29b-41d4-a716-446655440000",
    product: "rubric-studio-open",
    received_at: "2026-05-20T00:00:00.000Z",
    r2_key: "rubric-studio-open/2026-05-20/550e8400-e29b-41d4-a716-446655440000.auraonepkg",
    install_id_hash: "c".repeat(64),
    project_id: "018f7ec2-67a7-7cc9-9d28-7ed3c5f8a114",
    manifest_version: "1.0.0",
    product_version: "0.1.0",
    platform_version: "0.1.0",
    ...overrides,
  };
}

function envWithPacket(packetBytes, calls = {}) {
  return {
    AURAONE_CLOUD_IMPORT_API_URL: "https://api.auraone.ai/open-studio/imports",
    AURAONE_CLOUD_IMPORT_API_TOKEN: "test-token",
    INTAKE_BUCKET: {
      async get() {
        return {
          async arrayBuffer() {
            return packetBytes.buffer.slice(packetBytes.byteOffset, packetBytes.byteOffset + packetBytes.byteLength);
          },
        };
      },
    },
    CLOUD_IMPORT_AUDIT_BUCKET: {
      async put(key, value, options) {
        calls.audit = { key, value, options };
      },
    },
  };
}

test("validates queue message contract", () => {
  assert.equal(validateQueueMessage(queueMessage()).product, "rubric-studio-open");
  assert.throws(() => validateQueueMessage(queueMessage({ install_id_hash: "bad" })), /install_id_hash/);
});

test("imports packet through Cloud API and writes audit evidence", async () => {
  const packet = makeStoredZip({ "manifest.json": JSON.stringify(manifest()), "payload/rubric.toml": "hello\n" });
  const calls = {};
  const result = await importPacketMessage(queueMessage(), envWithPacket(new Uint8Array(packet), calls), {
    async fetcher(url, init) {
      calls.url = url;
      calls.request = JSON.parse(init.body);
      assert.equal(init.headers.authorization, "Bearer test-token");
      return new Response(JSON.stringify({
        import_status: "imported",
        cloud_url: "https://auraone.ai/cloud/projects/018f7ec2-67a7-7cc9-9d28-7ed3c5f8a114",
        audit_event_id: "audit-123",
      }), { status: 200 });
    },
  });

  assert.equal(result.import_status, "imported");
  assert.equal(result.audit_event_id, "audit-123");
  assert.equal(calls.url, "https://api.auraone.ai/open-studio/imports");
  assert.equal(calls.request.packet_id, queueMessage().packet_id);
  assert.equal(calls.request.manifest.product, "rubric-studio-open");
  assert.match(calls.audit.key, /^rubric-studio-open\/\d{4}-\d{2}-\d{2}\//);
  assert.equal(calls.audit.options.customMetadata.import_status, "imported");
});

test("retries failed queue messages", async () => {
  const packet = makeStoredZip({ "manifest.json": JSON.stringify(manifest({ product: "agent-studio-open" })), "payload/rubric.toml": "hello\n" });
  let retried = false;
  const batch = {
    messages: [{
      body: queueMessage(),
      retry() {
        retried = true;
      },
    }],
  };

  const result = await handleQueueBatch(batch, envWithPacket(new Uint8Array(packet)));

  assert.equal(result.processed, 1);
  assert.equal(result.results[0].ok, false);
  assert.equal(retried, true);
});
