import test from "node:test";
import assert from "node:assert/strict";
import { handleInstallRequest, renderShellInstallScript, renderPowerShellInstallScript } from "../src/index.mjs";

test("renders a shell installer with OS and arch detection plus signature checks", () => {
  const script = renderShellInstallScript("rubric-studio-open", { gpgFingerprint: "ABC123" });
  assert.match(script, /uname -s/);
  assert.match(script, /uname -m/);
  assert.match(script, /gpg --batch --verify/);
  assert.match(script, /updates\.auraone\.ai\/keys\/auraone-open\.gpg/);
  assert.match(script, /ensure_release_gpg_key/);
  assert.match(script, /Verified SHA256SUMS signature fingerprint/);
  assert.match(script, /rubricstudio/);
});

test("renders a PowerShell installer with Authenticode verification", () => {
  const script = renderPowerShellInstallScript("agent-studio-open", { windowsPublisherThumbprint: "THUMB" });
  assert.match(script, /Get-AuthenticodeSignature/);
  assert.match(script, /Get-FileHash -Algorithm SHA256/);
  assert.match(script, /agent-studio-open/);
});

test("worker returns flagship install script", async () => {
  const response = await handleInstallRequest(new Request("https://install.auraone.ai/robotics-studio-open"));
  assert.equal(response.status, 200);
  assert.match(await response.text(), /Robotics Studio Open/);
});

test("worker supports the robotics-studio install alias", async () => {
  const response = await handleInstallRequest(new Request("https://install.auraone.ai/robotics-studio"));
  assert.equal(response.status, 200);
  const script = await response.text();
  assert.match(script, /Robotics Studio Open/);
  assert.match(script, /Robotics\.Studio\.Open_\$\{VERSION\}_aarch64\.dmg/);
  assert.doesNotMatch(script, /macos-x64|macos-13/);
});

test("worker returns fallback install script signature when KV is empty", async () => {
  const response = await handleInstallRequest(new Request("https://install.auraone.ai/robotics-studio-open.asc"), {
    INSTALL_SIGNATURES: { async get() { return null; } }
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "application/pgp-signature");
  assert.match(await response.text(), /BEGIN PGP SIGNATURE/);
});

test("KV install script signature overrides the fallback", async () => {
  const response = await handleInstallRequest(new Request("https://install.auraone.ai/robotics-studio-open.asc"), {
    INSTALL_SIGNATURES: { async get() { return "test-signature"; } }
  });
  assert.equal(response.status, 200);
  assert.equal(await response.text(), "test-signature");
});
