---
id: quickstart
title: Quickstart
---

# Quickstart

This path walks through the same loop shown in the Rubric Studio Open app:
author, preview, calibrate, diff, and export.

## 1. Open the sample project

Launch the browser IDE or desktop app and open `Helpful Response Evaluation`.
The sample project contains 12 criteria, 3 sample model outputs, local mock
judges, and calibration fixtures.

## 2. Review a criterion

Select:

```text
Evidence quality / cites-uncertainty.toml
```

Confirm the criterion has a clear description, examples, evidence requirements,
weight, and status. The inline validation panel should show schema and style
checks before you promote the criterion.

## 3. Score a sample

Use the local mock judge first. That keeps the first run deterministic and avoids
sending content or keys to a model provider.

```bash
rubric score --judge mock --sample sample-001 --out runs/first-score
```

Expected shape:

```text
rubric-spec: valid
samples: 3
criteria: 12
readiness: 100%
warnings: 0
```

## 4. Calibrate against gold labels

Open the Calibration tab and load the gold JSONL fixture. Review agreement
metrics for criteria with low Cohen kappa or disagreement clusters. Criteria that
need work should stay in draft until examples and wording are tightened.

## 5. Inspect the semantic diff

Open the Diff tab before committing a rubric change. The score overlay should
show which criteria changed, how held-out samples moved, and whether the change
is cosmetic or behavior-shaping.

## 6. Export artifacts

Export the portable files a reviewer can audit later:

```bash
rubric export manifest --run runs/first-score --out exports/eval-run-manifest.json
rubric export judge-card --run runs/first-score --out exports/judge-card.md
```

Use AuraOne intake export only when you intentionally want to hand the project to
Rubric Studio Cloud or AuraOne reviewers.
