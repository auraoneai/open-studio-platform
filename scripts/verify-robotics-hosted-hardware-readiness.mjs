#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const platformRoot = path.resolve(scriptDir, "..");
const root = path.resolve(platformRoot, "../..");
const configPath = path.join(
  platformRoot,
  "distribution/robotics/robotics-hosted-hardware-readiness.json",
);
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
const errors = [];
const blockers = [];
const defaultEvidenceDir = path.join(root, "docs/evidence/product/robotics-hosted-hardware");
const textEvidenceExtensions = new Set([".md", ".json", ".txt"]);
const placeholderPattern =
  /\b(TODO|TBD|FIXME|placeholder|pending|not yet|draft only|to be added|example only)\b/i;

function commandAvailable(command) {
  return spawnSync("which", [command], { stdio: "ignore" }).status === 0;
}

function existsFromRoot(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function isExecutableFromRoot(relativePath) {
  try {
    fs.accessSync(path.join(root, relativePath), fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

function readFromRoot(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function setupDocumentState(document) {
  const relativePath = document.path;
  if (!relativePath || !existsFromRoot(relativePath)) {
    errors.push(`setup document is missing: ${relativePath ?? "(missing path)"}`);
    return {
      path: relativePath ?? null,
      present: false,
      missingTerms: document.required_terms ?? [],
    };
  }
  const text = readFromRoot(relativePath);
  const missingTerms = (document.required_terms ?? []).filter((term) => !text.includes(term));
  if (missingTerms.length > 0) {
    errors.push(`${relativePath}: setup document is missing required terms: ${missingTerms.join(", ")}`);
  }
  return {
    path: relativePath,
    present: true,
    missingTerms,
  };
}

function validateEvidenceFile(filePath, extension) {
  const stat = fs.statSync(filePath);
  const reasons = [];
  if (stat.size === 0) {
    reasons.push("file is empty");
  }
  if (textEvidenceExtensions.has(extension)) {
    const text = fs.readFileSync(filePath, "utf8");
    if (text.trim().length < 120) {
      reasons.push("text evidence is too short to prove Robotics hardware readiness");
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
    extension,
    bytes: stat.size,
    accepted: reasons.length === 0,
    rejectionReasons: reasons,
  };
}

function evidenceFileState(evidenceDir, key) {
  if (!evidenceDir) return { present: false, accepted: false, files: [] };
  const allowed = config.allowed_evidence_extensions ?? [".md", ".json", ".txt", ".png", ".pdf"];
  const base = path.resolve(evidenceDir, key);
  const files = allowed
    .filter((extension) => fs.existsSync(`${base}${extension}`))
    .map((extension) => validateEvidenceFile(`${base}${extension}`, extension));
  return {
    present: files.length > 0,
    accepted: files.some((file) => file.accepted),
    files,
  };
}

function ghRunView(repository, runId) {
  if (!commandAvailable("gh")) {
    return {
      available: false,
      error: "gh command is not installed",
      status: null,
      conclusion: null,
      url: null,
      jobs: [],
    };
  }
  const result = spawnSync(
    "gh",
    [
      "run",
      "view",
      String(runId),
      "--repo",
      repository,
      "--json",
      "conclusion,status,url,createdAt,updatedAt,jobs",
    ],
    { encoding: "utf8", maxBuffer: 1024 * 1024 * 8 },
  );
  if (result.status !== 0) {
    return {
      available: false,
      error: (result.stderr || result.stdout).trim() || `gh exited ${result.status}`,
      status: null,
      conclusion: null,
      url: null,
      jobs: [],
    };
  }
  const run = JSON.parse(result.stdout);
  return {
    available: true,
    error: null,
    status: run.status,
    conclusion: run.conclusion,
    url: run.url,
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
    jobs: run.jobs.map((job) => ({
      name: job.name,
      status: job.status,
      conclusion: job.conclusion,
      url: job.url,
    })),
  };
}

function summarizeStatusCheck(check) {
  return {
    type: check.__typename ?? null,
    name: check.name ?? check.context ?? null,
    workflowName: check.workflowName ?? null,
    status: check.status ?? check.state ?? null,
    conclusion: check.conclusion ?? null,
    detailsUrl: check.detailsUrl ?? check.targetUrl ?? null,
    startedAt: check.startedAt ?? null,
    completedAt: check.completedAt ?? null,
  };
}

function summarizeReview(review) {
  return {
    author: review.author?.login ?? null,
    state: review.state ?? null,
    submittedAt: review.submittedAt ?? null,
  };
}

function summarizeReviewRequest(request) {
  return {
    type: request.__typename ?? null,
    name: request.name ?? request.login ?? null,
    slug: request.slug ?? request.login ?? null,
  };
}

function ghPrView(repository, number) {
  if (!number) return null;
  if (!commandAvailable("gh")) {
    return {
      available: false,
      error: "gh command is not installed",
      number,
      url: null,
      state: null,
      mergeStateStatus: null,
      reviewDecision: null,
      reviews: [],
      reviewRequests: [],
      statusChecks: [],
    };
  }
  const result = spawnSync(
    "gh",
    [
      "pr",
      "view",
      String(number),
      "--repo",
      repository,
      "--json",
      "number,state,mergeable,mergeStateStatus,reviewDecision,url,updatedAt,title,autoMergeRequest,reviewRequests,reviews,statusCheckRollup",
    ],
    { encoding: "utf8", maxBuffer: 1024 * 1024 * 8 },
  );
  if (result.status !== 0) {
    return {
      available: false,
      error: (result.stderr || result.stdout).trim() || `gh exited ${result.status}`,
      number,
      url: null,
      state: null,
      mergeStateStatus: null,
      reviewDecision: null,
      reviews: [],
      reviewRequests: [],
      statusChecks: [],
    };
  }
  const pr = JSON.parse(result.stdout);
  return {
    available: true,
    error: null,
    number: pr.number,
    title: pr.title,
    url: pr.url,
    state: pr.state,
    mergeable: pr.mergeable,
    mergeStateStatus: pr.mergeStateStatus,
    reviewDecision: pr.reviewDecision,
    updatedAt: pr.updatedAt,
    autoMerge: {
      enabled: Boolean(pr.autoMergeRequest),
      mergeMethod: pr.autoMergeRequest?.mergeMethod ?? null,
      enabledAt: pr.autoMergeRequest?.enabledAt ?? null,
      enabledBy: pr.autoMergeRequest?.enabledBy?.login ?? null,
    },
    reviewRequests: (pr.reviewRequests ?? []).map(summarizeReviewRequest),
    reviews: (pr.reviews ?? []).map(summarizeReview),
    statusChecks: (pr.statusCheckRollup ?? []).map(summarizeStatusCheck),
  };
}

function ghVariables(repository) {
  const output = {
    available: false,
    error: null,
    variables: {},
  };
  if (!commandAvailable("gh")) {
    output.error = "gh command is not installed";
    return output;
  }
  const result = spawnSync("gh", ["variable", "list", "--repo", repository], {
    encoding: "utf8",
    maxBuffer: 1024 * 1024,
  });
  if (result.status !== 0) {
    output.error = (result.stderr || result.stdout).trim() || `gh exited ${result.status}`;
    return output;
  }
  output.available = true;
  for (const line of result.stdout.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const [name, ...rest] = trimmed.split(/\s+/);
    output.variables[name] = rest.join(" ");
  }
  return output;
}

function ghActionRunners(repository, requiredLabels) {
  const output = {
    available: false,
    error: null,
    totalCount: 0,
    requiredLabels,
    matchingCount: 0,
    onlineMatchingCount: 0,
  };
  if (!commandAvailable("gh")) {
    output.error = "gh command is not installed";
    return output;
  }
  const result = spawnSync(
    "gh",
    ["api", `repos/${repository}/actions/runners`, "--jq", "."],
    { encoding: "utf8", maxBuffer: 1024 * 1024 * 4 },
  );
  if (result.status !== 0) {
    output.error = (result.stderr || result.stdout).trim() || `gh exited ${result.status}`;
    return output;
  }
  const response = JSON.parse(result.stdout);
  const required = new Set(requiredLabels);
  const runners = response.runners ?? [];
  const matching = runners.filter((runner) => {
    const labels = new Set((runner.labels ?? []).map((label) => label.name).filter(Boolean));
    return [...required].every((label) => labels.has(label));
  });
  output.available = true;
  output.totalCount = response.total_count ?? runners.length;
  output.matchingCount = matching.length;
  output.onlineMatchingCount = matching.filter((runner) => runner.status === "online").length;
  return output;
}

function ghBranchProtection(repository) {
  const output = {
    available: false,
    error: null,
    requiredReviewCount: null,
    requiresCodeOwnerReviews: null,
    requiredStatusChecks: [],
  };
  if (!commandAvailable("gh")) {
    output.error = "gh command is not installed";
    return output;
  }
  const result = spawnSync(
    "gh",
    ["api", `repos/${repository}/branches/main/protection`, "--jq", "."],
    { encoding: "utf8", maxBuffer: 1024 * 1024 * 2 },
  );
  if (result.status !== 0) {
    output.error = (result.stderr || result.stdout).trim() || `gh exited ${result.status}`;
    return output;
  }
  const protection = JSON.parse(result.stdout);
  output.available = true;
  output.requiredReviewCount =
    protection.required_pull_request_reviews?.required_approving_review_count ?? null;
  output.requiresCodeOwnerReviews =
    protection.required_pull_request_reviews?.require_code_owner_reviews ?? null;
  output.requiredStatusChecks = (
    protection.required_status_checks?.contexts ??
    protection.required_status_checks?.checks?.map((check) => check.context) ??
    []
  ).filter(Boolean);
  return output;
}

function requiredJobState(run, requiredJobs) {
  const jobsByName = new Map(run.jobs.map((job) => [job.name, job]));
  return requiredJobs.map((name) => {
    const job = jobsByName.get(name) ?? null;
    if (!job) {
      blockers.push(`${name}: required hosted job is missing from run ${run.url ?? "(unknown run)"}`);
    } else if (job.conclusion !== "success") {
      blockers.push(`${name}: hosted job conclusion is ${job.conclusion ?? "unknown"}`);
    }
    return {
      name,
      present: Boolean(job),
      status: job?.status ?? null,
      conclusion: job?.conclusion ?? null,
      url: job?.url ?? null,
      success: job?.conclusion === "success",
    };
  });
}

function requiredStatusCheckState(statusChecks, requiredChecks) {
  const checksByName = new Map(statusChecks.map((check) => [check.name, check]));
  return requiredChecks.map((name) => {
    const check = checksByName.get(name) ?? null;
    return {
      name,
      present: Boolean(check),
      status: check?.status ?? null,
      conclusion: check?.conclusion ?? null,
      detailsUrl: check?.detailsUrl ?? null,
      success: check?.conclusion === "SUCCESS" || check?.conclusion === "success",
    };
  });
}

function workflowState(key, workflow) {
  if (!existsFromRoot(workflow.local_path)) {
    errors.push(`${key}: missing workflow file ${workflow.local_path}`);
    return null;
  }
  const text = readFromRoot(workflow.local_path);
  const localDeclaresRequiredJobs = workflow.required_jobs.map((jobName) => {
    const shortName = jobName.includes(" / ") ? jobName.split(" / ").pop() : jobName;
    const declared = text.includes(shortName);
    if (!declared) {
      errors.push(`${key}: local workflow does not declare required job ${jobName}`);
    }
    return {
      name: jobName,
      localWorkflowDeclares: declared,
    };
  });

  const run = ghRunView(config.repository, workflow.run_id);
  if (!run.available) {
    blockers.push(`${workflow.workflow}: hosted run ${workflow.run_id} could not be read: ${run.error}`);
  } else if (run.conclusion !== "success") {
    blockers.push(`${workflow.workflow}: hosted run conclusion is ${run.conclusion ?? "unknown"}`);
  }
  const requiredJobs = run.available ? requiredJobState(run, workflow.required_jobs) : [];

  return {
    workflow: workflow.workflow,
    runId: workflow.run_id,
    localPath: workflow.local_path,
    localDeclaresRequiredJobs,
    hostedRun: run,
    requiredJobs,
    requiredJobsAllSuccessful:
      requiredJobs.length === workflow.required_jobs.length &&
      requiredJobs.every((job) => job.success),
  };
}

if (config.$schema !== "https://schemas.auraone.ai/open-studio/robotics-hosted-hardware-readiness/v1.json") {
  errors.push("schema must be the Open Studio Robotics hosted/hardware readiness v1 URL");
}
if (config.status !== "evidence-packet-prepared-hardware-execution-pending") {
  errors.push("status must preserve the hardware-execution-pending state");
}
if (!config.completion_rule?.includes("Do not mark Robotics hosted/hardware readiness complete")) {
  errors.push("completion_rule must forbid Robotics hosted/hardware closure without evidence");
}
if (!existsFromRoot(config.prd)) {
  errors.push(`missing Robotics PRD ${config.prd}`);
}

const setupDocuments = (config.setup_documents ?? []).map(setupDocumentState);
const ciWorkflow = config.workflows.ci;
const qaWorkflow = config.workflows.accessibility_performance;
const securityWorkflow = config.workflows.security;

if (!isExecutableFromRoot(ciWorkflow.gpu_script)) {
  errors.push(`GPU smoke script is missing or not executable: ${ciWorkflow.gpu_script}`);
}
if (!isExecutableFromRoot(qaWorkflow.performance_script)) {
  errors.push(`Performance baseline script is missing or not executable: ${qaWorkflow.performance_script}`);
}

const workflowStates = {
  ci: workflowState("ci", ciWorkflow),
  accessibilityPerformance: workflowState("accessibility_performance", qaWorkflow),
  security: workflowState("security", securityWorkflow),
};

const repairPr = ghPrView(config.repository, ciWorkflow.repair_pr?.number);
let repairPrRequiredJobStates = [];
let repairPrRequiredRepairCheckStates = [];
let repairPrReady = true;
if (repairPr) {
  if (!repairPr.available) {
    repairPrReady = false;
    blockers.push(`repair PR #${ciWorkflow.repair_pr.number} could not be read: ${repairPr.error}`);
  } else {
    repairPrRequiredJobStates = requiredStatusCheckState(repairPr.statusChecks, ciWorkflow.required_jobs);
    const repairCheckNames =
      ciWorkflow.repair_pr?.required_checks ??
      ciWorkflow.required_jobs.filter((name) => name !== "CI / gpu-video-embedding");
    repairPrRequiredRepairCheckStates = requiredStatusCheckState(
      repairPr.statusChecks,
      repairCheckNames,
    );
    const missingOrFailedRepairChecks = repairPrRequiredRepairCheckStates.filter((check) => !check.success);
    if (missingOrFailedRepairChecks.length > 0) {
      repairPrReady = false;
      for (const check of missingOrFailedRepairChecks) {
        blockers.push(
          `repair PR #${repairPr.number}: ${check.name} status check is ${check.conclusion ?? "missing"}`,
        );
      }
    }
    const repairPrMerged = repairPr.state === "MERGED";
    if (!repairPrMerged) {
      repairPrReady = false;
      blockers.push(`repair PR #${repairPr.number} is not merged into main`);
    }
    if (!repairPrMerged && repairPr.reviewDecision !== "APPROVED") {
      repairPrReady = false;
      blockers.push(`repair PR #${repairPr.number} does not have required human/CODEOWNERS approvals`);
    }
  }
}

const variables = ghVariables(config.repository);
const gpuVariableValue = variables.variables[ciWorkflow.gpu_enablement_variable] ?? null;
const gpuVariableEnabled = gpuVariableValue === "true";
if (!gpuVariableEnabled) {
  blockers.push(`${ciWorkflow.gpu_enablement_variable}: repo variable is not configured to true`);
}

const gpuRunnerLabels = ciWorkflow.gpu_runner_labels ?? ["self-hosted", "linux", "x64", "gpu"];
const runners = ghActionRunners(config.repository, gpuRunnerLabels);
if (!runners.available) {
  blockers.push(`GPU runner inventory could not be read: ${runners.error}`);
} else if (runners.matchingCount === 0) {
  blockers.push(`GPU runner with labels ${gpuRunnerLabels.join(", ")} is not configured`);
} else if (runners.onlineMatchingCount === 0) {
  blockers.push(`GPU runner with labels ${gpuRunnerLabels.join(", ")} is not online`);
}
const gpuRunnerReady = runners.available && runners.onlineMatchingCount > 0;

const branchProtection = ghBranchProtection(config.repository);
const requiredProtectionContexts = config.branch_protection_required_contexts ?? [
  "DCO / dco",
  "CI / linux-x64",
  "CI / linux-arm64",
  "CI / macos-arm64",
  "CI / macos-x64",
  "CI / windows-x64",
  "CI / gpu-video-embedding",
  "Accessibility and Performance / qa",
  "Security, SBOM, and License / release-security",
];
if (!branchProtection.available) {
  blockers.push(`branch protection could not be read: ${branchProtection.error}`);
} else {
  if ((branchProtection.requiredReviewCount ?? 0) < 2) {
    blockers.push("branch protection does not require two approving reviews");
  }
  if (branchProtection.requiresCodeOwnerReviews !== true) {
    blockers.push("branch protection does not require CODEOWNERS review");
  }
  const contextSet = new Set(branchProtection.requiredStatusChecks);
  for (const context of requiredProtectionContexts) {
    if (!contextSet.has(context)) {
      blockers.push(`branch protection required check is missing: ${context}`);
    }
  }
}

const evidenceDirValue = process.env[config.evidence_dir_env] ?? "";
const evidenceDirSource = evidenceDirValue
  ? "env"
  : fs.existsSync(defaultEvidenceDir)
    ? "default"
    : "none";
const evidenceDir = evidenceDirValue
  ? path.resolve(path.isAbsolute(evidenceDirValue) ? evidenceDirValue : path.join(root, evidenceDirValue))
  : fs.existsSync(defaultEvidenceDir)
    ? defaultEvidenceDir
    : "";
const evidenceStates = (config.required_external_evidence ?? []).map((item) => {
  if (!item.key || !/^[a-z0-9-]+$/.test(item.key)) {
    errors.push("required external evidence keys must be lowercase kebab-case");
  }
  if (!Array.isArray(item.required_evidence) || item.required_evidence.length < 3) {
    errors.push(`${item.key}: required_evidence must list at least three items`);
  }
  const evidence = evidenceFileState(evidenceDir, item.key);
  if (!evidence.present) {
    blockers.push(`${item.key}: Robotics hardware/CI evidence is missing`);
  } else if (!evidence.accepted) {
    blockers.push(`${item.key}: Robotics hardware/CI evidence is present but not acceptable`);
  }
  return {
    key: item.key,
    name: item.name,
    requiredEvidence: item.required_evidence,
    externalEvidencePresent: evidence.accepted,
    evidenceFiles: evidence.files,
  };
});

if (errors.length > 0) {
  for (const error of errors) console.error(error);
  process.exit(1);
}

const workflowsReady = Object.values(workflowStates).every(
  (state) => state?.hostedRun.available && state.requiredJobsAllSuccessful,
);
const branchProtectionReady =
  branchProtection.available &&
  (branchProtection.requiredReviewCount ?? 0) >= 2 &&
  branchProtection.requiresCodeOwnerReviews === true &&
  requiredProtectionContexts.every((context) =>
    branchProtection.requiredStatusChecks.includes(context),
  );
const allEvidencePresent = evidenceStates.every((item) => item.externalEvidencePresent);

console.log(JSON.stringify({
  ok: true,
  readyForRoboticsHostedHardwareClosure:
    workflowsReady &&
    repairPrReady &&
    gpuVariableEnabled &&
    gpuRunnerReady &&
    branchProtectionReady &&
    allEvidencePresent,
  checkedAt: new Date().toISOString(),
  safetyRule:
    "This verifier prints only public run/job/PR URLs, repo variable names, runner counts/label requirements, branch-protection booleans, review-state summaries, and evidence validation summaries; it does not print secret values, runner tokens, or evidence directory paths.",
  evidenceDirectory: {
    envName: config.evidence_dir_env,
    configured: Boolean(evidenceDir),
    source: evidenceDirSource,
    valuePrinted: false,
    acceptedLayouts: [
      "$AURAONE_ROBOTICS_HARDWARE_EVIDENCE_DIR/<evidence-key>.<md|json|txt|png|pdf>",
      "docs/evidence/product/robotics-hosted-hardware/<evidence-key>.<md|json|txt|png|pdf>",
    ],
  },
  repository: config.repository,
  setupDocuments,
  workflows: workflowStates,
  repairPr: repairPr
    ? {
        ...repairPr,
        requiredJobStates: repairPrRequiredJobStates,
        requiredRepairCheckStates: repairPrRequiredRepairCheckStates,
        ready: repairPrReady,
      }
    : null,
  variables: {
    available: variables.available,
    error: variables.error,
    gpuEnablementVariable: ciWorkflow.gpu_enablement_variable,
    gpuEnablementConfiguredTrue: gpuVariableEnabled,
  },
  runners,
  branchProtection: {
    available: branchProtection.available,
    error: branchProtection.error,
    requiredReviewCount: branchProtection.requiredReviewCount,
    requiresCodeOwnerReviews: branchProtection.requiresCodeOwnerReviews,
    requiredStatusChecks: branchProtection.requiredStatusChecks,
    requiredContextsExpected: requiredProtectionContexts,
  },
  evidence: evidenceStates,
  blockers,
}, null, 2));
