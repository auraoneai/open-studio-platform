export const packageName = "@auraone/rubric-studio";
export const packageVersion = "0.2.1";

export const release = Object.freeze({
  product: "Rubric Studio Open",
  version: "0.2.0",
  browserUrl: "https://rubric-studio.auraone.ai",
  productUrl: "https://auraone.ai/open/rubric-studio-open",
  docsUrl: "https://docs.rubricstudio.auraone.ai",
  sourceUrl: "https://github.com/auraoneai/rubric-studio-open",
  releaseUrl:
    "https://github.com/auraoneai/rubric-studio-open/releases/tag/v0.2.0",
  macos: Object.freeze({
    architecture: "arm64",
    artifact: "Rubric.Studio.Open_0.2.0_aarch64.dmg",
    sha256: "7dcb7de67835947b421089eab5fc244bcd8f75d503ebc7e763921c229c68f23d",
  }),
});

const REQUIRED_PROJECT_FIELDS = Object.freeze([
  "id",
  "name",
  "version",
  "branch",
  "commentsVisible",
  "themes",
  "criteria",
  "samples",
  "judges",
]);

const ARRAY_PROJECT_FIELDS = Object.freeze([
  "themes",
  "criteria",
  "samples",
  "judges",
]);

/**
 * Validate the portable Rubric Studio project-bundle shape.
 *
 * This validates the interchange boundary used by the browser editor. Deeper
 * criterion diagnostics remain in the full Studio application.
 *
 * @param {unknown} value
 * @returns {{ valid: boolean, issues: Array<{ path: string, code: string, message: string }> }}
 */
export function validateRubricProject(value) {
  const issues = [];

  if (!isRecord(value)) {
    return {
      valid: false,
      issues: [
        {
          path: "$",
          code: "project.type",
          message: "Rubric project must be a JSON object.",
        },
      ],
    };
  }

  for (const field of REQUIRED_PROJECT_FIELDS) {
    if (!(field in value)) {
      issues.push({
        path: `$.${field}`,
        code: "project.required",
        message: `Missing required project field "${field}".`,
      });
    }
  }

  for (const field of ["id", "name", "version", "branch"]) {
    if (field in value && !isNonEmptyString(value[field])) {
      issues.push({
        path: `$.${field}`,
        code: "project.string",
        message: `"${field}" must be a non-empty string.`,
      });
    }
  }

  if (
    "commentsVisible" in value &&
    typeof value.commentsVisible !== "boolean"
  ) {
    issues.push({
      path: "$.commentsVisible",
      code: "project.boolean",
      message: '"commentsVisible" must be a boolean.',
    });
  }

  for (const field of ARRAY_PROJECT_FIELDS) {
    if (field in value && !Array.isArray(value[field])) {
      issues.push({
        path: `$.${field}`,
        code: "project.array",
        message: `"${field}" must be an array.`,
      });
    }
  }

  if (Array.isArray(value.themes)) {
    validateUniqueIds(value.themes, "$.themes", issues);
  }

  if (Array.isArray(value.criteria)) {
    validateUniqueIds(value.criteria, "$.criteria", issues);

    for (const [index, criterion] of value.criteria.entries()) {
      if (!isRecord(criterion)) continue;

      if (!isNonEmptyString(criterion.label)) {
        issues.push({
          path: `$.criteria[${index}].label`,
          code: "criterion.label",
          message: "Criterion label must be a non-empty string.",
        });
      }

      if (!isNonEmptyString(criterion.themeId)) {
        issues.push({
          path: `$.criteria[${index}].themeId`,
          code: "criterion.theme",
          message: "Criterion themeId must be a non-empty string.",
        });
      }

      if (
        "weight" in criterion &&
        (typeof criterion.weight !== "number" ||
          !Number.isFinite(criterion.weight) ||
          criterion.weight < 0)
      ) {
        issues.push({
          path: `$.criteria[${index}].weight`,
          code: "criterion.weight",
          message: "Criterion weight must be a finite non-negative number.",
        });
      }
    }
  }

  return { valid: issues.length === 0, issues };
}

/**
 * Validate either a project object or a Studio project-bundle object.
 *
 * @param {unknown} value
 * @returns {{ valid: boolean, issues: Array<{ path: string, code: string, message: string }> }}
 */
export function validateRubricBundle(value) {
  if (isRecord(value) && "project" in value) {
    const result = validateRubricProject(value.project);
    return {
      valid: result.valid,
      issues: result.issues.map((issue) => ({
        ...issue,
        path:
          issue.path === "$"
            ? "$.project"
            : `$.project${issue.path.slice(1)}`,
      })),
    };
  }

  return validateRubricProject(value);
}

function validateUniqueIds(items, path, issues) {
  const ids = new Set();

  for (const [index, item] of items.entries()) {
    if (!isRecord(item) || !isNonEmptyString(item.id)) {
      issues.push({
        path: `${path}[${index}].id`,
        code: "item.id",
        message: "Item id must be a non-empty string.",
      });
      continue;
    }

    if (ids.has(item.id)) {
      issues.push({
        path: `${path}[${index}].id`,
        code: "item.id.duplicate",
        message: `Duplicate item id "${item.id}".`,
      });
    }
    ids.add(item.id);
  }
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}
