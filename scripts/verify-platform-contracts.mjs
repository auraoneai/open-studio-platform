import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const telemetry = JSON.parse(
  readFileSync(join(root, 'schemas', 'telemetry.schema.json'), 'utf8'),
);
const telemetryEvents = JSON.parse(
  readFileSync(join(root, 'schemas', 'telemetry-events.json'), 'utf8'),
);
const intake = JSON.parse(
  readFileSync(join(root, 'schemas', 'intake-packet.schema.json'), 'utf8'),
);
const hooks = JSON.parse(
  readFileSync(join(root, 'schemas', 'extension-hooks.schema.json'), 'utf8'),
);
const tauriTemplatePackage = JSON.parse(
  readFileSync(join(root, 'templates/tauri-app/package.json'), 'utf8'),
);
const tauriCargoToml = readFileSync(
  join(root, 'templates/tauri-app/src-tauri/Cargo.toml'),
  'utf8',
);
const tauri = JSON.parse(
  readFileSync(join(root, 'templates/tauri-app/src-tauri/tauri.conf.json'), 'utf8'),
);
const capabilities = JSON.parse(
  readFileSync(
    join(root, 'templates/tauri-app/src-tauri/capabilities/default.json'),
    'utf8',
  ),
);
const templateAppSource = readFileSync(join(root, 'templates/tauri-app/src/App.tsx'), 'utf8');
const templateIpcSource = readFileSync(join(root, 'templates/tauri-app/src/ipc.ts'), 'utf8');
const templateMainSource = readFileSync(
  join(root, 'templates/tauri-app/src-tauri/src/main.rs'),
  'utf8',
);
const templateDeepLinkSource = readFileSync(
  join(root, 'templates/tauri-app/src-tauri/src/deep_link.rs'),
  'utf8',
);
const templateReadme = readFileSync(join(root, 'templates/tauri-app/README.md'), 'utf8');
const sidecarCargo = readFileSync(
  join(root, 'crates/auraone-platform-sidecar/Cargo.toml'),
  'utf8',
);
const sidecarSource = readFileSync(
  join(root, 'crates/auraone-platform-sidecar/src/lib.rs'),
  'utf8',
);

const canonicalCsp =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' data: blob:; connect-src 'self' https://updates.auraone.ai https://updates2.auraone.ai https://intake.auraone.ai https://o.auraone.ai https://sentry.io; frame-src 'none'; object-src 'none'; base-uri 'self'";

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

if (
  !telemetry.properties.app.properties.flagship.enum.includes('agent-studio-open')
) {
  throw new Error('Telemetry schema must include Agent Studio Open.');
}

if (
  !telemetryEvents.events.some(
    (event) => event.name === 'agent_protocol_surface_used',
  )
) {
  throw new Error('Telemetry registry must include Agent Studio protocol event.');
}

if (!intake.properties.product.enum.includes('agent-studio-open')) {
  throw new Error('Intake schema must include Agent Studio Open.');
}

if (!hooks.properties.hooks.items.properties.kind.enum.includes('llm_gateway_provider')) {
  throw new Error('Extension hook schema must include LLM gateway providers.');
}

if (tauri.app.security.csp !== canonicalCsp) {
  throw new Error('Tauri template CSP is not canonical.');
}

const deepLinkSchemes =
  tauri.plugins['deep-link'].desktop?.schemes ?? tauri.plugins['deep-link'].schemes;

if (deepLinkSchemes[0] !== 'auraone') {
  throw new Error('Tauri template must register auraone://.');
}

if (!tauri.plugins.updater.endpoints[0].startsWith('https://updates.auraone.ai/')) {
  throw new Error('Tauri updater endpoint must use updates.auraone.ai.');
}

for (const openMode of [
  'openFolderPath(selected)',
  'onDragDropProject',
  'listRecentProjects',
  'project_path_from_args',
  'payload.installUrl',
]) {
  const source = `${templateAppSource}\n${templateIpcSource}\n${templateMainSource}\n${templateDeepLinkSource}`;
  if (!source.includes(openMode)) {
    throw new Error(`Tauri template must implement open mode contract: ${openMode}`);
  }
}

for (const sidecarContract of [
  'auraone-platform-sidecar',
  'auraone-sidecar-jsonl-v1',
  'Timeout',
  'Crashed',
  '50 ms',
  'PyO3',
]) {
  const source = `${templateReadme}\n${sidecarCargo}\n${sidecarSource}`;
  if (!source.includes(sidecarContract)) {
    throw new Error(`Sidecar policy must cover ${sidecarContract}.`);
  }
}

const exactTauriPackages = [
  '@tauri-apps/api',
  '@tauri-apps/cli',
  '@tauri-apps/plugin-clipboard-manager',
  '@tauri-apps/plugin-deep-link',
  '@tauri-apps/plugin-dialog',
  '@tauri-apps/plugin-fs',
  '@tauri-apps/plugin-notification',
  '@tauri-apps/plugin-os',
  '@tauri-apps/plugin-process',
  '@tauri-apps/plugin-updater',
];

for (const name of exactTauriPackages) {
  const version =
    tauriTemplatePackage.dependencies?.[name] ??
    tauriTemplatePackage.devDependencies?.[name];
  if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error(`Tauri package ${name} must be pinned to an exact version.`);
  }
}

for (const crate of [
  'tauri',
  'tauri-build',
  'tauri-plugin-clipboard-manager',
  'tauri-plugin-deep-link',
  'tauri-plugin-dialog',
  'tauri-plugin-fs',
  'tauri-plugin-notification',
  'tauri-plugin-os',
  'tauri-plugin-process',
  'tauri-plugin-updater',
]) {
  const exactVersion = new RegExp(
    `${escapeRegExp(crate)} = (?:\\{ version = "|")\\d+\\.\\d+\\.\\d+`,
  );
  if (!exactVersion.test(tauriCargoToml)) {
    throw new Error(`Tauri crate ${crate} must be pinned to an exact version.`);
  }
}

for (const permission of capabilities.permissions) {
  const identifier =
    typeof permission === 'string' ? permission : permission?.identifier ?? '';
  if (identifier.startsWith('shell:') || identifier.startsWith('http:')) {
    throw new Error(`Default capabilities must not include ${identifier}.`);
  }
}

if (capabilities.remote?.urls?.length) {
  throw new Error('Default capabilities must not grant remote URLs.');
}

console.log('Open Studio Platform contracts verified.');
