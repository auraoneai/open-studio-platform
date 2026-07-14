#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const platformRoot = path.resolve(scriptDir, "..");
const root = path.resolve(platformRoot, "../..");

const expectedRepositories = [
  {
    id: "rubric-studio-open",
    repository: "auraoneai/rubric-studio-open",
    issues: [
      {
        number: 42,
        expectedState: "OPEN",
        requiredLabels: ["release", "blocker", "signing", "windows", "winget"],
        scope: "Windows EV signing, package identity, signed MSI, and winget",
      },
      {
        number: 43,
        expectedState: "CLOSED",
        requiredLabels: ["release", "blocker", "signing", "linux"],
        scope: "Linux artifacts, signatures, package metadata, and clean install",
      },
      {
        number: 44,
        expectedState: "CLOSED",
        requiredLabels: ["release", "blocker", "observability"],
        scope: "Sentry crash reporting and uptime evidence",
      },
      {
        number: 45,
        expectedState: "OPEN",
        requiredLabels: ["release", "blocker", "signing", "ci"],
        scope: "Hosted release workflow and signing custody",
      },
      {
        number: 46,
        expectedState: "OPEN",
        requiredLabels: ["release", "blocker", "launch"],
        scope: "Launch publication, outreach, community, and sales/support",
      },
      {
        number: 47,
        expectedState: "OPEN",
        requiredLabels: ["release", "blocker", "legal", "security"],
        scope: "External security, legal, trademark, and IP approvals",
      },
    ],
  },
  {
    id: "agent-studio-open",
    repository: "auraoneai/agent-studio-open",
    issues: [
      {
        number: 2,
        expectedState: "OPEN",
        requiredLabels: ["release", "blocker", "signing", "windows", "winget"],
        scope: "Windows EV signing, package identity, signed MSI, and winget",
      },
      {
        number: 3,
        expectedState: "CLOSED",
        requiredLabels: ["release", "blocker", "signing", "linux"],
        scope: "Linux artifacts, signatures, package metadata, and clean install",
      },
      {
        number: 4,
        expectedState: "CLOSED",
        requiredLabels: ["release", "blocker", "observability"],
        scope: "Sentry project, DSN, synthetic upload, and dashboard evidence",
      },
      {
        number: 5,
        expectedState: "OPEN",
        requiredLabels: ["release", "blocker", "signing", "ci"],
        scope: "Hosted release workflow and signing custody",
      },
      {
        number: 6,
        expectedState: "OPEN",
        requiredLabels: ["release", "blocker", "launch"],
        scope: "Launch scheduling, dogfood, outreach, and marketplace evidence",
      },
      {
        number: 7,
        expectedState: "OPEN",
        requiredLabels: ["release", "blocker", "linux", "legal", "security"],
        scope: "External security, legal, provider terms, and sandbox evidence",
      },
    ],
  },
  {
    id: "robotics-studio-open",
    repository: "auraoneai/robotics-studio-open",
    issues: [
      { number: 10, expectedState: "OPEN", requiredLabels: ["release", "blocker", "legal"], scope: "MIT license legal review" },
      { number: 11, expectedState: "OPEN", requiredLabels: ["release", "blocker", "legal"], scope: "Robotics Studio trademark check" },
      { number: 12, expectedState: "OPEN", requiredLabels: ["release", "blocker", "legal"], scope: "Sample dataset IP review" },
      { number: 13, expectedState: "OPEN", requiredLabels: ["release", "blocker", "security"], scope: "External security review and fuzz campaign" },
      { number: 14, expectedState: "OPEN", requiredLabels: ["release", "blocker", "signing"], scope: "Hosted signing custody and Windows EV signing" },
      { number: 15, expectedState: "OPEN", requiredLabels: ["release", "blocker", "legal"], scope: "Telemetry policy legal approval" },
      { number: 16, expectedState: "OPEN", requiredLabels: ["release", "blocker", "legal"], scope: "AuraOne intake export terms" },
      { number: 17, expectedState: "OPEN", requiredLabels: ["release", "blocker", "performance"], scope: "Target hardware performance baselines" },
      { number: 18, expectedState: "OPEN", requiredLabels: ["release", "blocker", "ci"], scope: "Fourteen-day green CI" },
      { number: 19, expectedState: "OPEN", requiredLabels: ["release", "blocker", "telemetry"], scope: "Crash-free beta session evidence" },
      { number: 20, expectedState: "OPEN", requiredLabels: ["release", "blocker", "ci"], scope: "CI matrix plus GPU runner green" },
      { number: 21, expectedState: "OPEN", requiredLabels: ["release", "blocker", "launch"], scope: "HN post scheduled" },
      { number: 22, expectedState: "OPEN", requiredLabels: ["release", "blocker", "launch"], scope: "X thread queued" },
      { number: 23, expectedState: "OPEN", requiredLabels: ["release", "blocker", "launch"], scope: "Demo video live" },
      { number: 24, expectedState: "OPEN", requiredLabels: ["release", "blocker", "launch"], scope: "Newsletter sent" },
      { number: 25, expectedState: "OPEN", requiredLabels: ["release", "blocker", "launch"], scope: "Design partner quotes" },
      { number: 26, expectedState: "OPEN", requiredLabels: ["release", "blocker", "launch"], scope: "Podcast outreach" },
      { number: 27, expectedState: "OPEN", requiredLabels: ["release", "blocker", "partner"], scope: "Three named-account design partners" },
      { number: 28, expectedState: "OPEN", requiredLabels: ["release", "blocker", "community"], scope: "Community channel created" },
      { number: 29, expectedState: "CLOSED", requiredLabels: ["release", "blocker", "launch"], scope: "GitHub repo labels and public issues" },
      { number: 30, expectedState: "CLOSED", requiredLabels: ["release", "blocker", "telemetry"], scope: "Telemetry dashboard ready" },
      { number: 31, expectedState: "OPEN", requiredLabels: ["release", "blocker", "launch"], scope: "First-two-weeks on-call rotation" },
      { number: 32, expectedState: "OPEN", requiredLabels: ["release", "blocker", "signing"], scope: "Windows package identity registered" },
    ],
  },
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

function loadIssues(repository) {
  const result = ghJson([
    "issue",
    "list",
    "--repo",
    repository,
    "--state",
    "all",
    "--limit",
    "100",
    "--json",
    "number,title,state,labels,url,closedAt",
  ]);
  if (!result.available) {
    return {
      available: false,
      error: result.error,
      byNumber: new Map(),
    };
  }
  return {
    available: true,
    error: null,
    byNumber: new Map(result.data.map((issue) => [issue.number, issue])),
  };
}

function labelNames(issue) {
  return new Set((issue.labels ?? []).map((label) => label.name));
}

function issueState(repository, expectation, liveIssue) {
  if (!liveIssue) {
    return {
      number: expectation.number,
      scope: expectation.scope,
      expectedState: expectation.expectedState,
      present: false,
      stateMatches: false,
      labelsMatch: false,
      missingLabels: expectation.requiredLabels,
      state: null,
      title: null,
      url: null,
      closedAt: null,
    };
  }
  const labels = labelNames(liveIssue);
  const missingLabels = expectation.requiredLabels.filter((label) => !labels.has(label));
  return {
    number: expectation.number,
    scope: expectation.scope,
    expectedState: expectation.expectedState,
    present: true,
    stateMatches: liveIssue.state === expectation.expectedState,
    labelsMatch: missingLabels.length === 0,
    missingLabels,
    state: liveIssue.state,
    title: liveIssue.title,
    url: liveIssue.url ?? `https://github.com/${repository}/issues/${expectation.number}`,
    closedAt: liveIssue.closedAt ?? null,
  };
}

const repositories = expectedRepositories.map((repository) => {
  const liveIssues = loadIssues(repository.repository);
  const issues = repository.issues.map((expectation) =>
    issueState(repository.repository, expectation, liveIssues.byNumber.get(expectation.number)),
  );
  return {
    id: repository.id,
    repository: repository.repository,
    available: liveIssues.available,
    error: liveIssues.error,
    expectedIssueCount: repository.issues.length,
    openExpectedCount: repository.issues.filter((issue) => issue.expectedState === "OPEN").length,
    closedExpectedCount: repository.issues.filter((issue) => issue.expectedState === "CLOSED").length,
    issues,
    ready: liveIssues.available && issues.every((issue) => issue.present && issue.stateMatches && issue.labelsMatch),
  };
});

const blockers = [];
for (const repository of repositories) {
  if (!repository.available) {
    blockers.push(`${repository.repository}: public blocker issues could not be listed: ${repository.error}`);
    continue;
  }
  for (const issue of repository.issues) {
    if (!issue.present) {
      blockers.push(`${repository.repository}#${issue.number}: expected public blocker issue is missing`);
      continue;
    }
    if (!issue.stateMatches) {
      blockers.push(
        `${repository.repository}#${issue.number}: expected ${issue.expectedState}, found ${issue.state}`,
      );
    }
    if (!issue.labelsMatch) {
      blockers.push(
        `${repository.repository}#${issue.number}: missing required labels ${issue.missingLabels.join(", ")}`,
      );
    }
  }
}

const output = {
  ok: true,
  readyForPublicBlockerRoutingClosure: blockers.length === 0,
  checkedAt: new Date().toISOString(),
  safetyRule:
    "This verifier reads public GitHub issue numbers, states, labels, and URLs only; it does not create, edit, close, reopen, or comment on issues.",
  repositories,
  blockers,
};

console.log(JSON.stringify(output, null, 2));
