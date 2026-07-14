#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { handleIntakeRequest } from "../services/intake-receiver/src/index.mjs";
import { handleQueueBatch } from "../services/cloud-import-consumer/src/index.mjs";
import {
  acceptedEvidencePaths,
  evidenceState,
  resolveEvidenceDir,
} from "./lib/evidence-files.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const platformRoot = path.resolve(scriptDir, "..");
const repoRoot = path.resolve(platformRoot, "../..");
const evidenceEnvName = "AURAONE_CLOUD_IMPORT_EVIDENCE_DIR";
const defaultEvidenceDir = path.join(repoRoot, "docs/evidence/product/open-studio-cloud-import");
const defaultEvidenceLabel = "docs/evidence/product/open-studio-cloud-import";
const queueName = "auraone-open-cloud-import";
const consumerWranglerPath = "opensource/open-studio-platform/services/cloud-import-consumer/wrangler.toml";
const consumerSourcePath = "opensource/open-studio-platform/services/cloud-import-consumer/src/index.mjs";

const requiredEvidence = [
  {
    key: "queue-consumer-deployment",
    name: "AuraOne Cloud queue consumer deployment",
    requiredFields: [
      "consumer service or worker name",
      "environment",
      "queue binding or subscription",
      "deployment timestamp",
      "owner",
    ],
  },
  {
    key: "consumer-smoke-import",
    name: "End-to-end Cloud import smoke",
    requiredFields: [
      "intake packet_id",
      "R2 key",
      "Cloud project URL",
      "import terminal state",
      "timestamp",
    ],
  },
  {
    key: "import-audit-log-linkage",
    name: "Cloud import audit log linkage",
    requiredFields: [
      "packet_id",
      "Cloud project id",
      "audit event id or log query",
      "operator/account used",
      "timestamp",
    ],
  },
];

function readText(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
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

function validManifest() {
  return {
    manifest_version: "1.0.0",
    product: "rubric-studio-open",
    product_version: "0.1.0",
    platform_version: "0.1.0",
    created_at: "2026-05-20T00:00:00.000Z",
    project_id: "018f7ec2-67a7-7cc9-9d28-7ed3c5f8a114",
    creator: { display_name: "Cloud Import Verifier", email: "release@example.com" },
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
  };
}

function validateConsumerMessage(message) {
  const errors = [];
  if (!/^[0-9a-f-]{36}$/i.test(message?.packet_id ?? "")) errors.push("packet_id must be UUID-like");
  if (!["rubric-studio-open", "robotics-studio-open", "agent-studio-open"].includes(message?.product)) {
    errors.push("product must be a known Open Studio flagship");
  }
  if (Number.isNaN(Date.parse(message?.received_at ?? ""))) errors.push("received_at must be parseable ISO time");
  if (!/^[-a-z0-9]+\/\d{4}-\d{2}-\d{2}\/[0-9a-f-]{36}\.auraonepkg$/i.test(message?.r2_key ?? "")) {
    errors.push("r2_key must include product/date/packet_id.auraonepkg");
  }
  if (!/^[a-f0-9]{64}$/i.test(message?.install_id_hash ?? "")) errors.push("install_id_hash must be SHA-256 hex");
  if (!/^[0-9a-f-]{36}$/i.test(message?.project_id ?? "")) errors.push("project_id must be UUID-like");
  for (const field of ["manifest_version", "product_version", "platform_version"]) {
    if (!/^\d+\.\d+\.\d+/.test(message?.[field] ?? "")) errors.push(`${field} must be semver-like`);
  }
  return errors;
}

async function runLocalProducerProbe() {
  const manifest = validManifest();
  const zip = makeStoredZip({
    "manifest.json": JSON.stringify(manifest),
    "payload/rubric.toml": "hello\n",
  });
  const form = new FormData();
  form.set("product", manifest.product);
  form.set("install_id_hash", "c".repeat(64));
  form.set("packet", new File([zip], "cloud-import-verifier.auraonepkg", { type: "application/zip" }));

  const queued = {};
  const stored = {};
  const response = await handleIntakeRequest(
    new Request("https://intake.auraone.ai/v1/packets/", { method: "POST", body: form }),
    {
      AURAONE_CLOUD_BASE_URL: "https://auraone.ai/cloud",
      INTAKE_BUCKET: {
        async put(key, value, options) {
          stored.key = key;
          stored.bytes = value.byteLength;
          stored.options = options;
        },
      },
      CLOUD_IMPORT_QUEUE: {
        async send(message) {
          queued.message = message;
        },
      },
    },
  );
  const body = await response.json();
  return {
    responseStatus: response.status,
    cloudUrlMatches: /^https:\/\/auraone\.ai\/cloud\/projects\/[0-9a-f-]{36}\?source=open$/i.test(body.cloud_url ?? ""),
    importStatus: body.import_status ?? null,
    bucketStored: Boolean(stored.key),
    bucketKey: stored.key ?? null,
    queued: Boolean(queued.message),
    queueMessage: queued.message ?? null,
    queueValidationErrors: validateConsumerMessage(queued.message ?? {}),
  };
}

async function runLocalConsumerProbe() {
  const manifest = validManifest();
  const packetId = "550e8400-e29b-41d4-a716-446655440000";
  const projectId = manifest.project_id;
  const zip = makeStoredZip({
    "manifest.json": JSON.stringify(manifest),
    "payload/rubric.toml": "hello\n",
  });
  const queueMessage = {
    packet_id: packetId,
    product: manifest.product,
    received_at: "2026-05-20T00:00:00.000Z",
    r2_key: `${manifest.product}/2026-05-20/${packetId}.auraonepkg`,
    install_id_hash: "c".repeat(64),
    project_id: projectId,
    manifest_version: manifest.manifest_version,
    product_version: manifest.product_version,
    platform_version: manifest.platform_version,
  };
  const calls = {};
  let acked = false;
  let retried = false;
  const batch = {
    messages: [{
      body: queueMessage,
      ack() {
        acked = true;
      },
      retry() {
        retried = true;
      },
    }],
  };
  const result = await handleQueueBatch(batch, {
    AURAONE_CLOUD_IMPORT_API_URL: "https://api.auraone.ai/open-studio/imports",
    AURAONE_CLOUD_IMPORT_API_TOKEN: "redacted-local-probe-token",
    INTAKE_BUCKET: {
      async get(key) {
        calls.r2Key = key;
        return {
          async arrayBuffer() {
            return zip.buffer.slice(zip.byteOffset, zip.byteOffset + zip.byteLength);
          },
        };
      },
    },
    CLOUD_IMPORT_AUDIT_BUCKET: {
      async put(key, value, options) {
        calls.audit = { key, value, options };
      },
    },
  }, {
    async fetcher(url, init) {
      calls.cloudApiUrl = url;
      calls.cloudApiPayload = JSON.parse(init.body);
      return new Response(JSON.stringify({
        import_status: "imported",
        cloud_url: `https://auraone.ai/cloud/projects/${projectId}`,
        audit_event_id: "audit-local-probe",
      }), { status: 200 });
    },
  });

  const first = result.results[0] ?? {};
  return {
    processed: result.processed,
    acked,
    retried,
    imported: first.ok === true,
    cloudApiCalled: calls.cloudApiUrl === "https://api.auraone.ai/open-studio/imports",
    r2KeyMatches: calls.r2Key === queueMessage.r2_key,
    auditWritten: Boolean(calls.audit?.key),
    auditMetadataMatches: calls.audit?.options?.customMetadata?.packet_id === packetId,
    payloadPacketMatches: calls.cloudApiPayload?.packet_id === packetId,
    payloadManifestMatches: calls.cloudApiPayload?.manifest?.project_id === projectId,
    error: first.error ?? null,
  };
}

const wrangler = readText("opensource/open-studio-platform/services/intake-receiver/wrangler.toml");
const consumerWranglerPresent = fs.existsSync(path.join(repoRoot, consumerWranglerPath));
const consumerSourcePresent = fs.existsSync(path.join(repoRoot, consumerSourcePath));
const consumerWrangler = consumerWranglerPresent ? readText(consumerWranglerPath) : "";
const docs = [
  "opensource/open-studio-platform/docs-template/docs/intake-packets.md",
  "opensource/open-studio-platform/docs-template/docs/concepts/intake-packets.md",
].map((relativePath) => ({
  path: relativePath,
  present: fs.existsSync(path.join(repoRoot, relativePath)),
}));
const { evidenceDir, source: evidenceDirSource } = resolveEvidenceDir({
  envName: evidenceEnvName,
  envValue: process.env[evidenceEnvName] ?? "",
  defaultDir: defaultEvidenceDir,
});

const localProducerProbe = await runLocalProducerProbe();
const localConsumerProbe = await runLocalConsumerProbe();
const evidence = requiredEvidence.map((item) => {
  const state = evidenceState(evidenceDir, item.key);
  return {
    ...item,
    externalEvidencePresent: state.accepted,
    evidenceFiles: state.files,
    acceptedEvidencePaths: acceptedEvidencePaths(defaultEvidenceLabel, item.key),
  };
});

const blockers = [];
if (!wrangler.includes(`queue = "${queueName}"`)) {
  blockers.push(`intake receiver wrangler.toml is not bound to ${queueName}`);
}
if (!consumerWranglerPresent) {
  blockers.push("Cloud import consumer wrangler.toml is missing");
}
if (!consumerSourcePresent) {
  blockers.push("Cloud import consumer source is missing");
}
if (!consumerWrangler.includes(`queue = "${queueName}"`)) {
  blockers.push(`Cloud import consumer is not subscribed to ${queueName}`);
}
if (!consumerWrangler.includes("binding = \"INTAKE_BUCKET\"")) {
  blockers.push("Cloud import consumer is not bound to the intake packet bucket");
}
if (!consumerWrangler.includes("binding = \"CLOUD_IMPORT_AUDIT_BUCKET\"")) {
  blockers.push("Cloud import consumer is not bound to the Cloud import audit bucket");
}
if (docs.some((doc) => !doc.present)) {
  blockers.push("Cloud import intake documentation is missing");
}
if (localProducerProbe.responseStatus !== 200) {
  blockers.push(`local intake producer probe returned HTTP ${localProducerProbe.responseStatus}`);
}
if (!localProducerProbe.bucketStored) blockers.push("local intake producer probe did not store the packet");
if (!localProducerProbe.queued) blockers.push("local intake producer probe did not enqueue a Cloud import message");
if (!localProducerProbe.cloudUrlMatches) blockers.push("local intake producer probe did not return the expected Cloud URL shape");
for (const error of localProducerProbe.queueValidationErrors) {
  blockers.push(`local queue message contract: ${error}`);
}
if (localConsumerProbe.processed !== 1) blockers.push("local Cloud import consumer probe did not process one message");
if (!localConsumerProbe.imported) blockers.push(`local Cloud import consumer probe did not import: ${localConsumerProbe.error ?? "unknown"}`);
if (!localConsumerProbe.acked) blockers.push("local Cloud import consumer probe did not acknowledge the message");
if (localConsumerProbe.retried) blockers.push("local Cloud import consumer probe retried the message");
if (!localConsumerProbe.cloudApiCalled) blockers.push("local Cloud import consumer probe did not call the Cloud import API");
if (!localConsumerProbe.r2KeyMatches) blockers.push("local Cloud import consumer probe did not read the queued R2 key");
if (!localConsumerProbe.auditWritten) blockers.push("local Cloud import consumer probe did not write audit evidence");
if (!localConsumerProbe.auditMetadataMatches) blockers.push("local Cloud import consumer audit metadata did not match the packet");
if (!localConsumerProbe.payloadPacketMatches || !localConsumerProbe.payloadManifestMatches) {
  blockers.push("local Cloud import consumer probe did not forward the packet/manifest contract");
}
for (const item of evidence) {
  if (item.evidenceFiles.length === 0) {
    blockers.push(`${item.key}: external Cloud consumer evidence is missing`);
  } else if (!item.externalEvidencePresent) {
    blockers.push(`${item.key}: external Cloud consumer evidence is present but not acceptable`);
  }
}

console.log(JSON.stringify({
  ok: true,
  readyForCloudImportConsumerClosure: blockers.length === 0,
  checkedAt: new Date().toISOString(),
  safetyRule:
    "This verifier runs a local intake producer probe and validates local evidence files only; it does not deploy Cloud workers, consume queues, mutate projects, or print secrets.",
  queueName,
  intakeReceiver: {
    wranglerPath: "opensource/open-studio-platform/services/intake-receiver/wrangler.toml",
    producerBindingPresent: wrangler.includes("binding = \"CLOUD_IMPORT_QUEUE\""),
    queueNamePresent: wrangler.includes(`queue = "${queueName}"`),
  },
  cloudImportConsumer: {
    wranglerPath: consumerWranglerPath,
    sourcePath: consumerSourcePath,
    present: consumerWranglerPresent && consumerSourcePresent,
    subscribedToQueue: consumerWrangler.includes(`queue = "${queueName}"`),
    intakeBucketBindingPresent: consumerWrangler.includes("binding = \"INTAKE_BUCKET\""),
    auditBucketBindingPresent: consumerWrangler.includes("binding = \"CLOUD_IMPORT_AUDIT_BUCKET\""),
  },
  documentation: docs,
  localProducerProbe,
  localConsumerProbe,
  evidenceDirectory: {
    envName: evidenceEnvName,
    configured: Boolean(evidenceDir),
    source: evidenceDirSource,
    valuePrinted: false,
    acceptedLayout: `${defaultEvidenceLabel}/<evidence-key>.<md|json|txt|png|pdf>`,
  },
  evidence,
  blockers,
}, null, 2));
