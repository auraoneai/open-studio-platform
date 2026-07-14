import test from "node:test";
import assert from "node:assert/strict";
import { handleIntakeRequest, validateManifest, parseZipCentralDirectory, readZipEntry } from "../src/index.mjs";

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

function validManifest() {
  return {
    manifest_version: "1.0.0",
    product: "rubric-studio-open",
    product_version: "0.1.0",
    platform_version: "0.1.0",
    created_at: "2026-05-13T00:00:00.000Z",
    project_id: "018f7ec2-67a7-7cc9-9d28-7ed3c5f8a114",
    creator: { display_name: "User", email: "user@example.com" },
    intent: "handoff",
    redaction: { file_paths: true, hostnames: true, api_keys: true, user_pii_other_than_explicit_intake: true, custom_rules_applied: [] },
    consent: { user_acknowledged_preview: true, user_acknowledged_transport: true, timestamp: "2026-05-13T00:00:00.000Z" },
    payload_manifest: [{ path: "payload/rubric.toml", role: "rubric_definition", sha256: "a".repeat(64), size_bytes: 6 }],
    provenance: { engine_libs: {}, os: "darwin", os_version: "15.0", app_install_id_hash: "b".repeat(64) },
    transport: { destination: "https://intake.auraone.ai/v1/packets/", intended_at: "2026-05-13T00:00:00.000Z" }
  };
}

test("parses manifest.json from a stored auraonepkg zip", async () => {
  const zip = makeStoredZip({ "manifest.json": JSON.stringify(validManifest()), "payload/rubric.toml": "hello\n" });
  const entries = parseZipCentralDirectory(new Uint8Array(zip));
  const manifestBytes = await readZipEntry(new Uint8Array(zip), entries.get("manifest.json"));
  const manifest = JSON.parse(new TextDecoder().decode(manifestBytes));
  assert.equal(manifest.product, "rubric-studio-open");
});

test("validates required manifest privacy contracts", () => {
  const manifest = validManifest();
  manifest.redaction.api_keys = false;
  assert.match(validateManifest(manifest).join("\n"), /redaction/);
});

test("accepts a valid packet and returns a cloud_url", async () => {
  const zip = makeStoredZip({ "manifest.json": JSON.stringify(validManifest()), "payload/rubric.toml": "hello\n" });
  const form = new FormData();
  form.set("product", "rubric-studio-open");
  form.set("install_id_hash", "c".repeat(64));
  form.set("packet", new File([zip], "test.auraonepkg", { type: "application/zip" }));
  const stored = {};
  const queued = {};
  const response = await handleIntakeRequest(new Request("https://intake.auraone.ai/v1/packets/", { method: "POST", body: form }), {
    INTAKE_BUCKET: {
      async put(key, value, options) {
        stored.key = key;
        stored.value = value;
        stored.options = options;
      }
    },
    CLOUD_IMPORT_QUEUE: {
      async send(message) {
        queued.message = message;
      }
    }
  });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.match(body.cloud_url, /^https:\/\/auraone\.ai\/cloud\/projects\//);
  assert.match(body.next_step, /sign in/i);
  assert.match(stored.key, /^rubric-studio-open\//);
  assert.equal(queued.message.packet_id, body.packet_id);
  assert.equal(queued.message.r2_key, stored.key);
  assert.equal(queued.message.product, "rubric-studio-open");
  assert.equal(queued.message.project_id, validManifest().project_id);
});

test("rejects oversized packets with 413", async () => {
  const form = new FormData();
  form.set("product", "rubric-studio-open");
  form.set("install_id_hash", "c".repeat(64));
  form.set("packet", new File(["too large"], "test.auraonepkg", { type: "application/zip" }));

  const response = await handleIntakeRequest(new Request("https://intake.auraone.ai/v1/packets/", { method: "POST", body: form }), {
    INTAKE_MAX_BYTES: "4"
  });
  const body = await response.json();

  assert.equal(response.status, 413);
  assert.equal(body.error_code, "packet_too_large");
});

test("returns 422 diagnostics for manifest validation failures", async () => {
  const manifest = validManifest();
  manifest.consent.user_acknowledged_preview = false;
  const zip = makeStoredZip({ "manifest.json": JSON.stringify(manifest), "payload/rubric.toml": "hello\n" });
  const form = new FormData();
  form.set("product", "rubric-studio-open");
  form.set("install_id_hash", "c".repeat(64));
  form.set("packet", new File([zip], "test.auraonepkg", { type: "application/zip" }));

  const response = await handleIntakeRequest(new Request("https://intake.auraone.ai/v1/packets/", { method: "POST", body: form }), {});
  const body = await response.json();

  assert.equal(response.status, 422);
  assert.equal(body.error_code, "manifest_validation_failed");
  assert.ok(body.diagnostics.some((diagnostic) => diagnostic.includes("preview consent")));
});

test("returns 409 when manifest is newer than Cloud supports", async () => {
  const manifest = validManifest();
  manifest.manifest_version = "2.0.0";
  const zip = makeStoredZip({ "manifest.json": JSON.stringify(manifest), "payload/rubric.toml": "hello\n" });
  const form = new FormData();
  form.set("product", "rubric-studio-open");
  form.set("install_id_hash", "c".repeat(64));
  form.set("packet", new File([zip], "test.auraonepkg", { type: "application/zip" }));

  const response = await handleIntakeRequest(new Request("https://intake.auraone.ai/v1/packets/", { method: "POST", body: form }), {});
  const body = await response.json();

  assert.equal(response.status, 409);
  assert.equal(body.error_code, "version_mismatch");
  assert.equal(body.error_message, "Cloud needs an upgrade");
  assert.equal(body.supported_manifest_major, 1);
});
