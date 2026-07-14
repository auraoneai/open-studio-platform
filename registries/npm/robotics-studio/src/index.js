export const packageName = "@auraone/robotics-studio";
export const packageVersion = "0.2.1";

export const release = Object.freeze({
  product: "Robotics Studio Open",
  version: "0.2.0",
  browserUrl: "https://robotics-studio.auraone.ai",
  productUrl: "https://auraone.ai/open/robotics-studio",
  sourceUrl: "https://github.com/auraoneai/robotics-studio-open",
  releaseUrl:
    "https://github.com/auraoneai/robotics-studio-open/releases/tag/v0.2.0",
  macos: Object.freeze({
    architecture: "arm64",
    artifact: "Robotics.Studio.Open_0.2.0_aarch64.dmg",
    sha256: "b6d08f308c7806df2d67dc34d6d12e9df9f33e135afd61ced1cbb16653f4cf05",
  }),
});

/**
 * Validate the JSON dataset manifest boundary consumed by Robotics Studio Open.
 *
 * @param {unknown} value
 * @returns {{ valid: boolean, issues: Array<{ path: string, code: string, message: string }> }}
 */
export function validateDatasetManifest(value) {
  const issues = [];

  if (!isRecord(value)) {
    return {
      valid: false,
      issues: [
        {
          path: "$",
          code: "manifest.type",
          message: "Dataset manifest must be a JSON object.",
        },
      ],
    };
  }

  if (
    "schema" in value &&
    value.schema !== "auraone.robotics.dataset-manifest.v1"
  ) {
    issues.push({
      path: "$.schema",
      code: "manifest.schema",
      message:
        'Manifest schema must be "auraone.robotics.dataset-manifest.v1" when provided.',
    });
  }

  requireString(value, "name", "$.name", issues);
  requireString(value, "format", "$.format", issues);

  if ("provenance" in value && !isNonEmptyString(value.provenance)) {
    issues.push({
      path: "$.provenance",
      code: "manifest.provenance",
      message: "Manifest provenance must be a non-empty string when provided.",
    });
  }

  if ("meta" in value && !isRecord(value.meta)) {
    issues.push({
      path: "$.meta",
      code: "manifest.meta",
      message: "Manifest meta must be a JSON object when provided.",
    });
  }

  if (!Array.isArray(value.episodes)) {
    issues.push({
      path: "$.episodes",
      code: "manifest.episodes",
      message: "Manifest episodes must be an array.",
    });
  } else {
    const ids = new Set();
    for (const [index, episode] of value.episodes.entries()) {
      const path = `$.episodes[${index}]`;
      if (!isRecord(episode)) {
        issues.push({
          path,
          code: "episode.type",
          message: "Episode must be a JSON object.",
        });
        continue;
      }

      const id = firstNonEmptyString(episode.id, episode.episode_id);
      if (!id) {
        issues.push({
          path: `${path}.id`,
          code: "episode.id",
          message: "Episode requires a non-empty id or episode_id.",
        });
      } else if (ids.has(id)) {
        issues.push({
          path: `${path}.id`,
          code: "episode.id.duplicate",
          message: `Duplicate episode id "${id}".`,
        });
      } else {
        ids.add(id);
      }

      validatePositiveNumber(
        episode.duration_s ?? episode.duration,
        `${path}.duration_s`,
        "episode.duration",
        issues,
      );
      validatePositiveNumber(
        episode.frame_rate_hz ?? episode.frameRateHz ?? episode.fps,
        `${path}.frame_rate_hz`,
        "episode.frame-rate",
        issues,
      );

      if ("sensors" in episode && !Array.isArray(episode.sensors)) {
        issues.push({
          path: `${path}.sensors`,
          code: "episode.sensors",
          message: "Episode sensors must be an array when provided.",
        });
      }
    }
  }

  return { valid: issues.length === 0, issues };
}

function validatePositiveNumber(value, path, code, issues) {
  if (
    value !== undefined &&
    (typeof value !== "number" || !Number.isFinite(value) || value <= 0)
  ) {
    issues.push({
      path,
      code,
      message: "Value must be a finite number greater than zero when provided.",
    });
  }
}

function requireString(value, field, path, issues) {
  if (!isNonEmptyString(value[field])) {
    issues.push({
      path,
      code: "manifest.string",
      message: `"${field}" must be a non-empty string.`,
    });
  }
}

function firstNonEmptyString(...values) {
  return values.find(isNonEmptyString);
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}
