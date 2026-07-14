const ALLOWED_PRODUCTS = new Set(["rubric-studio-open", "robotics-studio-open", "agent-studio-open"]);
const ALLOWED_ROLES = new Set([
  "rubric_definition",
  "rubric_criterion",
  "rubric_sample",
  "rubric_calibration_set",
  "rubric_judge_card",
  "rubric_eval_run_manifest",
  "robotics_episode_reference",
  "robotics_failure_cluster",
  "robotics_intervention_note",
  "robotics_embodiment_card",
  "robotics_sensor_qa_report",
  "agent_mcp_server_metadata",
  "agent_trace_card",
  "agent_regression_test_suite",
  "agent_otel_spans"
]);

const API_KEY_PATTERN = /(sk-[A-Za-z0-9]{20,}|AIza[0-9A-Za-z_-]{20,}|AKIA[0-9A-Z]{16}|xox[baprs]-[0-9A-Za-z-]{20,})/;
const SUPPORTED_MANIFEST_MAJOR = 1;

function json(body, init = {}) {
  return new Response(JSON.stringify(body, null, 2), {
    ...init,
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...(init.headers || {})
    }
  });
}

function error(status, code, message, extra = {}) {
  return json({ error_code: code, error_message: message, ...extra }, { status });
}

function readUInt16LE(view, offset) {
  return view.getUint16(offset, true);
}

function readUInt32LE(view, offset) {
  return view.getUint32(offset, true);
}

export function parseZipCentralDirectory(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let offset = bytes.byteLength - 22; offset >= Math.max(0, bytes.byteLength - 65557); offset -= 1) {
    if (readUInt32LE(view, offset) === 0x06054b50) {
      eocd = offset;
      break;
    }
  }
  if (eocd < 0) throw new Error("zip_end_of_central_directory_not_found");
  const entryCount = readUInt16LE(view, eocd + 10);
  const centralOffset = readUInt32LE(view, eocd + 16);
  const entries = new Map();
  let offset = centralOffset;
  const decoder = new TextDecoder();

  for (let i = 0; i < entryCount; i += 1) {
    if (readUInt32LE(view, offset) !== 0x02014b50) throw new Error("invalid_zip_central_directory");
    const compression = readUInt16LE(view, offset + 10);
    const compressedSize = readUInt32LE(view, offset + 20);
    const uncompressedSize = readUInt32LE(view, offset + 24);
    const nameLength = readUInt16LE(view, offset + 28);
    const extraLength = readUInt16LE(view, offset + 30);
    const commentLength = readUInt16LE(view, offset + 32);
    const localOffset = readUInt32LE(view, offset + 42);
    const name = decoder.decode(bytes.slice(offset + 46, offset + 46 + nameLength));
    entries.set(name, { name, compression, compressedSize, uncompressedSize, localOffset });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

async function inflateRaw(data) {
  if (typeof DecompressionStream !== "undefined") {
    const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }
  const zlib = await import("node:zlib");
  return zlib.inflateRawSync(data);
}

export async function readZipEntry(bytes, entry) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (readUInt32LE(view, entry.localOffset) !== 0x04034b50) throw new Error("invalid_zip_local_header");
  const nameLength = readUInt16LE(view, entry.localOffset + 26);
  const extraLength = readUInt16LE(view, entry.localOffset + 28);
  const dataOffset = entry.localOffset + 30 + nameLength + extraLength;
  const compressed = bytes.slice(dataOffset, dataOffset + entry.compressedSize);
  if (entry.compression === 0) return compressed;
  if (entry.compression === 8) return inflateRaw(compressed);
  throw new Error(`unsupported_zip_compression_${entry.compression}`);
}

export function validateManifest(manifest) {
  const errors = [];
  if (manifest?.manifest_version !== "1.0.0") errors.push("manifest_version must be 1.0.0");
  if (!ALLOWED_PRODUCTS.has(manifest?.product)) errors.push("product must be a known Open Studio flagship");
  if (!/^\d+\.\d+\.\d+/.test(manifest?.product_version || "")) errors.push("product_version must be semver-like");
  if (!/^\d+\.\d+\.\d+/.test(manifest?.platform_version || "")) errors.push("platform_version must be semver-like");
  if (!manifest?.project_id) errors.push("project_id is required");
  if (!manifest?.consent?.user_acknowledged_preview) errors.push("preview consent is required");
  if (!manifest?.consent?.user_acknowledged_transport) errors.push("transport consent is required");
  if (!manifest?.redaction?.file_paths || !manifest?.redaction?.hostnames || !manifest?.redaction?.api_keys) {
    errors.push("redaction.file_paths, redaction.hostnames, and redaction.api_keys must all be true");
  }
  if (!Array.isArray(manifest?.payload_manifest) || manifest.payload_manifest.length === 0) {
    errors.push("payload_manifest must contain at least one payload entry");
  } else {
    for (const [index, entry] of manifest.payload_manifest.entries()) {
      if (!entry.path?.startsWith("payload/")) errors.push(`payload_manifest[${index}].path must start with payload/`);
      if (!ALLOWED_ROLES.has(entry.role)) errors.push(`payload_manifest[${index}].role is not registered`);
      if (!/^[a-f0-9]{64}$/i.test(entry.sha256 || "")) errors.push(`payload_manifest[${index}].sha256 must be hex SHA-256`);
      if (!Number.isSafeInteger(entry.size_bytes) || entry.size_bytes < 0) errors.push(`payload_manifest[${index}].size_bytes must be non-negative integer`);
    }
  }

  const serialized = JSON.stringify(manifest);
  if (API_KEY_PATTERN.test(serialized)) errors.push("manifest appears to contain an API key");
  if (/\/Users\/|C:\\Users\\|\/home\//.test(serialized)) errors.push("manifest appears to contain local file paths");
  return errors;
}

function manifestMajor(manifestVersion) {
  const [major] = String(manifestVersion || "").split(".");
  return Number.parseInt(major, 10);
}

export function isFutureManifestVersion(manifestVersion) {
  const major = manifestMajor(manifestVersion);
  return Number.isSafeInteger(major) && major > SUPPORTED_MANIFEST_MAJOR;
}

async function packetFromRequest(request) {
  const form = await request.formData();
  const packet = form.get("packet");
  const product = form.get("product");
  const installIdHash = form.get("install_id_hash");
  if (!(packet instanceof File)) throw new Error("packet multipart field is required");
  if (!ALLOWED_PRODUCTS.has(product)) throw new Error("product multipart field is invalid");
  if (!/^[a-f0-9]{64}$/i.test(String(installIdHash || ""))) throw new Error("install_id_hash must be SHA-256 hex");
  return { packet, product, installIdHash: String(installIdHash) };
}

export async function handleIntakeRequest(request, env) {
  const url = new URL(request.url);
  if (url.pathname === "/healthz") return json({ ok: true, service: "auraone-open-intake-receiver" });
  if (request.method !== "POST" || url.pathname !== "/v1/packets/") return error(404, "not_found", "not found");

  let packet;
  let product;
  let installIdHash;
  try {
    ({ packet, product, installIdHash } = await packetFromRequest(request));
  } catch (err) {
    return error(400, "invalid_request", err.message);
  }

  const maxBytes = Number(env.INTAKE_MAX_BYTES || 104857600);
  if (packet.size > maxBytes) return error(413, "packet_too_large", "packet exceeds configured size limit");

  let bytes;
  let manifest;
  try {
    bytes = new Uint8Array(await packet.arrayBuffer());
    const entries = parseZipCentralDirectory(bytes);
    const manifestEntry = entries.get("manifest.json");
    if (!manifestEntry) return error(422, "manifest_missing", "manifest.json is required");
    const manifestBytes = await readZipEntry(bytes, manifestEntry);
    manifest = JSON.parse(new TextDecoder().decode(manifestBytes));
  } catch (err) {
    return error(422, "invalid_packet", err.message);
  }

  if (manifest.product !== product) {
    return error(422, "product_mismatch", "multipart product must match manifest product");
  }
  if (isFutureManifestVersion(manifest.manifest_version)) {
    return error(409, "version_mismatch", "Cloud needs an upgrade", {
      supported_manifest_major: SUPPORTED_MANIFEST_MAJOR,
      manifest_version: manifest.manifest_version,
      docs_url: "https://auraone.ai/open/docs/intake-packets#version-mismatch"
    });
  }
  const validationErrors = validateManifest(manifest);
  if (validationErrors.length > 0) {
    return error(422, "manifest_validation_failed", "manifest validation failed", { diagnostics: validationErrors });
  }

  const packetId = crypto.randomUUID();
  const receivedAt = new Date().toISOString();
  const key = `${product}/${receivedAt.slice(0, 10)}/${packetId}.auraonepkg`;

  if (env.INTAKE_BUCKET) {
    await env.INTAKE_BUCKET.put(key, bytes, {
      httpMetadata: { contentType: "application/vnd.auraone.intake-packet+zip" },
      customMetadata: {
        product,
        packet_id: packetId,
        install_id_hash: installIdHash,
        project_id: manifest.project_id
      }
    });
  }

  if (env.CLOUD_IMPORT_QUEUE) {
    await env.CLOUD_IMPORT_QUEUE.send({
      packet_id: packetId,
      product,
      received_at: receivedAt,
      r2_key: key,
      install_id_hash: installIdHash,
      project_id: manifest.project_id,
      manifest_version: manifest.manifest_version,
      product_version: manifest.product_version,
      platform_version: manifest.platform_version
    });
  }

  return json({
    packet_id: packetId,
    received_at: receivedAt,
    cloud_url: `${env.AURAONE_CLOUD_BASE_URL || "https://auraone.ai/cloud"}/projects/${packetId}?source=open`,
    import_status: "queued",
    next_step: "Open this URL to sign in and complete your hand-off."
  });
}

export default {
  fetch(request, env) {
    return handleIntakeRequest(request, env);
  }
};
