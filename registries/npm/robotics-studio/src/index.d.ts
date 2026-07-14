export type ValidationIssue = {
  path: string;
  code: string;
  message: string;
};

export type ValidationResult = {
  valid: boolean;
  issues: ValidationIssue[];
};

export const packageName: "@auraone/robotics-studio";
export const packageVersion: "0.2.1";

export const release: Readonly<{
  product: "Robotics Studio Open";
  version: "0.2.0";
  browserUrl: "https://robotics-studio.auraone.ai";
  productUrl: "https://auraone.ai/open/robotics-studio";
  sourceUrl: "https://github.com/auraoneai/robotics-studio-open";
  releaseUrl: "https://github.com/auraoneai/robotics-studio-open/releases/tag/v0.2.0";
  macos: Readonly<{
    architecture: "arm64";
    artifact: "Robotics.Studio.Open_0.2.0_aarch64.dmg";
    sha256: "b6d08f308c7806df2d67dc34d6d12e9df9f33e135afd61ced1cbb16653f4cf05";
  }>;
}>;

export function validateDatasetManifest(value: unknown): ValidationResult;
