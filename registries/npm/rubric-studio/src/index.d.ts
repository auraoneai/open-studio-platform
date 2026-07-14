export type ValidationIssue = {
  path: string;
  code: string;
  message: string;
};

export type ValidationResult = {
  valid: boolean;
  issues: ValidationIssue[];
};

export type RubricProject = {
  id: string;
  name: string;
  version: string;
  branch: string;
  commentsVisible: boolean;
  themes: unknown[];
  criteria: unknown[];
  samples: unknown[];
  judges: unknown[];
  [key: string]: unknown;
};

export const packageName: "@auraone/rubric-studio";
export const packageVersion: "0.2.1";

export const release: Readonly<{
  product: "Rubric Studio Open";
  version: "0.2.0";
  browserUrl: "https://rubric-studio.auraone.ai";
  productUrl: "https://auraone.ai/open/rubric-studio-open";
  docsUrl: "https://docs.rubricstudio.auraone.ai";
  sourceUrl: "https://github.com/auraoneai/rubric-studio-open";
  releaseUrl: "https://github.com/auraoneai/rubric-studio-open/releases/tag/v0.2.0";
  macos: Readonly<{
    architecture: "arm64";
    artifact: "Rubric.Studio.Open_0.2.0_aarch64.dmg";
    sha256: "7dcb7de67835947b421089eab5fc244bcd8f75d503ebc7e763921c229c68f23d";
  }>;
}>;

export function validateRubricProject(value: unknown): ValidationResult;
export function validateRubricBundle(value: unknown): ValidationResult;
