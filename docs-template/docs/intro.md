---
id: intro
title: Overview
slug: /
---

# Rubric Studio Open

Rubric Studio Open is the local-first IDE for criterion-level evaluation rubrics.
Use it when a rubric needs to be a durable artifact: readable on disk, validated
before it ships, calibrated against expert labels, diffed in review, and exported
to the evaluation framework your team already uses.

The default sample project is `Helpful Response Evaluation`. It includes criteria,
sample model outputs, mock judges, calibration data, semantic diff examples, and
export targets so you can walk through the real authoring loop without connecting
an external provider.

## What the docs cover

- Browser IDE, desktop app, and CLI installation paths.
- The project-as-folder model: `rubric.toml`, `criteria/`, `samples/`, `judges/`,
  `calibration/`, and `exports/`.
- The authoring loop: write criteria, preview samples, calibrate judges, inspect
  score-impact diffs, and export manifests.
- Local-first trust controls: BYO keys, opt-in telemetry, crash-report toggles,
  and explicit AuraOne intake packets.

## Product boundary

Rubric Studio Open is free, MIT-licensed, and single-user. It is not a hosted
approval queue or reviewer workforce system. Rubric Studio Cloud starts when the
work becomes multi-author governance, adjudication, approvals, hosted exports, or
managed expert review.
