const FLAGSHIPS = new Set(["rubric-studio-open", "robotics-studio-open", "agent-studio-open"]);
const CHANNELS = new Set(["stable", "beta", "nightly"]);
const CHANNEL_METADATA = {
  stable: {
    cadence: "monthly",
    default: true,
    opt_in: false,
    build_trigger: "monthly_release"
  },
  beta: {
    cadence: "weekly",
    default: false,
    opt_in: true,
    build_trigger: "weekly_release"
  },
  nightly: {
    cadence: "every_green_main",
    default: false,
    opt_in: true,
    build_trigger: "green_main"
  }
};

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

function notFound(message = "not_found") {
  return json({ error_code: "not_found", error_message: message }, { status: 404 });
}

export async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function rolloutAllowsInstall({ rollout, installId, channel }) {
  if (!rollout || rollout.enabled === false) return true;
  if (rollout.channel && rollout.channel !== channel) return true;
  const percent = Number(rollout.percent ?? 100);
  if (percent >= 100) return true;
  if (percent <= 0) return false;
  const hash = await sha256Hex(`${rollout.salt || "auraone-open"}:${installId || "anonymous"}`);
  const bucket = Number.parseInt(hash.slice(0, 8), 16) % 100;
  return bucket < percent;
}

async function readR2Json(bucket, key) {
  const object = await bucket.get(key);
  if (!object) return null;
  const text = await object.text();
  const parsed = JSON.parse(text);
  return { parsed, object };
}

async function readR2Text(bucket, key) {
  const object = await bucket.get(key);
  if (!object) return null;
  const text = await object.text();
  return { text, object };
}

async function readR2Object(bucket, key) {
  const object = await bucket.get(key);
  if (!object) return null;
  return object;
}

async function getJsonObject(env, keys, fallback) {
  if (!env.UPDATE_BUCKET) return fallback ?? null;
  for (const key of keys) {
    const object = await readR2Json(env.UPDATE_BUCKET, key);
    if (object) return object;
  }
  return fallback ?? null;
}

function validateCommon(flagship, channel) {
  if (!FLAGSHIPS.has(flagship)) return `unknown flagship: ${flagship}`;
  if (!CHANNELS.has(channel)) return `unknown channel: ${channel}`;
  return null;
}

export async function handleUpdateRequest(request, env) {
  const url = new URL(request.url);
  const parts = url.pathname.split("/").filter(Boolean);

  if (url.pathname === "/healthz") {
    return json({ ok: true, service: "auraone-open-update-server" });
  }

  if (parts.length === 2 && parts[0] === "keys") {
    if (!/^[A-Za-z0-9._-]+\.gpg$/.test(parts[1])) {
      return json({ error_code: "invalid_key", error_message: "invalid key name" }, { status: 400 });
    }
    if (!env.UPDATE_BUCKET) return notFound("release key bucket is not configured");
    const keyObject = await readR2Text(env.UPDATE_BUCKET, `keys/${parts[1]}`);
    if (!keyObject) return notFound("release key not found");
    return new Response(keyObject.text, {
      headers: {
        "content-type": "application/pgp-keys; charset=utf-8",
        "cache-control": "public, max-age=3600"
      }
    });
  }

  if (parts.length >= 2 && parts[0] === "artifacts") {
    if (!env.UPDATE_BUCKET) return notFound("artifact bucket is not configured");
    const objectKey = parts.join("/");
    const artifact = await readR2Object(env.UPDATE_BUCKET, objectKey);
    if (!artifact) return notFound("artifact not found");
    return new Response(artifact.body, {
      headers: {
        "content-type": artifact.httpMetadata?.contentType || "application/octet-stream",
        "cache-control": "public, max-age=31536000, immutable",
        "etag": artifact.httpEtag || artifact.etag || ""
      }
    });
  }

  const [flagship] = parts;
  const channel = url.searchParams.get("channel") || "stable";
  if (!flagship) return notFound("missing flagship");
  const validationError = validateCommon(flagship, channel);
  if (validationError) return json({ error_code: "invalid_request", error_message: validationError }, { status: 400 });

  if (parts.length === 3 && parts[1] === "channels" && parts[2].endsWith(".json")) {
    const requestedChannel = parts[2].replace(/\.json$/, "");
    if (!CHANNELS.has(requestedChannel)) {
      return json({ error_code: "invalid_channel", error_message: `unknown channel: ${requestedChannel}` }, { status: 400 });
    }
    const key = `channels/${flagship}/${requestedChannel}.json`;
    const channelObject = await getJsonObject(env, [key], {
      parsed: {
        flagship,
        channel: requestedChannel,
        ...CHANNEL_METADATA[requestedChannel],
        update_url: `https://updates.auraone.ai/${flagship}/{{target}}/{{arch}}/{{current_version}}?channel=${requestedChannel}`,
        secondary_url: `https://github.com/auraoneai/${flagship}/releases/latest`,
        manifest_key: `manifests/${flagship}/${requestedChannel}/latest.json`
      },
      object: null
    });
    return json(channelObject.parsed, {
      cacheControl: "public, max-age=300",
      headers: channelObject.object?.httpMetadata?.contentType ? {} : {}
    });
  }

  if (parts.length === 2 && parts[1] === "rollout.json") {
    const rollout = await getJsonObject(env, [`rollouts/${flagship}/${channel}.json`, `rollouts/${flagship}/stable.json`], {
      parsed: { flagship, channel, enabled: true, percent: 100, salt: "auraone-open" },
      object: null
    });
    return json(rollout.parsed, { cacheControl: "public, max-age=60" });
  }

  if (parts.length === 2 && parts[1] === "kill-switch.json") {
    const killSwitch = await getJsonObject(env, [`kill-switches/${flagship}/${channel}.json`], {
      parsed: { flagship, channel, disabled: false, reason: null },
      object: null
    });
    return json(killSwitch.parsed, { cacheControl: "public, max-age=60" });
  }

  if (parts.length === 4) {
    const [, target, arch, currentVersion] = parts;
    const installId = url.searchParams.get("install_id") || request.headers.get("x-auraone-install-id") || "";
    const killSwitch = await getJsonObject(env, [`kill-switches/${flagship}/${channel}.json`], {
      parsed: { disabled: false },
      object: null
    });
    if (killSwitch.parsed.disabled) {
      return json({
        version: currentVersion,
        notes: killSwitch.parsed.reason || "Updates are temporarily disabled.",
        pub_date: new Date(0).toISOString(),
        platforms: {}
      });
    }

    const rollout = await getJsonObject(env, [`rollouts/${flagship}/${channel}.json`, `rollouts/${flagship}/stable.json`], {
      parsed: { enabled: true, percent: 100 },
      object: null
    });
    const allowed = await rolloutAllowsInstall({ rollout: rollout.parsed, installId, channel });
    if (!allowed) {
      return json({
        version: currentVersion,
        notes: "No update is available for this rollout cohort.",
        pub_date: new Date(0).toISOString(),
        platforms: {}
      }, { cacheControl: "private, max-age=60" });
    }

    const keys = [
      `manifests/${flagship}/${channel}/${target}-${arch}.json`,
      `manifests/${flagship}/${channel}/latest.json`
    ];
    const manifest = await getJsonObject(env, keys, null);
    if (!manifest) return notFound("manifest not found");
    return json(manifest.parsed, {
      cacheControl: "public, max-age=120",
      headers: manifest.parsed.manifest_signature
        ? { "x-auraone-manifest-signature": manifest.parsed.manifest_signature }
        : {}
    });
  }

  return notFound();
}

export default {
  fetch(request, env) {
    return handleUpdateRequest(request, env);
  }
};
