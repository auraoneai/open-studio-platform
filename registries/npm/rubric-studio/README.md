# @auraone/rubric-studio

JavaScript validation and release metadata companion for
[Rubric Studio Open](https://auraone.ai/open/rubric-studio-open), AuraOne's
local-first visual IDE for authoring, previewing, calibrating, diffing, and
exporting AI evaluation rubrics.

![Rubric Studio Open reviewer preview with criterion-level evidence and deterministic local fixture scores](https://www.auraone.ai/open/rubric-studio-open/screenshots/preview-scoring.webp)

## Install

```bash
npm install @auraone/rubric-studio
```

This package is intentionally small and dependency-free. It does not bundle the
React/Tauri visual application. Use the
[hosted browser editor](https://rubric-studio.auraone.ai), the verified macOS
release, or the source repository for the full Studio interface.

## Validate A Project

```js
import { validateRubricBundle } from "@auraone/rubric-studio";

const result = validateRubricBundle({
  project: {
    id: "helpful-response",
    name: "Helpful response",
    version: "0.2.0",
    branch: "main",
    commentsVisible: true,
    themes: [{ id: "quality" }],
    criteria: [{
      id: "clear",
      label: "Clear",
      themeId: "quality",
      weight: 1,
    }],
    samples: [],
    judges: [],
  },
});

if (!result.valid) {
  console.error(result.issues);
}
```

`validateRubricProject` checks the project object directly.
`validateRubricBundle` accepts either a project object or a browser-exported
`{ project }` bundle. The validator covers the portable interchange boundary;
the full Studio app provides deeper authoring diagnostics, weight guidance,
preview, calibration, semantic diff, and evidence export.

## CLI

```bash
npx @auraone/rubric-studio --version
npx @auraone/rubric-studio --json
npx @auraone/rubric-studio validate ./project-bundle.json
```

Validation prints a machine-readable result and exits with:

- `0` for a valid project
- `1` for validation issues
- `2` for invalid CLI usage or unreadable JSON

## Current Release

- Package: `@auraone/rubric-studio@0.2.1`
- Browser editor: [rubric-studio.auraone.ai](https://rubric-studio.auraone.ai)
- Documentation: [docs.rubricstudio.auraone.ai](https://docs.rubricstudio.auraone.ai)
- Source: [auraoneai/rubric-studio-open](https://github.com/auraoneai/rubric-studio-open)
- Signed macOS Apple silicon release:
  [Rubric Studio Open 0.2.0](https://github.com/auraoneai/rubric-studio-open/releases/tag/v0.2.0)

The npm package contains no private font binaries, provider credentials,
telemetry uploader, hosted account client, or desktop executable. Project
validation runs locally.

## License

MIT
