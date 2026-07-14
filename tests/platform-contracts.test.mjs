import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  AURAONE_URL_SCHEME,
  AGENT_STUDIO_EXTENSION_HOOKS,
  CANONICAL_CSP,
  INTAKE_ENDPOINT,
  ROBOTICS_INTAKE_ROLES,
  ROBOTICS_STUDIO_EXTENSION_HOOKS,
  REQUIRED_TAURI_CAPABILITIES,
  TelemetryEventLog,
  classifyIntakeFailure,
  createIntakePreview,
  createIntakeUploadRequest,
  createTauriKeychainApi,
  createTelemetryEvent,
  createUpdaterConfig,
  defaultCrashReporterConfig,
  ensureIntakeInstallSigningKeypair,
  hooksForSurface,
  intakeInstallSigningKeypairKey,
  sanitizeConsoleArgs,
  scrubCrashText,
  scrubDiagnosticText,
  validateIntakeManifest,
  validateIntakeInstallSigningKeypair,
  validatePlatformExtensionHook,
  validateTelemetryEvent,
} from '../packages/platform-contracts/dist/index.js';

const root = new URL('..', import.meta.url).pathname;

function readJson(path) {
  return JSON.parse(readFileSync(join(root, path), 'utf8'));
}

const baseApp = {
  flagship: 'rubric-studio-open',
  version: '0.1.0',
  channel: 'stable',
};

const baseDevice = {
  install_id: '123e4567-e89b-42d3-a456-426614174000',
  os: 'darwin',
  os_version: '14.4',
  arch: 'aarch64',
};

function validTelemetry(payload = { feature_id: 'rubric.editor' }) {
  return createTelemetryEvent({
    eventName: 'feature_used',
    app: baseApp,
    device: baseDevice,
    sessionId: '123e4567-e89b-42d3-a456-426614174001',
    eventId: '123e4567-e89b-42d3-a456-426614174002',
    timestamp: '2026-05-13T12:00:00.000Z',
    payload,
  });
}

function validManifest(overrides = {}) {
  return {
    $schema: 'https://schemas.auraone.ai/open-studio/intake-packet/v1.json',
    manifest_version: '1.0.0',
    product: 'rubric-studio-open',
    product_version: '0.1.0',
    platform_version: '0.1.0',
    created_at: '2026-05-13T12:00:00.000Z',
    project_id: '123e4567-e89b-42d3-a456-426614174003',
    creator: {
      display_name: 'Researcher',
      email: 'researcher@example.com',
    },
    intent: 'Request expert review of rubric calibration samples.',
    redaction: {
      file_paths: true,
      hostnames: true,
      api_keys: true,
      user_pii_other_than_explicit_intake: true,
      custom_rules_applied: [],
    },
    consent: {
      user_acknowledged_preview: true,
      user_acknowledged_transport: true,
      timestamp: '2026-05-13T12:00:00.000Z',
    },
    payload_manifest: [
      {
        path: 'payload/rubric.toml',
        role: 'rubric_definition',
        sha256:
          '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        size_bytes: 1024,
      },
    ],
    provenance: {
      engine_libs: {
        'rubric-spec': '0.5.3',
        'iaa-kit': '0.2.1',
      },
      os: 'darwin',
      os_version: '14.4',
      app_install_id_hash:
        'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
    },
    transport: {
      destination: INTAKE_ENDPOINT,
      intended_at: '2026-05-13T12:00:00.000Z',
    },
    ...overrides,
  };
}

test('Tauri template exposes platform CSP, URL scheme, updater, and ACL defaults', () => {
  const tauri = readJson('templates/tauri-app/src-tauri/tauri.conf.json');
  const capabilities = readJson(
    'templates/tauri-app/src-tauri/capabilities/default.json',
  );

  assert.equal(tauri.app.security.csp, CANONICAL_CSP);
  assert.deepEqual(
    tauri.plugins['deep-link'].desktop?.schemes ?? tauri.plugins['deep-link'].schemes,
    [AURAONE_URL_SCHEME],
  );
  assert.match(
    tauri.plugins.updater.endpoints[0],
    /^https:\/\/updates\.auraone\.ai\/<flagship>\//,
  );

  for (const permission of REQUIRED_TAURI_CAPABILITIES) {
    assert.ok(capabilities.permissions.includes(permission), permission);
  }
  assert.ok(!capabilities.permissions.includes('shell:open'));
  assert.ok(!capabilities.permissions.includes('shell:execute'));
  assert.ok(!capabilities.permissions.includes('http:default'));
});

test('telemetry schema and registry include the platform events Rubric Studio consumes', () => {
  const schema = readJson('schemas/telemetry.schema.json');
  const registry = readJson('schemas/telemetry-events.json');

  assert.equal(schema.$id, 'https://schemas.auraone.ai/open-studio/telemetry/v1.json');
  assert.ok(
    registry.events.some((event) => event.name === 'intake_packet_exported'),
  );
  assert.ok(registry.events.some((event) => event.name === 'update_applied'));
  assert.ok(
    registry.events.some((event) => event.name === 'welcome_wizard_completed'),
  );
  assert.ok(
    registry.events.some((event) => event.name === 'robotics_dataset_opened'),
  );
  assert.ok(
    registry.events.some((event) => event.name === 'robotics_export_completed'),
  );
});

test('telemetry validation rejects content-bearing payload keys and file paths', () => {
  assert.equal(validateTelemetryEvent(validTelemetry()).valid, true);

  const invalid = validateTelemetryEvent(
    validTelemetry({
      rubric_text: 'never send this',
      feature_id: 'rubric.editor',
      local_value: '/Users/researcher/project/rubric.toml',
    }),
  );

  assert.equal(invalid.valid, false);
  assert.ok(invalid.errors.some((error) => error.includes('rubric_text')));
  assert.ok(invalid.errors.some((error) => error.includes('file paths')));
});

test('telemetry event log records would-send events when telemetry is disabled', () => {
  const log = new TelemetryEventLog();
  const entry = log.record(validTelemetry(), false);

  assert.equal(entry.status, 'would_send');
  assert.equal(log.list().length, 1);
  assert.match(log.exportJson(), /would_send/);

  log.clear();
  assert.equal(log.list().length, 0);
});

test('telemetry event log records opted-in events as local previews until a transport confirms delivery', () => {
  const log = new TelemetryEventLog();
  const entry = log.record(validTelemetry(), true);

  assert.equal(entry.status, 'local_preview');
  assert.doesNotMatch(log.exportJson(), /"status": "sent"/);
});

test('crash reporter defaults off and scrubs paths, hostnames, and secrets', () => {
  const config = defaultCrashReporterConfig('rubric-studio-open');
  assert.equal(config.enabled, false);
  assert.equal(config.scrubPaths, true);
  assert.equal(config.scrubHostnames, true);
  assert.equal(config.scrubApiKeys, true);
  assert.equal(config.sampleRate, 1);

  const scrubbed = scrubCrashText(
    'panic at /Users/me/rubrics/a.toml contacting api.example.com with sk-1234567890abcdefghi',
  );
  assert.ok(!scrubbed.includes('/Users/me'));
  assert.ok(!scrubbed.includes('api.example.com'));
  assert.ok(!scrubbed.includes('sk-1234567890abcdefghi'));
});

test('diagnostic scrubbing removes API keys from console args and stack traces', () => {
  const raw =
    'failed with sk-abcdefghijklmnopqrstuvwxyz in /Users/alice/project on build.internal.example.com';
  const scrubbed = scrubDiagnosticText(raw);
  assert.equal(scrubbed.includes('sk-abcdefghijklmnopqrstuvwxyz'), false);
  assert.equal(scrubbed.includes('/Users/alice'), false);
  assert.equal(scrubbed.includes('build.internal.example.com'), false);

  const error = new Error('token AKIA1234567890ABCDEF leaked');
  error.stack =
    'Error: token AKIA1234567890ABCDEF leaked\n    at run (/home/alice/app/index.ts:1:1)';
  const sanitized = sanitizeConsoleArgs([
    'AIza1234567890abcdefghijklmnop',
    error,
  ]);
  assert.equal(sanitized[0], '<SECRET>');
  assert.equal(sanitized[1].message.includes('AKIA1234567890ABCDEF'), false);
  assert.equal(sanitized[1].stack.includes('/home/alice'), false);
});

test('keychain API routes through shared Tauri IPC commands with secret suppression', async () => {
  const calls = [];
  const api = createTauriKeychainApi(async (command, args) => {
    calls.push({ command, args });
    if (command === 'platform_keychain_get') return 'secret-value';
    if (command === 'platform_keychain_list') return ['anthropic'];
    return undefined;
  });

  await api.set(
    { service: 'rubric-studio-open', scope: 'byo-api-keys', identifier: 'anthropic' },
    'secret-value',
  );
  assert.equal(
    await api.get({
      service: 'rubric-studio-open',
      scope: 'byo-api-keys',
      identifier: 'anthropic',
    }),
    'secret-value',
  );
  assert.equal(calls[0].command, 'platform_keychain_set');
  assert.equal(calls[0].args.secret, true);
});

test('keychain API rejects unapproved user-content scopes', async () => {
  const api = createTauriKeychainApi(async () => {
    throw new Error('invoke should not be called for invalid keychain scope');
  });

  await assert.rejects(
    api.set(
      {
        service: 'rubric-studio-open',
        scope: 'project-content',
        identifier: 'rubric-body',
      },
      'user-authored rubric text',
    ),
    /not approved for secret storage/,
  );
});

test('intake install signing keypair persists through the shared keychain API', async () => {
  const values = new Map();
  const api = {
    async set(key, value) {
      values.set(`${key.service}:${key.scope}:${key.identifier}`, value);
    },
    async get(key) {
      return values.get(`${key.service}:${key.scope}:${key.identifier}`) ?? null;
    },
    async delete(key) {
      values.delete(`${key.service}:${key.scope}:${key.identifier}`);
    },
    async list(service, scope) {
      return [...values.keys()]
        .filter((key) => key.startsWith(`${service}:${scope}:`))
        .map((key) => key.split(':').at(-1));
    },
  };
  let generated = 0;
  const generator = () => {
    generated += 1;
    return {
      algorithm: 'Ed25519',
      public_key: 'ed25519-public-test',
      private_key: 'ed25519-private-test',
      created_at: '2026-05-13T12:00:00.000Z',
    };
  };

  const first = await ensureIntakeInstallSigningKeypair(api, 'rubric-studio-open', generator);
  const second = await ensureIntakeInstallSigningKeypair(api, 'rubric-studio-open', generator);

  assert.equal(generated, 1);
  assert.deepEqual(second, first);
  assert.deepEqual(intakeInstallSigningKeypairKey('rubric-studio-open'), {
    service: 'rubric-studio-open',
    scope: 'intake-install-signing-key',
    identifier: 'ed25519-install-keypair-v1',
  });
  validateIntakeInstallSigningKeypair(first);
});

test('intake manifest requires Rubric roles, local preview consent, and platform endpoint', () => {
  const manifest = validManifest();
  assert.deepEqual(validateIntakeManifest(manifest), []);

  const preview = createIntakePreview(manifest);
  assert.equal(preview.file_count, 1);
  assert.equal(preview.destination, INTAKE_ENDPOINT);
  assert.ok(preview.never_sent_copy.includes('API keys.'));

  const request = createIntakeUploadRequest(manifest);
  assert.equal(request.endpoint, INTAKE_ENDPOINT);
  assert.equal(request.packet_field_name, 'packet');

  const invalid = validManifest({
    consent: {
      user_acknowledged_preview: false,
      user_acknowledged_transport: true,
      timestamp: '2026-05-13T12:00:00.000Z',
    },
  });
  assert.ok(
    validateIntakeManifest(invalid).some((error) =>
      error.includes('acknowledge local packet preview'),
    ),
  );
});

test('intake failure classification covers retry, diagnostics, size limits, and version mismatch', () => {
  const retry = classifyIntakeFailure('network', {}, 2);
  assert.equal(retry.queue_for_retry, true);
  assert.equal(retry.retry_after_ms, 8000);
  assert.match(retry.user_message, /saved locally/);

  const sizeLimit = classifyIntakeFailure(413, { error_code: 'packet_too_large' });
  assert.equal(sizeLimit.queue_for_retry, false);
  assert.match(sizeLimit.user_message, /size limit/);

  const diagnostics = classifyIntakeFailure(422, {
    error_message: 'manifest validation failed',
    diagnostics: ['preview consent is required'],
  });
  assert.deepEqual(diagnostics.diagnostics, ['preview consent is required']);

  const version = classifyIntakeFailure(409, {
    error_message: 'Cloud needs an upgrade',
    docs_url: 'https://auraone.ai/open/docs/intake-packets#version-mismatch',
  });
  assert.equal(version.queue_for_retry, false);
  assert.equal(version.user_message, 'Cloud needs an upgrade');
  assert.match(version.docs_url, /version-mismatch/);
});

test('intake schemas expose Rubric Studio Open payload roles', () => {
  const roles = readJson('schemas/intake-roles.json');
  const roleNames = new Set(roles.roles.map((entry) => entry.role));

  for (const role of [
    'rubric_definition',
    'rubric_criterion',
    'rubric_sample',
    'rubric_calibration_set',
    'rubric_judge_card',
    'rubric_eval_run_manifest',
  ]) {
    assert.ok(roleNames.has(role), role);
  }
});

test('Robotics Studio intake roles and telemetry inherit platform privacy constraints', () => {
  const manifest = validManifest({
    product: 'robotics-studio-open',
    payload_manifest: [
      {
        path: 'payload/reviewed-subset.json',
        role: 'robotics_reviewed_subset_manifest',
        sha256:
          '1123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        size_bytes: 2048,
      },
      {
        path: 'payload/sensor-qa-report.md',
        role: 'robotics_sensor_qa_report',
        sha256:
          '2123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        size_bytes: 4096,
      },
    ],
  });

  assert.deepEqual(validateIntakeManifest(manifest), []);
  assert.ok(ROBOTICS_INTAKE_ROLES.includes('robotics_failure_cluster'));

  const rawMedia = validManifest({
    product: 'robotics-studio-open',
    payload_manifest: [
      {
        path: 'payload/front-camera.mp4',
        role: 'robotics_episode_reference',
        sha256:
          '3123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
        size_bytes: 4096,
      },
    ],
  });
  assert.ok(
    validateIntakeManifest(rawMedia).some((error) =>
      error.includes('must reference raw video'),
    ),
  );

  const roboticsTelemetry = createTelemetryEvent({
    eventName: 'robotics_dataset_opened',
    app: { ...baseApp, flagship: 'robotics-studio-open' },
    device: baseDevice,
    sessionId: '123e4567-e89b-42d3-a456-426614174001',
    eventId: '123e4567-e89b-42d3-a456-426614174004',
    timestamp: '2026-05-13T12:00:00.000Z',
    payload: { format: 'lerobot_v3', episode_bucket: '50000_plus' },
  });
  assert.equal(validateTelemetryEvent(roboticsTelemetry).valid, true);
});

test('updater config uses platform endpoint template and embedded pubkey', () => {
  const pubkey = 'DAKD/Nqj4KoXZpXv9li/zVQv+2LhThXE5J9tx0Wl1B8=';
  const config = createUpdaterConfig('rubric-studio-open', pubkey);
  assert.equal(config.active, true);
  assert.equal(config.pubkey, pubkey);
  assert.equal(
    config.endpoints[0],
    'https://updates.auraone.ai/rubric-studio-open/{{target}}/{{arch}}/{{current_version}}',
  );
  assert.equal(
    config.endpoints[1],
    'https://updates2.auraone.ai/rubric-studio-open/{{target}}/{{arch}}/{{current_version}}',
  );
});

test('Agent Studio platform extension hooks inherit shared contracts without browser stdio or OTLP', () => {
  assert.ok(
    ROBOTICS_STUDIO_EXTENSION_HOOKS.some(
      (hook) => hook.id === 'dataset.stream.chunked_ipc',
    ),
  );
  assert.ok(
    ROBOTICS_STUDIO_EXTENSION_HOOKS.some(
      (hook) => hook.id === 'ros.rosbag2_sqlite',
    ),
  );
  for (const hook of ROBOTICS_STUDIO_EXTENSION_HOOKS) {
    assert.deepEqual(validatePlatformExtensionHook(hook), []);
  }
  assert.ok(
    validatePlatformExtensionHook({
      id: 'ros.rosbag2_sqlite',
      kind: 'robotics_ros_adapter',
      surface: 'browser',
      enabled_in: ['stable'],
    }).some((error) => error.includes('desktop-only')),
  );

  assert.ok(
    AGENT_STUDIO_EXTENSION_HOOKS.some((hook) => hook.id === 'mcp.websocket'),
  );
  assert.ok(AGENT_STUDIO_EXTENSION_HOOKS.some((hook) => hook.id === 'otlp.grpc'));
  assert.ok(
    AGENT_STUDIO_EXTENSION_HOOKS.some(
      (hook) => hook.id === 'llm_gateway.anthropic',
    ),
  );
  assert.ok(
    AGENT_STUDIO_EXTENSION_HOOKS.some(
      (hook) => hook.id === 'intake.agent_otel_spans',
    ),
  );

  for (const hook of AGENT_STUDIO_EXTENSION_HOOKS) {
    assert.deepEqual(validatePlatformExtensionHook(hook), []);
  }

  assert.equal(
    hooksForSurface('browser').some((hook) => hook.id === 'mcp.stdio'),
    false,
  );
  assert.equal(
    hooksForSurface('browser').some((hook) => hook.kind === 'otlp_receiver'),
    false,
  );
  assert.ok(
    validatePlatformExtensionHook({
      id: 'mcp.stdio',
      kind: 'mcp_transport',
      surface: 'browser',
      enabled_in: ['stable'],
    }).some((error) => error.includes('stdio MCP')),
  );
});
