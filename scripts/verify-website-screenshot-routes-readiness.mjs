#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const platformRoot = path.resolve(scriptDir, "..");
const repoRoot = path.resolve(platformRoot, "../..");
const baseUrl = process.env.AURAONE_WEBSITE_BASE_URL ?? "https://auraone.ai";

const products = [
  {
    id: "agent-studio-open",
    name: "Agent Studio Open",
    route: "/open/agent-studio-open",
    expectedDimensions: { width: 2880, height: 1800 },
    requiredMarkers: [
      "Agent Studio Open",
      "CONNECT MCP/A2A",
      "INSPECT TOOL TRACE",
      "EXPORT CI REGRESSION",
      "agentstudio.auraone.ai",
    ],
    screenshots: [
      "connect-endpoint.png",
      "inspect-tool-trace.png",
      "replay-run.png",
      "compare-behavior.png",
      "export-ci.png",
    ],
  },
  {
    id: "rubric-studio-open",
    name: "Rubric Studio Open",
    route: "/open/rubric-studio-open",
    expectedDimensions: { width: 1440, height: 900 },
    requiredMarkers: [
      "Rubric Studio Open",
      "AUTHOR CRITERIA",
      "PREVIEW SCORING",
      "EXPORT PORTABLE ARTIFACTS",
      "rubric-studio.auraone.ai",
    ],
    screenshots: [
      "author-criteria.png",
      "preview-scoring.png",
      "calibrate-gold.png",
      "diff-score-impact.png",
      "export-artifacts.png",
    ],
  },
];

const liveRoutes = [
  { group: "open", route: "/open" },
  { group: "open", route: "/open/agent-studio-open" },
  { group: "open", route: "/open/rubric-studio-open" },
  { group: "open", route: "/open/robotics-studio" },
  { group: "open", route: "/open/trust-toolkit" },
  { group: "docs", route: "/resources/docs" },
  { group: "docs", route: "/resources/docs/agent-studio-open" },
  { group: "docs", route: "/resources/docs/agent-studio-open/quickstart" },
  { group: "docs", route: "/resources/docs/agent-studio-open/mcp-cookbook" },
  { group: "docs", route: "/resources/docs/agent-studio-open/cli-reference" },
  { group: "docs", route: "/resources/docs/robotics-studio-open" },
  { group: "docs", route: "/resources/docs/robotics-studio-open/quickstart" },
  { group: "docs", route: "/resources/docs/robotics-studio-open/capture-schema" },
  { group: "docs", route: "/resources/docs/robotics-studio-open/export-formats" },
  { group: "docs", route: "/docs/robotics/capture-schema" },
  { group: "docs", route: "/docs/robotics/export-formats" },
  { group: "docs", route: "/docs/robotics/teleop-server" },
  { group: "app", route: "/apps/robotics-capture" },
];

const redirectRoutes = [
  {
    route: "/open/v2",
    expectedStatuses: [307, 308],
    expectedLocationPath: "/open/trust-toolkit",
  },
  {
    route: "/apply/robotics-operator",
    expectedStatuses: [307, 308],
    expectedLocationPath: "/public/ai-labs/jobs/data-video-and-robotics-generalist-cmnyzsgub002y4ibprjdrtcxu",
  },
];

function routeUrl(route) {
  return new URL(route, baseUrl).toString();
}

function screenshotRoute(product, fileName) {
  return `/open/${product.id}/screenshots/${fileName}`;
}

function localScreenshotPath(product, fileName) {
  return path.join(repoRoot, "auraone-website", "public", "open", product.id, "screenshots", fileName);
}

function readPngDimensions(buffer) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (buffer.length < 24 || !buffer.subarray(0, 8).equals(signature)) {
    throw new Error("file is not a PNG");
  }
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        "user-agent": "auraone-open-studio-website-screenshot-verifier/1.0",
        ...(options.headers ?? {}),
      },
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function checkRoute(routeSpec) {
  const spec = typeof routeSpec === "string" ? { group: "default", route: routeSpec } : routeSpec;
  const url = routeUrl(spec.route);
  try {
    const response = await fetchWithTimeout(url, { redirect: "manual" });
    return {
      group: spec.group,
      route: spec.route,
      url,
      expectedStatus: 200,
      status: response.status,
      ok: response.status === 200,
      contentType: response.headers.get("content-type") ?? null,
      error: null,
    };
  } catch (error) {
    return {
      group: spec.group,
      route: spec.route,
      url,
      expectedStatus: 200,
      status: null,
      ok: false,
      contentType: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function checkRedirect(routeSpec) {
  const url = routeUrl(routeSpec.route);
  try {
    const response = await fetchWithTimeout(url, { redirect: "manual" });
    const location = response.headers.get("location");
    const resolvedLocation = location ? new URL(location, url) : null;
    const locationMatches = resolvedLocation?.pathname === routeSpec.expectedLocationPath;
    return {
      route: routeSpec.route,
      url,
      expectedStatuses: routeSpec.expectedStatuses,
      expectedLocationPath: routeSpec.expectedLocationPath,
      status: response.status,
      location: resolvedLocation?.toString() ?? location,
      ok: routeSpec.expectedStatuses.includes(response.status) && locationMatches,
      error: null,
    };
  } catch (error) {
    return {
      route: routeSpec.route,
      url,
      expectedStatuses: routeSpec.expectedStatuses,
      expectedLocationPath: routeSpec.expectedLocationPath,
      status: null,
      location: null,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function checkLocalScreenshot(product, fileName) {
  const absolutePath = localScreenshotPath(product, fileName);
  if (!fs.existsSync(absolutePath)) {
    return {
      fileName,
      relativePath: path.relative(repoRoot, absolutePath),
      present: false,
      ok: false,
      dimensions: null,
      expectedDimensions: product.expectedDimensions,
      bytes: null,
      error: "local screenshot is missing",
    };
  }
  try {
    const buffer = fs.readFileSync(absolutePath);
    const dimensions = readPngDimensions(buffer);
    const dimensionsMatch =
      dimensions.width === product.expectedDimensions.width &&
      dimensions.height === product.expectedDimensions.height;
    return {
      fileName,
      relativePath: path.relative(repoRoot, absolutePath),
      present: true,
      ok: dimensionsMatch,
      dimensions,
      expectedDimensions: product.expectedDimensions,
      bytes: buffer.length,
      error: dimensionsMatch ? null : "local screenshot dimensions do not match the expected launch asset size",
    };
  } catch (error) {
    return {
      fileName,
      relativePath: path.relative(repoRoot, absolutePath),
      present: true,
      ok: false,
      dimensions: null,
      expectedDimensions: product.expectedDimensions,
      bytes: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function checkLiveScreenshot(product, fileName) {
  const route = screenshotRoute(product, fileName);
  const url = routeUrl(route);
  try {
    const response = await fetchWithTimeout(url);
    const contentType = response.headers.get("content-type") ?? "";
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    let dimensions = null;
    let dimensionError = null;
    try {
      dimensions = readPngDimensions(buffer);
    } catch (error) {
      dimensionError = error instanceof Error ? error.message : String(error);
    }
    const dimensionsMatch =
      dimensions?.width === product.expectedDimensions.width &&
      dimensions?.height === product.expectedDimensions.height;
    const ok =
      response.status === 200 &&
      contentType.includes("image/png") &&
      buffer.length > 50_000 &&
      dimensionsMatch;
    return {
      fileName,
      route,
      url,
      status: response.status,
      contentType,
      bytes: buffer.length,
      dimensions,
      expectedDimensions: product.expectedDimensions,
      ok,
      error: ok
        ? null
        : dimensionError ??
          "live screenshot must return HTTP 200 image/png, exceed 50 KB, and match expected dimensions",
    };
  } catch (error) {
    return {
      fileName,
      route,
      url,
      status: null,
      contentType: null,
      bytes: null,
      dimensions: null,
      expectedDimensions: product.expectedDimensions,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function checkProduct(product) {
  const route = routeUrl(product.route);
  let html = "";
  let htmlStatus = null;
  let htmlContentType = null;
  let htmlError = null;
  try {
    const response = await fetchWithTimeout(route);
    htmlStatus = response.status;
    htmlContentType = response.headers.get("content-type") ?? null;
    html = await response.text();
  } catch (error) {
    htmlError = error instanceof Error ? error.message : String(error);
  }
  const missingMarkers = product.requiredMarkers.filter((marker) => !html.includes(marker));
  const localScreenshots = product.screenshots.map((fileName) => checkLocalScreenshot(product, fileName));
  const liveScreenshots = await Promise.all(product.screenshots.map((fileName) => checkLiveScreenshot(product, fileName)));
  return {
    id: product.id,
    name: product.name,
    route: product.route,
    url: route,
    page: {
      status: htmlStatus,
      contentType: htmlContentType,
      ok: htmlStatus === 200 && missingMarkers.length === 0 && !htmlError,
      requiredMarkers: product.requiredMarkers,
      missingMarkers,
      error: htmlError,
    },
    localScreenshots,
    liveScreenshots,
    ok:
      htmlStatus === 200 &&
      missingMarkers.length === 0 &&
      !htmlError &&
      localScreenshots.every((screenshot) => screenshot.ok) &&
      liveScreenshots.every((screenshot) => screenshot.ok),
  };
}

function collectBlockers(routeStates, redirectStates, productStates) {
  const blockers = [];
  for (const route of routeStates) {
    if (!route.ok) {
      blockers.push(`${route.route}: expected HTTP 200 from ${route.url}, found ${route.status ?? route.error}`);
    }
  }
  for (const redirect of redirectStates) {
    if (!redirect.ok) {
      blockers.push(
        `${redirect.route}: expected ${redirect.expectedStatuses.join("/")} redirect to ${redirect.expectedLocationPath}, found status ${
          redirect.status ?? "none"
        } location ${redirect.location ?? redirect.error ?? "none"}`,
      );
    }
  }
  for (const product of productStates) {
    if (!product.page.ok) {
      if (product.page.status !== 200) {
        blockers.push(`${product.id}: marketing page expected HTTP 200, found ${product.page.status ?? product.page.error}`);
      }
      for (const marker of product.page.missingMarkers) {
        blockers.push(`${product.id}: marketing page is missing walkthrough marker '${marker}'`);
      }
    }
    for (const screenshot of product.localScreenshots) {
      if (!screenshot.ok) {
        blockers.push(`${product.id}/${screenshot.fileName}: local screenshot failed validation: ${screenshot.error}`);
      }
    }
    for (const screenshot of product.liveScreenshots) {
      if (!screenshot.ok) {
        blockers.push(`${product.id}/${screenshot.fileName}: live screenshot failed validation: ${screenshot.error}`);
      }
    }
  }
  return blockers;
}

const routeStates = await Promise.all(liveRoutes.map(checkRoute));
const redirectStates = await Promise.all(redirectRoutes.map(checkRedirect));
const productStates = await Promise.all(products.map(checkProduct));
const blockers = collectBlockers(routeStates, redirectStates, productStates);

console.log(JSON.stringify({
  ok: true,
  readyForWebsiteScreenshotRouteClosure: blockers.length === 0,
  checkedAt: new Date().toISOString(),
  baseUrl,
  safetyRule:
    "This verifier only reads local screenshot files and public AuraOne website routes; it does not deploy, mutate Sentry, post launch assets, or expose credentials.",
  routes: routeStates,
  redirects: redirectStates,
  products: productStates,
  blockers,
}, null, 2));
