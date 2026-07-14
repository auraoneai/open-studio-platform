import {
  parseZipCentralDirectory,
  readZipEntry,
  validateManifest,
} from "../../intake-receiver/src/index.mjs";

const ALLOWED_PRODUCTS = new Set([
  "rubric-studio-open",
  "robotics-studio-open",
  "agent-studio-open",
]);

function isoNow() {
  return new Date().toISOString();
}

function assertUuidLike(value, field) {
  if (!/^[0-9a-f-]{36}$/i.test(String(value || ""))) {
    throw new Error(`${field} must be UUID-like`);
  }
}

function assertSemverLike(value, field) {
  if (!/^\d+\.\d+\.\d+/.test(String(value || ""))) {
    throw new Error(`${field} must be semver-like`);
  }
}

export function validateQueueMessage(message) {
  assertUuidLike(message?.packet_id, "packet_id");
  if (!ALLOWED_PRODUCTS.has(message?.product)) {
    throw new Error("product must be a known Open Studio flagship");
  }
  if (Number.isNaN(Date.parse(message?.received_at || ""))) {
    throw new Error("received_at must be a parseable ISO timestamp");
  }
  if (!/^[-a-z0-9]+\/\d{4}-\d{2}-\d{2}\/[0-9a-f-]{36}\.auraonepkg$/i.test(message?.r2_key || "")) {
    throw new Error("r2_key must include product/date/packet_id.auraonepkg");
  }
  if (!/^[a-f0-9]{64}$/i.test(message?.install_id_hash || "")) {
    throw new Error("install_id_hash must be SHA-256 hex");
  }
  assertUuidLike(message?.project_id, "project_id");
  assertSemverLike(message?.manifest_version, "manifest_version");
  assertSemverLike(message?.product_version, "product_version");
  assertSemverLike(message?.platform_version, "platform_version");
  return message;
}

async function packetManifestFromBytes(bytes) {
  const entries = parseZipCentralDirectory(bytes);
  const manifestEntry = entries.get("manifest.json");
  if (!manifestEntry) throw new Error("manifest.json is required");
  const manifestBytes = await readZipEntry(bytes, manifestEntry);
  const manifest = JSON.parse(new TextDecoder().decode(manifestBytes));
  const validationErrors = validateManifest(manifest);
  if (validationErrors.length > 0) {
    throw new Error(`manifest_validation_failed: ${validationErrors.join("; ")}`);
  }
  return manifest;
}

async function readPacketBytes(env, r2Key) {
  if (!env.INTAKE_BUCKET) {
    throw new Error("INTAKE_BUCKET binding is required");
  }
  const object = await env.INTAKE_BUCKET.get(r2Key);
  if (!object) {
    throw new Error(`intake packet is missing from R2: ${r2Key}`);
  }
  return new Uint8Array(await object.arrayBuffer());
}

async function writeAudit(env, audit) {
  if (!env.CLOUD_IMPORT_AUDIT_BUCKET) return;
  const date = audit.timestamp.slice(0, 10);
  const key = `${audit.product}/${date}/${audit.packet_id}.json`;
  await env.CLOUD_IMPORT_AUDIT_BUCKET.put(key, JSON.stringify(audit, null, 2), {
    httpMetadata: { contentType: "application/json; charset=utf-8" },
    customMetadata: {
      product: audit.product,
      packet_id: audit.packet_id,
      project_id: audit.project_id,
      import_status: audit.import_status,
    },
  });
}

async function postCloudImport(env, payload, fetcher = fetch) {
  const endpoint = env.AURAONE_CLOUD_IMPORT_API_URL;
  if (!endpoint) {
    throw new Error("AURAONE_CLOUD_IMPORT_API_URL is required");
  }
  const headers = { "content-type": "application/json" };
  if (env.AURAONE_CLOUD_IMPORT_API_TOKEN) {
    headers.authorization = `Bearer ${env.AURAONE_CLOUD_IMPORT_API_TOKEN}`;
  }
  const response = await fetcher(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : {};
  if (!response.ok) {
    throw new Error(`Cloud import API returned HTTP ${response.status}: ${body.error_message || text}`);
  }
  return body;
}

export async function importPacketMessage(message, env, options = {}) {
  const queueMessage = validateQueueMessage(message);
  const packetBytes = await readPacketBytes(env, queueMessage.r2_key);
  const manifest = await packetManifestFromBytes(packetBytes);

  if (manifest.product !== queueMessage.product) {
    throw new Error("queue product does not match manifest product");
  }
  if (manifest.project_id !== queueMessage.project_id) {
    throw new Error("queue project_id does not match manifest project_id");
  }

  const payload = {
    packet_id: queueMessage.packet_id,
    product: queueMessage.product,
    r2_key: queueMessage.r2_key,
    received_at: queueMessage.received_at,
    install_id_hash: queueMessage.install_id_hash,
    project_id: queueMessage.project_id,
    manifest,
  };

  const imported = await postCloudImport(env, payload, options.fetcher);
  const timestamp = isoNow();
  const importStatus = imported.import_status || imported.status || "imported";
  const cloudUrl =
    imported.cloud_url ||
    `${env.AURAONE_CLOUD_BASE_URL || "https://auraone.ai/cloud"}/projects/${queueMessage.project_id}?source=open`;

  const audit = {
    timestamp,
    packet_id: queueMessage.packet_id,
    product: queueMessage.product,
    r2_key: queueMessage.r2_key,
    project_id: queueMessage.project_id,
    cloud_url: cloudUrl,
    import_status: importStatus,
    audit_event_id: imported.audit_event_id || null,
  };
  await writeAudit(env, audit);

  return {
    packet_id: queueMessage.packet_id,
    project_id: queueMessage.project_id,
    cloud_url: cloudUrl,
    import_status: importStatus,
    audit_event_id: audit.audit_event_id,
  };
}

export async function handleQueueBatch(batch, env, options = {}) {
  const results = [];
  for (const message of batch.messages || []) {
    try {
      const body = message.body || message;
      const result = await importPacketMessage(body, env, options);
      message.ack?.();
      results.push({ packet_id: body.packet_id, ok: true, result });
    } catch (error) {
      message.retry?.();
      results.push({ packet_id: message.body?.packet_id || null, ok: false, error: error.message });
      if (!message.retry) throw error;
    }
  }
  return { processed: results.length, results };
}

export default {
  async queue(batch, env) {
    await handleQueueBatch(batch, env);
  },
};
