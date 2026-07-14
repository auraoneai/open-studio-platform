import test from "node:test";
import assert from "node:assert/strict";
import { handleUpdateRequest, rolloutAllowsInstall } from "../src/index.mjs";

class MemoryR2 {
  constructor(objects = {}) {
    this.objects = objects;
  }

  async get(key) {
    if (!(key in this.objects)) return null;
    const value = this.objects[key];
    return {
      async text() {
        return typeof value === "string" ? value : JSON.stringify(value);
      },
      body: typeof value === "string" ? value : JSON.stringify(value),
      httpMetadata: { contentType: typeof value === "string" ? "text/plain" : "application/json" },
      httpEtag: `"${key}"`
    };
  }
}

test("serves a signed manifest from the canonical Tauri update route", async () => {
  const manifest = {
    schema_version: "1.0.0",
    flagship: "rubric-studio-open",
    channel: "stable",
    version: "0.1.1",
    pub_date: "2026-05-13T00:00:00.000Z",
    platforms: {},
    manifest_signature: "sig"
  };
  const response = await handleUpdateRequest(
    new Request("https://updates.auraone.ai/rubric-studio-open/darwin/universal/0.1.0?channel=stable&install_id=abc"),
    {
      UPDATE_BUCKET: new MemoryR2({
        "manifests/rubric-studio-open/stable/darwin-universal.json": manifest
      })
    }
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-auraone-manifest-signature"), "sig");
  assert.deepEqual(await response.json(), manifest);
});

test("serves the standard Tauri v2 latest-manifest fallback unchanged", async () => {
  const manifest = {
    version: "0.2.0",
    notes: "Proofline release",
    pub_date: "2026-07-12T00:00:00.000Z",
    platforms: {
      "linux-x86_64": {
        signature: "dGF1cmktc2lnbmF0dXJl",
        url: "https://github.com/auraoneai/agent-studio-open/releases/download/v0.2.0/Agent.Studio.Open.AppImage"
      }
    }
  };
  const response = await handleUpdateRequest(
    new Request("https://updates.auraone.ai/agent-studio-open/linux/x86_64/0.1.1?channel=stable"),
    {
      UPDATE_BUCKET: new MemoryR2({
        "manifests/agent-studio-open/stable/latest.json": manifest
      })
    }
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), manifest);
});

test("kill switch returns no update", async () => {
  const response = await handleUpdateRequest(
    new Request("https://updates.auraone.ai/rubric-studio-open/linux/x64/0.1.0"),
    {
      UPDATE_BUCKET: new MemoryR2({
        "kill-switches/rubric-studio-open/stable.json": {
          disabled: true,
          reason: "certificate rotation"
        }
      })
    }
  );
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.version, "0.1.0");
  assert.deepEqual(body.platforms, {});
});

test("rollout decision is deterministic", async () => {
  const input = { rollout: { enabled: true, percent: 25, salt: "s" }, installId: "install-a", channel: "stable" };
  assert.equal(await rolloutAllowsInstall(input), await rolloutAllowsInstall(input));
});

test("serves PRD channel metadata for stable, beta, and nightly fallbacks", async () => {
  const expectations = {
    stable: { cadence: "monthly", default: true, opt_in: false, build_trigger: "monthly_release" },
    beta: { cadence: "weekly", default: false, opt_in: true, build_trigger: "weekly_release" },
    nightly: { cadence: "every_green_main", default: false, opt_in: true, build_trigger: "green_main" }
  };

  for (const [channel, expected] of Object.entries(expectations)) {
    const response = await handleUpdateRequest(new Request(`https://updates.auraone.ai/rubric-studio-open/channels/${channel}.json`), {});
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.flagship, "rubric-studio-open");
    assert.equal(body.channel, channel);
    assert.match(body.update_url, new RegExp(`channel=${channel}$`));
    assert.equal(body.manifest_key, `manifests/rubric-studio-open/${channel}/latest.json`);
    assert.deepEqual(
      {
        cadence: body.cadence,
        default: body.default,
        opt_in: body.opt_in,
        build_trigger: body.build_trigger
      },
      expected
    );
  }
});

test("rejects unknown update channels", async () => {
  const response = await handleUpdateRequest(new Request("https://updates.auraone.ai/rubric-studio-open/channels/canary.json"), {});
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(body.error_code, "invalid_channel");
});

test("serves the release GPG public key from R2", async () => {
  const publicKey = "-----BEGIN PGP PUBLIC KEY BLOCK-----\nkey\n-----END PGP PUBLIC KEY BLOCK-----\n";
  const response = await handleUpdateRequest(new Request("https://updates.auraone.ai/keys/auraone-open.gpg"), {
    UPDATE_BUCKET: new MemoryR2({
      "keys/auraone-open.gpg": publicKey
    })
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "application/pgp-keys; charset=utf-8");
  assert.equal(await response.text(), publicKey);
});

test("serves release artifacts from R2", async () => {
  const response = await handleUpdateRequest(new Request("https://updates.auraone.ai/artifacts/rubric-studio-open/stable/0.1.0/app.tar.gz"), {
    UPDATE_BUCKET: new MemoryR2({
      "artifacts/rubric-studio-open/stable/0.1.0/app.tar.gz": "artifact-bytes"
    })
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "public, max-age=31536000, immutable");
  assert.equal(await response.text(), "artifact-bytes");
});
