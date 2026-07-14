export type ValidationIssue = {
  path: string;
  code: string;
  message: string;
};

export type ValidationResult = {
  valid: boolean;
  issues: ValidationIssue[];
};

export const packageName: "@auraone/agent-studio";
export const packageVersion: "0.2.2";

export const release: Readonly<{
  product: "Agent Studio Open";
  version: "0.2.0";
  browserUrl: "https://agentstudio.auraone.ai";
  productUrl: "https://auraone.ai/open/agent-studio-open";
  docsUrl: "https://auraone.ai/resources/docs/agent-studio-open";
  sourceUrl: "https://github.com/auraoneai/agent-studio-open";
  pythonPackage: "auraone-agent-studio-open==0.2.1";
  releaseUrl: "https://github.com/auraoneai/agent-studio-open/releases/tag/v0.2.0";
  macos: Readonly<{
    architecture: "arm64";
    artifact: "Agent.Studio.Open_0.2.0_aarch64.dmg";
    sha256: "30adbf96b107eb221cce5e07514f4ead7ce32046253f89dd5692f77c52c578ca";
  }>;
}>;

export function validateAgentManifest(value: unknown): ValidationResult;
