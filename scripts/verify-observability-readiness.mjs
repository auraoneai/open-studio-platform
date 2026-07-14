#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const platformRoot = path.resolve(scriptDir, "..");
const repoRoot = path.resolve(platformRoot, "../..");
const probeUptime = process.argv.includes("--probe-uptime");
const probeSentry = process.argv.includes("--probe-sentry");
const probeGithubSecrets = process.argv.includes("--probe-github-secrets");

const requiredDsnEnvBySlug = {
  "rubric-studio-open": "RUBRIC_STUDIO_OPEN_SENTRY_DSN",
  "robotics-studio-open": "ROBOTICS_STUDIO_OPEN_SENTRY_DSN",
  "agent-studio-open": "AGENT_STUDIO_OPEN_SENTRY_DSN",
};

const githubRepoBySlug = {
  "rubric-studio-open": "auraoneai/rubric-studio-open",
  "robotics-studio-open": "auraoneai/robotics-studio-open",
  "agent-studio-open": "auraoneai/agent-studio-open",
};
const textEvidenceExtensions = new Set([".md", ".json", ".txt"]);
const placeholderPattern =
  /\b(TODO|TBD|FIXME|placeholder|pending|not yet|draft only|to be added|example only)\b/i;

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(platformRoot, relativePath), "utf8"));
}

function commandAvailable(command) {
  return spawnSync("which", [command], { stdio: "ignore" }).status === 0;
}

function validateDsn(value) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return Boolean(url.protocol === "https:" && url.username && url.hostname && url.pathname.length > 1);
  } catch {
    return false;
  }
}

function resolveEvidencePath(candidatePath) {
  if (!candidatePath) return "";
  if (path.isAbsolute(candidatePath)) return candidatePath;
  const repoCandidate = path.resolve(repoRoot, candidatePath);
  if (fs.existsSync(repoCandidate)) return repoCandidate;
  return path.resolve(platformRoot, candidatePath);
}

function validateEvidenceFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    return {
      present: false,
      accepted: false,
      extension: null,
      bytes: null,
      rejectionReasons: ["file is missing"],
    };
  }
  const stat = fs.statSync(filePath);
  const extension = path.extname(filePath).toLowerCase();
  const reasons = [];
  if (stat.size === 0) {
    reasons.push("file is empty");
  }
  if (textEvidenceExtensions.has(extension)) {
    const text = fs.readFileSync(filePath, "utf8");
    if (text.trim().length < 120) {
      reasons.push("text evidence is too short to prove observability readiness");
    }
    if (placeholderPattern.test(text)) {
      reasons.push("text evidence contains placeholder or pending language");
    }
    if (extension === ".json") {
      try {
        const parsed = JSON.parse(text);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          reasons.push("JSON evidence must be an object");
        } else if (Object.keys(parsed).length < 3) {
          reasons.push("JSON evidence object must contain at least three fields");
        }
      } catch {
        reasons.push("JSON evidence is not valid JSON");
      }
    }
  } else if (stat.size < 512) {
    reasons.push("binary evidence is too small to be a credible screenshot or PDF");
  }
  return {
    present: true,
    accepted: reasons.length === 0,
    extension,
    bytes: stat.size,
    rejectionReasons: reasons,
  };
}

function evidenceFileExists(envName, fallbackPath = "") {
  const envPath = process.env[envName] ?? "";
  const evidencePath = envPath || fallbackPath;
  const resolvedPath = resolveEvidencePath(evidencePath);
  const validation = validateEvidenceFile(resolvedPath);
  return {
    envName,
    configured: Boolean(envPath),
    fallbackConfigured: Boolean(fallbackPath),
    source: envPath ? "env" : fallbackPath ? "config" : "missing",
    present: validation.present,
    accepted: validation.accepted,
    extension: validation.extension,
    bytes: validation.bytes,
    rejectionReasons: validation.rejectionReasons,
  };
}

function matchingDashboardEvidenceFiles(slug) {
  if (!dashboardEvidenceDirPresent) return [];
  return fs
    .readdirSync(dashboardEvidenceDirPath)
    .filter((fileName) => fileName.includes(slug))
    .map((fileName) => validateEvidenceFile(path.join(dashboardEvidenceDirPath, fileName)));
}

async function sentryProjectProbe(orgSlug, expectedSlugs) {
  const result = {
    attempted: false,
    ok: false,
    error: null,
    visibleProjectSlugs: [],
  };
  if (!probeSentry) return result;
  result.attempted = true;
  const token = process.env.SENTRY_AUTH_TOKEN;
  if (!token) {
    result.error = "SENTRY_AUTH_TOKEN is not configured";
    return result;
  }
  try {
    const response = await fetch(`https://sentry.io/api/0/organizations/${orgSlug}/projects/`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      result.error = `Sentry API returned HTTP ${response.status}`;
      return result;
    }
    const projects = await response.json();
    result.visibleProjectSlugs = projects.map((project) => project.slug).sort();
    result.ok = expectedSlugs.every((slug) => result.visibleProjectSlugs.includes(slug));
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
  }
  return result;
}

function githubSecretProbe(projectStates) {
  const result = {
    attempted: false,
    ok: false,
    ghCliAvailable: commandAvailable("gh"),
    states: [],
    error: null,
  };
  if (!probeGithubSecrets) return result;
  result.attempted = true;
  if (!result.ghCliAvailable) {
    result.error = "gh CLI is not available";
    return result;
  }

  for (const project of projectStates) {
    const repo = githubRepoBySlug[project.slug];
    const secretName = project.requiredDsnEnvName;
    if (!repo || !secretName) {
      result.states.push({
        slug: project.slug,
        repo: repo ?? null,
        secretName: secretName ?? null,
        present: false,
        checked: false,
        error: "missing repo or secret mapping",
      });
      continue;
    }

    const secretList = spawnSync("gh", ["secret", "list", "--repo", repo], {
      encoding: "utf8",
    });
    if (secretList.status !== 0) {
      result.states.push({
        slug: project.slug,
        repo,
        secretName,
        present: false,
        checked: false,
        error: secretList.stderr.trim() || `gh exited ${secretList.status}`,
      });
      continue;
    }

    const present = secretList.stdout
      .split(/\r?\n/)
      .some((line) => line.split(/\s+/)[0] === secretName);
    result.states.push({
      slug: project.slug,
      repo,
      secretName,
      present,
      checked: true,
      error: null,
    });
  }

  result.ok = result.states.length === projectStates.length && result.states.every((state) => state.present);
  return result;
}

async function probeCheck(check) {
  const result = {
    name: check.name,
    url: check.url,
    expectedStatus: check.expected_status,
    ok: false,
    status: null,
    contains: check.response_contains ?? null,
    error: null,
  };
  try {
    const response = await fetch(check.url, { method: check.method ?? "GET" });
    result.status = response.status;
    let bodyOk = true;
    if (check.response_contains) {
      const body = await response.text();
      bodyOk = body.includes(check.response_contains);
    }
    result.ok = response.status === check.expected_status && bodyOk;
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
  }
  return result;
}

const sentryConfig = readJson("configs/sentry/projects.json");
const scrubConfig = readJson("configs/sentry-scrub.json");
const rubricStatus = readJson("distribution/status/rubric-studio-open.json");
const expectedProjectSlugs = sentryConfig.projects.map((project) => project.slug);
const sentryCliAvailable = commandAvailable("sentry-cli");
const sentryAuthTokenPresent = Boolean(process.env.SENTRY_AUTH_TOKEN);
const dashboardEvidenceDir = process.env.AURAONE_SENTRY_DASHBOARD_EVIDENCE_DIR ?? "";
const dashboardEvidenceDirPath = resolveEvidencePath(dashboardEvidenceDir);
const dashboardEvidenceDirPresent = Boolean(
  dashboardEvidenceDirPath && fs.existsSync(dashboardEvidenceDirPath),
);

const projectStates = sentryConfig.projects.map((project) => {
  const dsnEnvName = requiredDsnEnvBySlug[project.slug];
  const dsnValue = dsnEnvName ? process.env[dsnEnvName] : "";
  const evidencePrefix = project.slug.toUpperCase().replaceAll("-", "_");
  const projectEvidence = evidenceFileExists(
    `${evidencePrefix}_SENTRY_PROJECT_EVIDENCE`,
    project.evidence,
  );
  const uploadEvidence = evidenceFileExists(
    `${evidencePrefix}_SENTRY_UPLOAD_EVIDENCE`,
    `docs/evidence/product/open-studio-sentry-2026-05-20/${project.slug}-upload.md`,
  );
  const dashboardEvidence = evidenceFileExists(
    `${evidencePrefix}_SENTRY_DASHBOARD_EVIDENCE`,
    project.dashboard_evidence,
  );
  const dashboardEvidencePresent =
    dashboardEvidence.present ||
    (dashboardEvidenceDirPresent &&
      fs
        .readdirSync(dashboardEvidenceDirPath)
        .some((fileName) => fileName.includes(project.slug)));
  const dashboardEvidenceFiles = matchingDashboardEvidenceFiles(project.slug);
  const dashboardEvidenceAccepted =
    dashboardEvidence.accepted || dashboardEvidenceFiles.some((file) => file.accepted);

  return {
    slug: project.slug,
    displayName: project.display_name,
    configStatus: project.status,
    requiredDsnEnvName: dsnEnvName,
    dsnPresent: Boolean(dsnValue),
    dsnShapeValid: validateDsn(dsnValue),
    projectEvidence,
    uploadEvidence,
    dashboardEvidence,
    dashboardEvidencePresent,
    dashboardEvidenceAccepted,
    dashboardEvidenceFiles,
    hostedDsnSecretPresent: null,
    dsnRequirementSatisfied: false,
    dsnSatisfiedBy: "missing",
    provisionedInConfig: project.status === "provisioned",
  };
});

const sentryProbe = await sentryProjectProbe(sentryConfig.org_slug, expectedProjectSlugs);
const hostedSecretProbe = githubSecretProbe(projectStates);
const hostedSecretPresentBySlug = new Map(
  hostedSecretProbe.states.map((state) => [state.slug, state.checked && state.present]),
);
for (const project of projectStates) {
  const hostedDsnSecretPresent = hostedSecretPresentBySlug.get(project.slug) ?? false;
  project.hostedDsnSecretPresent = hostedSecretProbe.attempted ? hostedDsnSecretPresent : null;
  project.dsnRequirementSatisfied = Boolean(project.dsnShapeValid || hostedDsnSecretPresent);
  project.dsnSatisfiedBy = project.dsnShapeValid
    ? "local-env"
    : hostedDsnSecretPresent
      ? "hosted-github-secret"
      : "missing";
}
const uptimeProbeResults = probeUptime
  ? await Promise.all(rubricStatus.checks.map((check) => probeCheck(check)))
  : [];

const blockers = [];
if (!projectStates.every((project) => project.provisionedInConfig)) {
  blockers.push("Sentry project config statuses are not marked provisioned");
}
for (const project of projectStates) {
  if (!project.projectEvidence.present) {
    blockers.push(`${project.slug}: project evidence missing`);
  } else if (!project.projectEvidence.accepted) {
    blockers.push(`${project.slug}: project evidence present but not acceptable`);
  }
  if (!project.dsnRequirementSatisfied) blockers.push(`${project.slug}: DSN environment or hosted secret missing`);
  if (project.dsnPresent && !project.dsnShapeValid) blockers.push(`${project.slug}: DSN shape invalid`);
  if (!project.uploadEvidence.present) {
    blockers.push(`${project.slug}: synthetic upload evidence missing`);
  } else if (!project.uploadEvidence.accepted) {
    blockers.push(`${project.slug}: synthetic upload evidence present but not acceptable`);
  }
  if (!project.dashboardEvidencePresent) {
    blockers.push(`${project.slug}: dashboard evidence missing`);
  } else if (!project.dashboardEvidenceAccepted) {
    blockers.push(`${project.slug}: dashboard evidence present but not acceptable`);
  }
}
if (sentryProbe.attempted && !sentryProbe.ok) blockers.push("Sentry API project probe did not verify all projects");
if (hostedSecretProbe.attempted && !hostedSecretProbe.ok) {
  blockers.push("GitHub-hosted Sentry DSN secret probe did not verify all product repos");
}
if (rubricStatus.provisioning_status !== "provisioned") {
  blockers.push("Rubric uptime provider monitors are not provisioned");
}
if (probeUptime && uptimeProbeResults.some((result) => !result.ok)) {
  blockers.push("Rubric uptime endpoint probe failed");
}
const rubricUptimeEvidence = evidenceFileExists("AURAONE_RUBRIC_UPTIME_EVIDENCE", rubricStatus.evidence);
if (!rubricUptimeEvidence.present) {
  blockers.push("Rubric uptime provider evidence missing");
} else if (!rubricUptimeEvidence.accepted) {
  blockers.push("Rubric uptime provider evidence present but not acceptable");
}

console.log(
  JSON.stringify(
    {
      ok: true,
      readyForObservabilityClosure: blockers.length === 0,
      checkedAt: new Date().toISOString(),
      safetyRule:
        "This verifier prints only booleans, project slugs, evidence file validation summaries, and endpoint statuses; it does not print DSNs, auth tokens, secret values, or evidence file paths.",
      sentry: {
        orgSlug: sentryConfig.org_slug,
        defaultOptIn: sentryConfig.default_opt_in,
        sentryCliAvailable,
        sentryAuthTokenPresent,
        projectStates,
        hostedSecretProbe,
        scrubRuleCount: scrubConfig.rules.length,
        scrubRuleIds: scrubConfig.rules.map((rule) => rule.id).sort(),
        dashboardEvidenceDirConfigured: Boolean(dashboardEvidenceDir),
        dashboardEvidenceDirPresent,
        probe: sentryProbe,
      },
      rubricUptime: {
        provisioningStatus: rubricStatus.provisioning_status,
        statusPage: rubricStatus.status_page,
        evidence: rubricUptimeEvidence,
        configuredChecks: rubricStatus.checks.map((check) => ({
          name: check.name,
          url: check.url,
          expectedStatus: check.expected_status,
          responseContains: check.response_contains ?? null,
        })),
        probeResults: uptimeProbeResults,
      },
      blockers,
    },
    null,
    2,
  ),
);
