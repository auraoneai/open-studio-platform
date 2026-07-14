#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const platformRoot = path.resolve(scriptDir, "..");
const repoRoot = path.resolve(platformRoot, "../..");
const repository = process.env.AURAONE_ROOT_REPOSITORY ?? "gchahal1982/AuraFoundry";
const hostedWorkflowName =
  process.env.AURAONE_ROOT_HOSTED_WORKFLOW_NAME ?? "Open Studio Platform Hosted Smokes";
const budgetAnnotationPattern = /Actions budget is preventing further use|billing\/spending-limit|spending limit/i;
const rootHostedWorkflowPath = ".github/workflows/open-studio-platform-hosted-smokes.yml";
const templateWorkflowPath =
  "opensource/open-studio-platform/.github-templates/workflows/platform-code-verification.yml";
const runnerOverrideInputs = [
  "macos_runs_on",
  "windows_runs_on",
  "linux_runs_on",
  "macos_gpu_runs_on",
  "windows_gpu_runs_on",
  "linux_gpu_runs_on",
];
const runnerOverrideVars = [
  "AURAONE_PLATFORM_MACOS_RUNS_ON",
  "AURAONE_PLATFORM_WINDOWS_RUNS_ON",
  "AURAONE_PLATFORM_LINUX_RUNS_ON",
  "AURAONE_PLATFORM_MACOS_GPU_RUNS_ON",
  "AURAONE_PLATFORM_WINDOWS_GPU_RUNS_ON",
  "AURAONE_PLATFORM_LINUX_GPU_RUNS_ON",
];

function commandAvailable(command) {
  return spawnSync("which", [command], { stdio: "ignore" }).status === 0;
}

function ghJson(args) {
  if (!commandAvailable("gh")) {
    return {
      available: false,
      data: null,
      error: "gh command is not installed",
    };
  }
  const result = spawnSync("gh", args, {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 16,
  });
  if (result.status !== 0) {
    return {
      available: false,
      data: null,
      error: (result.stderr || result.stdout).trim() || `gh exited ${result.status}`,
    };
  }
  try {
    return {
      available: true,
      data: JSON.parse(result.stdout),
      error: null,
    };
  } catch (error) {
    return {
      available: false,
      data: null,
      error: `could not parse gh JSON output: ${error.message}`,
    };
  }
}

function loadLatestHostedRun() {
  const result = ghJson([
    "run",
    "list",
    "--repo",
    repository,
    "--workflow",
    hostedWorkflowName,
    "--limit",
    "1",
    "--json",
    "databaseId,workflowName,headSha,status,conclusion,event,url,createdAt,updatedAt,displayTitle",
  ]);
  if (!result.available) {
    return {
      available: false,
      error: result.error,
      run: null,
    };
  }
  return {
    available: true,
    error: null,
    run: result.data[0] ?? null,
  };
}

function loadRunJobs(runId) {
  const result = ghJson([
    "run",
    "view",
    String(runId),
    "--repo",
    repository,
    "--json",
    "databaseId,workflowName,status,conclusion,jobs,url,headSha,event",
  ]);
  if (!result.available) {
    return {
      available: false,
      error: result.error,
      run: null,
      jobs: [],
    };
  }
  return {
    available: true,
    error: null,
    run: {
      databaseId: result.data.databaseId,
      workflowName: result.data.workflowName,
      status: result.data.status,
      conclusion: result.data.conclusion,
      url: result.data.url,
      headSha: result.data.headSha,
      event: result.data.event,
    },
    jobs: result.data.jobs ?? [],
  };
}

function loadCheckAnnotations(checkRunId) {
  const result = ghJson(["api", `repos/${repository}/check-runs/${checkRunId}/annotations`]);
  if (!result.available) {
    return {
      available: false,
      error: result.error,
      annotations: [],
    };
  }
  return {
    available: true,
    error: null,
    annotations: result.data,
  };
}

function loadActionsPermissions() {
  const permissions = ghJson(["api", `repos/${repository}/actions/permissions`]);
  const workflowPermissions = ghJson(["api", `repos/${repository}/actions/permissions/workflow`]);
  return {
    repositoryActions: {
      available: permissions.available,
      error: permissions.error,
      enabled: permissions.data?.enabled ?? null,
      allowedActions: permissions.data?.allowed_actions ?? null,
    },
    workflow: {
      available: workflowPermissions.available,
      error: workflowPermissions.error,
      defaultWorkflowPermissions: workflowPermissions.data?.default_workflow_permissions ?? null,
      canApprovePullRequestReviews: workflowPermissions.data?.can_approve_pull_request_reviews ?? null,
    },
  };
}

function readRepoFile(relativePath) {
  try {
    return {
      available: true,
      path: relativePath,
      text: readFileSync(path.join(repoRoot, relativePath), "utf8"),
      error: null,
    };
  } catch (error) {
    return {
      available: false,
      path: relativePath,
      text: "",
      error: error.message,
    };
  }
}

function inspectRunnerOverrideWorkflow(relativePath) {
  const file = readRepoFile(relativePath);
  const text = file.text;
  const missingInputs = runnerOverrideInputs.filter((input) => !text.includes(`${input}:`));
  const missingVars = runnerOverrideVars.filter((variable) => !text.includes(variable));
  return {
    path: relativePath,
    available: file.available,
    error: file.error,
    supportsDynamicRunsOn: /\bruns-on:\s*\$\{\{\s*fromJSON\(/.test(text),
    supportsManualRunnerInputs: missingInputs.length === 0,
    supportsRepositoryRunnerVars: missingVars.length === 0,
    runnerOverrideInputs,
    repositoryVariables: runnerOverrideVars,
    missingInputs,
    missingRepositoryVariables: missingVars,
  };
}

const latestRun = loadLatestHostedRun();
const runJobs = latestRun.run ? loadRunJobs(latestRun.run.databaseId) : null;
const permissions = loadActionsPermissions();
const runnerWorkaround = {
  rootWorkflow: inspectRunnerOverrideWorkflow(rootHostedWorkflowPath),
  reusableTemplate: inspectRunnerOverrideWorkflow(templateWorkflowPath),
  configurationRule:
    "Set runner override values as JSON arrays. Example: AURAONE_PLATFORM_LINUX_RUNS_ON=[\"self-hosted\",\"Linux\",\"auraone-platform\"]. GPU-specific variables override the general OS variable for GPU fixture jobs.",
};

const jobs = [];
if (runJobs?.jobs) {
  for (const job of runJobs.jobs) {
    const annotationState = loadCheckAnnotations(job.databaseId);
    const annotations = annotationState.annotations.map((annotation) => ({
      level: annotation.annotation_level ?? null,
      path: annotation.path ?? null,
      message: annotation.message ?? "",
    }));
    jobs.push({
      id: job.databaseId,
      name: job.name,
      status: job.status,
      conclusion: job.conclusion,
      url: job.url,
      startedAt: job.startedAt ?? null,
      completedAt: job.completedAt ?? null,
      stepsCount: Array.isArray(job.steps) ? job.steps.length : null,
      failedBeforeRunnerSteps: Array.isArray(job.steps) && job.steps.length === 0 && job.conclusion === "failure",
      annotationsAvailable: annotationState.available,
      annotationError: annotationState.error,
      budgetAnnotationPresent: annotations.some((annotation) =>
        budgetAnnotationPattern.test(annotation.message),
      ),
      annotations,
    });
  }
}

const blockers = [];
if (!latestRun.available) {
  blockers.push(`${repository}: latest hosted workflow run could not be listed: ${latestRun.error}`);
} else if (!latestRun.run) {
  blockers.push(`${repository}: no runs found for workflow '${hostedWorkflowName}'`);
}

if (latestRun.run && !runJobs?.available) {
  blockers.push(`${repository}: latest hosted workflow run could not be inspected: ${runJobs?.error}`);
}

if (runJobs?.available) {
  if (runJobs.run.conclusion !== "success") {
    blockers.push(
      `${hostedWorkflowName}: latest run ${runJobs.run.url} concluded ${runJobs.run.conclusion}`,
    );
  }
  const failedBeforeSteps = jobs.filter((job) => job.failedBeforeRunnerSteps);
  if (failedBeforeSteps.length > 0) {
    blockers.push(
      `${hostedWorkflowName}: ${failedBeforeSteps.length} job(s) failed before runner steps`,
    );
  }
  const budgetBlocked = jobs.filter((job) => job.budgetAnnotationPresent);
  if (budgetBlocked.length > 0) {
    blockers.push(
      `${hostedWorkflowName}: ${budgetBlocked.length} job(s) report the GitHub Actions budget annotation`,
    );
  }
}

if (!permissions.repositoryActions.available) {
  blockers.push(`${repository}: repository Actions permissions could not be inspected: ${permissions.repositoryActions.error}`);
} else if (!permissions.repositoryActions.enabled) {
  blockers.push(`${repository}: repository Actions are disabled`);
} else if (permissions.repositoryActions.allowedActions !== "all") {
  blockers.push(`${repository}: repository Actions are not allowed for all actions`);
}

if (!runnerWorkaround.rootWorkflow.supportsDynamicRunsOn) {
  blockers.push(`${rootHostedWorkflowPath}: hosted-smoke jobs do not support dynamic runner labels`);
}

if (!runnerWorkaround.rootWorkflow.supportsManualRunnerInputs) {
  blockers.push(`${rootHostedWorkflowPath}: workflow_dispatch runner override inputs are incomplete`);
}

if (!runnerWorkaround.rootWorkflow.supportsRepositoryRunnerVars) {
  blockers.push(`${rootHostedWorkflowPath}: repository variable runner overrides are incomplete`);
}

console.log(JSON.stringify({
  ok: true,
  readyForRootHostedActionsClosure:
    blockers.length === 0 &&
    runJobs?.run?.conclusion === "success" &&
    jobs.length > 0 &&
    jobs.every((job) => job.conclusion === "success" && !job.failedBeforeRunnerSteps),
  checkedAt: new Date().toISOString(),
  safetyRule:
    "This verifier reads GitHub Actions run, job, annotation, and permission metadata only; it does not rerun workflows, mutate repository settings, or print secrets.",
  repository,
  hostedWorkflowName,
  latestRun: latestRun.run
    ? {
        id: latestRun.run.databaseId,
        displayTitle: latestRun.run.displayTitle,
        workflowName: latestRun.run.workflowName,
        event: latestRun.run.event,
        headSha: latestRun.run.headSha,
        status: latestRun.run.status,
        conclusion: latestRun.run.conclusion,
        url: latestRun.run.url,
        createdAt: latestRun.run.createdAt,
        updatedAt: latestRun.run.updatedAt,
      }
    : null,
  actionsPermissions: permissions,
  runnerWorkaround,
  jobs,
  blockers,
}, null, 2));
