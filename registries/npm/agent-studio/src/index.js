export const packageName = "@auraone/agent-studio";
export const packageVersion = "0.2.2";

export const release = Object.freeze({
  product: "Agent Studio Open",
  version: "0.2.0",
  browserUrl: "https://agentstudio.auraone.ai",
  productUrl: "https://auraone.ai/open/agent-studio-open",
  docsUrl: "https://auraone.ai/resources/docs/agent-studio-open",
  sourceUrl: "https://github.com/auraoneai/agent-studio-open",
  pythonPackage: "auraone-agent-studio-open==0.2.1",
  releaseUrl:
    "https://github.com/auraoneai/agent-studio-open/releases/tag/v0.2.0",
  macos: Object.freeze({
    architecture: "arm64",
    artifact: "Agent.Studio.Open_0.2.0_aarch64.dmg",
    sha256: "30adbf96b107eb221cce5e07514f4ead7ce32046253f89dd5692f77c52c578ca",
  }),
});

/**
 * Validate the MCP manifest boundary consumed by Agent Studio Open.
 *
 * @param {unknown} value
 * @returns {{ valid: boolean, issues: Array<{ path: string, code: string, message: string }> }}
 */
export function validateAgentManifest(value) {
  const issues = [];

  if (!isRecord(value)) {
    return invalidRoot("Agent manifest must be a JSON object.");
  }

  requireString(value, "serverName", "$.serverName", issues);
  requireString(value, "version", "$.version", issues);

  for (const field of ["tools", "resources", "prompts"]) {
    if (!Array.isArray(value[field])) {
      issues.push({
        path: `$.${field}`,
        code: "manifest.array",
        message: `"${field}" must be an array.`,
      });
    }
  }

  if (Array.isArray(value.tools)) {
    validateNamedItems(value.tools, "$.tools", issues, (tool, path) => {
      if (!isRecord(tool.inputSchema)) {
        issues.push({
          path: `${path}.inputSchema`,
          code: "tool.input-schema",
          message: "Tool inputSchema must be a JSON object.",
        });
      }
      if ("risk" in tool && !Array.isArray(tool.risk)) {
        issues.push({
          path: `${path}.risk`,
          code: "tool.risk",
          message: "Tool risk must be an array when provided.",
        });
      }
    });
  }

  if (Array.isArray(value.resources)) {
    const uris = new Set();
    for (const [index, item] of value.resources.entries()) {
      const path = `$.resources[${index}]`;
      if (!isRecord(item)) {
        issues.push({
          path,
          code: "resource.type",
          message: "Resource must be a JSON object.",
        });
        continue;
      }
      requireString(item, "uri", `${path}.uri`, issues);
      requireString(item, "name", `${path}.name`, issues);
      requireString(item, "mimeType", `${path}.mimeType`, issues);
      if (isNonEmptyString(item.uri)) {
        if (uris.has(item.uri)) {
          issues.push({
            path: `${path}.uri`,
            code: "resource.uri.duplicate",
            message: `Duplicate resource URI "${item.uri}".`,
          });
        }
        uris.add(item.uri);
      }
    }
  }

  if (Array.isArray(value.prompts)) {
    validateNamedItems(value.prompts, "$.prompts", issues);
  }

  return { valid: issues.length === 0, issues };
}

function validateNamedItems(items, path, issues, validateItem = () => {}) {
  const names = new Set();
  for (const [index, item] of items.entries()) {
    const itemPath = `${path}[${index}]`;
    if (!isRecord(item)) {
      issues.push({
        path: itemPath,
        code: "item.type",
        message: "Manifest item must be a JSON object.",
      });
      continue;
    }
    requireString(item, "name", `${itemPath}.name`, issues);
    if (isNonEmptyString(item.name)) {
      if (names.has(item.name)) {
        issues.push({
          path: `${itemPath}.name`,
          code: "item.name.duplicate",
          message: `Duplicate item name "${item.name}".`,
        });
      }
      names.add(item.name);
    }
    validateItem(item, itemPath);
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

function invalidRoot(message) {
  return {
    valid: false,
    issues: [{ path: "$", code: "manifest.type", message }],
  };
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}
