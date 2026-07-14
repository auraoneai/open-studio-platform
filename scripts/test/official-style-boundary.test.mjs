import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";

import { startOfficialStyleBoundary } from "../../tools/official-style-boundary.mjs";

test("serves only approved official style asset types over loopback", async () => {
  const root = await mkdtemp(resolve(tmpdir(), "auraone-official-style-"));
  await writeFile(
    resolve(root, "proofline-brand.css"),
    '@font-face{font-family:"Official";src:url("./official.woff2")} :root{--pl-official-font-ui:"Official"}',
  );
  await writeFile(resolve(root, "official.woff2"), Buffer.from("font-fixture"));
  await writeFile(resolve(root, "private.txt"), "not served");

  const boundary = await startOfficialStyleBoundary({ assetRoot: root });
  try {
    const stylesheet = await fetch(boundary.stylesheetUrl);
    assert.equal(stylesheet.status, 200);
    assert.equal(
      stylesheet.headers.get("access-control-allow-origin"),
      "*",
    );
    assert.equal(
      stylesheet.headers.get("cross-origin-resource-policy"),
      "cross-origin",
    );
    assert.match(await stylesheet.text(), /pl-official-font-ui/u);

    const font = await fetch(new URL("official.woff2", boundary.stylesheetUrl));
    assert.equal(font.status, 200);
    assert.equal(font.headers.get("content-type"), "font/woff2");
    assert.deepEqual(Buffer.from(await font.arrayBuffer()), Buffer.from("font-fixture"));

    const denied = await fetch(
      new URL("private.txt", boundary.stylesheetUrl),
    );
    assert.equal(denied.status, 404);
  } finally {
    await boundary.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("rejects a stylesheet path outside the approved asset root", async () => {
  const root = await mkdtemp(resolve(tmpdir(), "auraone-official-style-"));
  try {
    await assert.rejects(
      startOfficialStyleBoundary({
        assetRoot: root,
        stylesheet: "../outside.css",
      }),
      /escapes its root/u,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
