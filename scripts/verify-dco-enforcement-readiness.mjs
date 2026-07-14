#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const platformRoot = path.resolve(scriptDir, "..");
const root = path.resolve(platformRoot, "../..");

const requiredDcoCheck = "DCO / dco";
const requiredReviewCount = 2;

const repositories = [
  {
    id: "platform-root",
    name: "AuraOne Platform/root repository",
    repository: "gchahal1982/AuraFoundry",
    publicReleaseBlocking: false,
    requireDcoWorkflowOnMain: false,
    trackedPullRequests: [],
  },
  {
    id: "rubric-studio-open",
    name: "Rubric Studio Open",
    repository: "auraoneai/rubric-studio-open",
    publicReleaseBlocking: true,
    requireDcoWorkflowOnMain: true,
    trackedPullRequests: [],
  },
  {
    id: "robotics-studio-open",
    name: "Robotics Studio Open",
    repository: "auraoneai/robotics-studio-open",
    publicReleaseBlocking: true,
    requireDcoWorkflowOnMain: true,
    trackedPullRequests: [33, 34, 35],
  },
  {
    id: "agent-studio-open",
    name: "Agent Studio Open",
    repository: "auraoneai/agent-studio-open",
    publicReleaseBlocking: true,
    requireDcoWorkflowOnMain: true,
    trackedPullRequests: [8, 9, 10, 11],
  },
];

function commandAvailable(command) {
  return spawnSync("which", [command], { stdio: "ignore" }).status === 0;
}

function runGhJson(args) {
  if (!commandAvailable("gh")) {
    return {
      available: false,
      data: null,
      error: "gh command is not installed",
    };
  }
  const result = spawnSync("gh", args, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 8,
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

function branchProtectionState(repository) {
  const result = runGhJson(["api", `repos/${repository}/branches/main/protection`]);
  if (!result.available) {
    return {
      accessible: false,
      error: result.error,
      contexts: [],
      strict: false,
      requiredApprovingReviewCount: 0,
      requireCodeOwnerReviews: false,
      enforceAdmins: false,
      requireConversationResolution: false,
      requiredDcoCheckPresent: false,
      twoApprovalsRequired: false,
      ready: false,
    };
  }

  const data = result.data;
  const contexts = data.required_status_checks?.contexts ?? [];
  const reviewRule = data.required_pull_request_reviews ?? {};
  const requiredApprovingReviewCount =
    Number(reviewRule.required_approving_review_count ?? 0) || 0;
  const requireCodeOwnerReviews = Boolean(reviewRule.require_code_owner_reviews);
  const strict = Boolean(data.required_status_checks?.strict);
  const requiredDcoCheckPresent = contexts.includes(requiredDcoCheck);
  const twoApprovalsRequired = requiredApprovingReviewCount >= requiredReviewCount;

  return {
    accessible: true,
    error: null,
    contexts,
    strict,
    requiredApprovingReviewCount,
    requireCodeOwnerReviews,
    enforceAdmins: Boolean(data.enforce_admins?.enabled),
    requireConversationResolution: Boolean(data.required_conversation_resolution?.enabled),
    requiredDcoCheckPresent,
    twoApprovalsRequired,
    ready:
      requiredDcoCheckPresent &&
      strict &&
      twoApprovalsRequired &&
      requireCodeOwnerReviews,
  };
}

function dcoWorkflowState(repository) {
  const result = runGhJson([
    "api",
    `repos/${repository}/contents/.github/workflows/dco.yml`,
  ]);
  if (!result.available) {
    return {
      present: false,
      path: ".github/workflows/dco.yml",
      sha: null,
      url: null,
      error: result.error,
    };
  }
  return {
    present: true,
    path: result.data.path,
    sha: result.data.sha,
    url: result.data.html_url,
    error: null,
  };
}

function statusCheckName(check) {
  return check.name ?? check.context ?? null;
}

function statusCheckPassed(check) {
  if (!check) return false;
  if (check.__typename === "StatusContext") return check.state === "SUCCESS";
  return check.status === "COMPLETED" && check.conclusion === "SUCCESS";
}

function pickStatusCheck(statusCheckRollup, expectedName) {
  const check = (statusCheckRollup ?? []).find(
    (candidate) => statusCheckName(candidate) === expectedName,
  );
  if (!check) {
    return {
      present: false,
      passed: false,
      name: expectedName,
      status: null,
      conclusion: null,
      detailsUrl: null,
    };
  }
  return {
    present: true,
    passed: statusCheckPassed(check),
    name: statusCheckName(check),
    status: check.status ?? check.state ?? null,
    conclusion: check.conclusion ?? check.state ?? null,
    detailsUrl: check.detailsUrl ?? check.targetUrl ?? null,
  };
}

function reviewRequestLabel(request) {
  if (request.slug) return request.slug;
  if (request.login) return request.login;
  if (request.name) return request.name;
  return request.__typename ?? "unknown";
}

function pullRequestState(repository, number) {
  const result = runGhJson([
    "pr",
    "view",
    String(number),
    "--repo",
    repository,
    "--json",
    [
      "autoMergeRequest",
      "headRefOid",
      "mergeStateStatus",
      "number",
      "reviewDecision",
      "reviewRequests",
      "state",
      "statusCheckRollup",
      "title",
      "url",
    ].join(","),
  ]);
  if (!result.available) {
    return {
      accessible: false,
      number,
      error: result.error,
      dcoCheck: pickStatusCheck([], requiredDcoCheck),
      readyForDcoClosure: false,
      readyForReviewClosure: false,
    };
  }

  const data = result.data;
  const dcoCheck = pickStatusCheck(data.statusCheckRollup, requiredDcoCheck);
  const merged = data.state === "MERGED";
  const approved = data.reviewDecision === "APPROVED";
  const closedWithoutMerge = data.state === "CLOSED";
  const readyForDcoClosure = merged || dcoCheck.passed;
  const readyForReviewClosure = merged || approved;

  return {
    accessible: true,
    error: null,
    number: data.number,
    title: data.title,
    url: data.url,
    state: data.state,
    headRefOid: data.headRefOid,
    mergeStateStatus: data.mergeStateStatus,
    reviewDecision: data.reviewDecision,
    reviewRequests: (data.reviewRequests ?? []).map(reviewRequestLabel),
    autoMergeEnabled: Boolean(data.autoMergeRequest),
    dcoCheck,
    closedWithoutMerge,
    readyForDcoClosure,
    readyForReviewClosure,
  };
}

function repositoryState(config) {
  const branchProtection = branchProtectionState(config.repository);
  const dcoWorkflow = dcoWorkflowState(config.repository);
  const pullRequests = config.trackedPullRequests.map((number) =>
    pullRequestState(config.repository, number),
  );
  const workflowReady = !config.requireDcoWorkflowOnMain || dcoWorkflow.present;
  const publicPrsReady = pullRequests.every(
    (pullRequest) =>
      pullRequest.readyForDcoClosure &&
      pullRequest.readyForReviewClosure &&
      !pullRequest.closedWithoutMerge,
  );

  return {
    id: config.id,
    name: config.name,
    repository: config.repository,
    publicReleaseBlocking: config.publicReleaseBlocking,
    requiredDcoCheck,
    requiredReviewCount,
    requireDcoWorkflowOnMain: config.requireDcoWorkflowOnMain,
    branchProtection,
    dcoWorkflow,
    pullRequests,
    readyForDcoEnforcementClosure:
      branchProtection.ready && workflowReady && publicPrsReady,
  };
}

const results = repositories.map(repositoryState);
const publicReleaseRepositories = results.filter((repository) => repository.publicReleaseBlocking);
const readyForPublicReleaseDcoClosure = publicReleaseRepositories.every(
  (repository) => repository.readyForDcoEnforcementClosure,
);
const blockers = [];

for (const repository of results) {
  if (!repository.branchProtection.accessible) {
    blockers.push(
      `${repository.repository}: branch protection could not be verified: ${repository.branchProtection.error}`,
    );
  } else {
    if (!repository.branchProtection.requiredDcoCheckPresent) {
      blockers.push(`${repository.repository}: branch protection does not require ${requiredDcoCheck}`);
    }
    if (!repository.branchProtection.strict) {
      blockers.push(`${repository.repository}: branch protection does not require strict status checks`);
    }
    if (!repository.branchProtection.twoApprovalsRequired) {
      blockers.push(
        `${repository.repository}: branch protection does not require ${requiredReviewCount} approving reviews`,
      );
    }
    if (!repository.branchProtection.requireCodeOwnerReviews) {
      blockers.push(`${repository.repository}: branch protection does not require CODEOWNERS review`);
    }
  }

  if (repository.requireDcoWorkflowOnMain && !repository.dcoWorkflow.present) {
    blockers.push(
      `${repository.repository}: .github/workflows/dco.yml is not present on main: ${repository.dcoWorkflow.error}`,
    );
  }

  for (const pullRequest of repository.pullRequests) {
    if (!pullRequest.accessible) {
      blockers.push(
        `${repository.repository}#${pullRequest.number}: PR state could not be verified: ${pullRequest.error}`,
      );
      continue;
    }
    if (pullRequest.closedWithoutMerge) {
      blockers.push(`${repository.repository}#${pullRequest.number}: PR closed without merge`);
      continue;
    }
    if (!pullRequest.readyForDcoClosure) {
      blockers.push(`${repository.repository}#${pullRequest.number}: ${requiredDcoCheck} has not passed`);
    }
    if (!pullRequest.readyForReviewClosure) {
      blockers.push(
        `${repository.repository}#${pullRequest.number}: required human/CODEOWNERS reviews are still pending`,
      );
    }
  }
}

const output = {
  ok: true,
  readyForDcoEnforcementClosure: blockers.length === 0,
  readyForPublicReleaseDcoClosure,
  checkedAt: new Date().toISOString(),
  safetyRule:
    "This verifier reads GitHub branch protection, workflow-file, and PR check metadata only; it does not mutate repositories, secrets, reviews, merges, or branch protection.",
  repositories: results,
  blockers,
};

console.log(JSON.stringify(output, null, 2));
