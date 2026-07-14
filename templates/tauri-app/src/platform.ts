export const platformCapabilities = [
  "tauri-shell",
  "secure-csp",
  "auraone-url-scheme",
  "opt-in-telemetry",
  "local-event-log",
  "opt-in-crash-reporting",
  "os-keychain",
  "signed-update-manifest",
  "auraonepkg-intake",
] as const;

export type PlatformCapability = (typeof platformCapabilities)[number];

export interface KeychainRequest {
  namespace: "huggingface" | "auraone-intake" | "updates" | "custom";
  key: string;
  value?: string;
}

export interface UpdateManifest {
  schema_version: "1.0.0";
  flagship: "rubric-studio-open" | "robotics-studio-open" | "agent-studio-open";
  channel: "stable" | "beta" | "nightly";
  version: string;
  notes: string;
  pub_date: string;
  platforms: Record<string, { signature: string; url: string }>;
  checksums: Record<string, string>;
  rollout: {
    percentage: number;
    mandatory: boolean;
    min_version: string;
    kill_switch?: boolean;
  };
  manifest_signature_algorithm: "ed25519";
  manifest_signature: string;
}
