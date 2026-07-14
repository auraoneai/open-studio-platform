# @auraone/robotics-studio

Robot episode dataset manifest validation and release metadata companion for
[Robotics Studio Open](https://auraone.ai/open/robotics-studio), AuraOne's
local-first visual cockpit for reviewing declared robot episode evidence and
producing checksummed review artifacts.

![Robotics Studio Open synchronized episode review with the synthetic sensor scene, timeline, health selectors, annotations, and decision controls](https://www.auraone.ai/open/robotics-studio/screenshot-overview.webp)

## Install

```bash
npm install @auraone/robotics-studio
```

This dependency-free package validates the JSON dataset-manifest boundary and
exposes current browser, source, and verified macOS release metadata. It does
not bundle the React/Tauri visual application, robot media, native adapters, or
robotics engines.

## Validate A Dataset Manifest

```js
import { validateDatasetManifest } from "@auraone/robotics-studio";

const result = validateDatasetManifest({
  schema: "auraone.robotics.dataset-manifest.v1",
  name: "so101_kitchen_v3",
  format: "LeRobot v3 metadata",
  provenance: "local-review",
  episodes: [{
    id: "episode-001",
    task: "pick_apple",
    duration_s: 12.75,
    frame_rate_hz: 30,
    sensors: [],
  }],
});

if (!result.valid) {
  console.error(result.issues);
}
```

The validator checks manifest identity, schema, provenance and metadata shape,
episode arrays, unique episode IDs, optional duration/frame-rate values, and
sensor collection types. The full Studio adds local JSON/JSONL intake,
provenance-aware review, deterministic clustering, sensor QA, VLA mock probes,
annotations, and checksummed evidence export.

## CLI

```bash
npx @auraone/robotics-studio --version
npx @auraone/robotics-studio --json
npx @auraone/robotics-studio validate ./manifest.json
```

Validation exits `0` for a valid manifest, `1` for validation issues, and `2`
for invalid CLI usage or unreadable JSON.

## Full Studio

- Package: `@auraone/robotics-studio@0.2.1`
- Browser: [robotics-studio.auraone.ai](https://robotics-studio.auraone.ai)
- Product: [Robotics Studio Open](https://auraone.ai/open/robotics-studio)
- Source: [auraoneai/robotics-studio-open](https://github.com/auraoneai/robotics-studio-open)
- Signed macOS release:
  [Robotics Studio Open 0.2.0](https://github.com/auraoneai/robotics-studio-open/releases/tag/v0.2.0)

The npm package contains no private font binaries, dataset payloads, robot
media, telemetry uploader, desktop executable, or native runtime. Validation
runs locally.

## License

MIT
