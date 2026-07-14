import fs from "node:fs";
import path from "node:path";

export const evidenceExtensions = [".md", ".json", ".txt", ".png", ".pdf"];
export const textEvidenceExtensions = new Set([".md", ".json", ".txt"]);
export const placeholderPattern =
  /\b(TODO|TBD|FIXME|placeholder|pending|not yet|draft only|to be added|example only)\b/i;

export function resolveEvidenceDir({ envName, envValue, defaultDir }) {
  const configured = envValue ? path.resolve(envValue) : "";
  if (configured) return { evidenceDir: configured, source: "env" };
  if (defaultDir && fs.existsSync(defaultDir)) {
    return { evidenceDir: defaultDir, source: "default" };
  }
  return { evidenceDir: "", source: "missing" };
}

export function validateEvidenceFile(filePath, extension) {
  const stat = fs.statSync(filePath);
  const reasons = [];
  if (stat.size === 0) reasons.push("file is empty");

  if (textEvidenceExtensions.has(extension)) {
    const text = fs.readFileSync(filePath, "utf8");
    if (text.trim().length < 120) {
      reasons.push("text evidence is too short to prove an external action");
    }
    if (placeholderPattern.test(text)) {
      reasons.push("text evidence contains placeholder or pending language");
    }
    if (extension === ".json") {
      try {
        const parsed = JSON.parse(text);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          reasons.push("JSON evidence must be an object");
        } else if (Object.keys(parsed).length < 3) {
          reasons.push("JSON evidence object must contain at least three fields");
        }
      } catch {
        reasons.push("JSON evidence is not valid JSON");
      }
    }
  } else if (stat.size < 512) {
    reasons.push("binary evidence is too small to be a credible screenshot or PDF");
  }

  return {
    bytes: stat.size,
    accepted: reasons.length === 0,
    rejectionReasons: reasons,
  };
}

export function evidenceState(evidenceDir, relativeBase) {
  if (!evidenceDir) return { present: false, accepted: false, files: [] };
  const base = path.resolve(evidenceDir, relativeBase);
  const files = [];
  for (const extension of evidenceExtensions) {
    const filePath = `${base}${extension}`;
    if (!fs.existsSync(filePath)) continue;
    files.push({
      extension,
      ...validateEvidenceFile(filePath, extension),
    });
  }
  return {
    present: files.length > 0,
    accepted: files.some((file) => file.accepted),
    files,
  };
}

export function acceptedEvidencePaths(baseDirLabel, relativeBase) {
  return evidenceExtensions.map((extension) => `${baseDirLabel}/${relativeBase}${extension}`);
}
