import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  TelemetryEventLog,
  classifyIntakeFailure,
  createIntakePreview,
  createIntakeUploadRequest,
  createTelemetryEvent,
  defaultCrashReporterConfig,
  scrubCrashText,
  validateIntakeManifest,
} from '../packages/platform-contracts/dist/index.js';

const app = {
  flagship: 'rubric-studio-open',
  version: '0.1.0',
  channel: 'stable',
};

const device = {
  install_id: '123e4567-e89b-42d3-a456-426614174000',
  os: 'darwin',
  os_version: '14.4',
  arch: 'aarch64',
};

function manifest(overrides = {}) {
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
      },
      os: 'darwin',
      os_version: '14.4',
      app_install_id_hash:
        'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
    },
    transport: {
      destination: 'https://intake.auraone.ai/v1/packets/',
      intended_at: '2026-05-13T12:00:00.000Z',
    },
    ...overrides,
  };
}

test('no-network mode records local telemetry log without sending events', () => {
  const log = new TelemetryEventLog();
  const event = createTelemetryEvent({
    eventName: 'app_launched',
    app,
    device,
    sessionId: '123e4567-e89b-42d3-a456-426614174001',
    eventId: '123e4567-e89b-42d3-a456-426614174002',
    timestamp: '2026-05-13T12:00:00.000Z',
    payload: {},
  });

  const entry = log.record(event, false);

  assert.equal(entry.status, 'would_send');
  assert.equal(log.list().length, 1);
  assert.match(log.exportJson(), /app_launched/);
});

test('telemetry opt-in remains a local preview when no uploader confirms delivery', () => {
  const log = new TelemetryEventLog();
  const event = createTelemetryEvent({
    eventName: 'app_launched',
    app,
    device,
    sessionId: '123e4567-e89b-42d3-a456-426614174011',
    eventId: '123e4567-e89b-42d3-a456-426614174012',
    timestamp: '2026-05-13T12:00:00.000Z',
    payload: {},
  });

  const entry = log.record(event, true);

  assert.equal(entry.status, 'local_preview');
  assert.doesNotMatch(log.exportJson(), /"status": "sent"/);
});

test('crash reporting release flow defaults off and scrubs reportable text before opt-in', () => {
  const config = defaultCrashReporterConfig('rubric-studio-open');

  assert.equal(config.enabled, false);
  assert.equal(config.uploadMinidumpsOnNextLaunch, true);
  assert.equal(config.sampleRate, 1);

  const scrubbed = scrubCrashText(
    'panic at /Users/researcher/project/main.rs calling builder.internal.example.com with sk-1234567890abcdefghi',
  );
  assert.equal(scrubbed.includes('/Users/researcher'), false);
  assert.equal(scrubbed.includes('builder.internal.example.com'), false);
  assert.equal(scrubbed.includes('sk-1234567890abcdefghi'), false);
});

test('intake preview and cancel are purely local until upload request creation', () => {
  const preview = createIntakePreview(manifest());

  assert.equal(preview.file_count, 1);
  assert.equal(preview.destination, 'https://intake.auraone.ai/v1/packets/');
  assert.match(preview.never_sent_copy.join('\n'), /API keys/);
  assert.match(preview.never_sent_copy.join('\n'), /File system paths/);

  const cancelled = { uploadCreated: false, preview };
  assert.equal(cancelled.uploadCreated, false);

  const upload = createIntakeUploadRequest(preview.manifest);
  assert.deepEqual(upload, {
    endpoint: 'https://intake.auraone.ai/v1/packets/',
    product: 'rubric-studio-open',
    install_id_hash:
      'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
    packet_field_name: 'packet',
  });
});

test('intake no-network failure queues retry instead of dropping packet', () => {
  const plan = classifyIntakeFailure('network', {}, 2);

  assert.equal(plan.status, 'network');
  assert.equal(plan.queue_for_retry, true);
  assert.equal(plan.retry_after_ms, 8000);
  assert.match(plan.user_message, /saved locally/);
});

test('intake release flow rejects manifests without preview and transport consent', () => {
  const invalid = manifest({
    consent: {
      user_acknowledged_preview: false,
      user_acknowledged_transport: false,
      timestamp: '2026-05-13T12:00:00.000Z',
    },
  });

  const errors = validateIntakeManifest(invalid);

  assert.ok(errors.some((error) => error.includes('local packet preview')));
  assert.ok(errors.some((error) => error.includes('transport destination')));
});

test('rubric Apple identifier matches release config, Tauri config, and blocker evidence', () => {
  const expected = 'ai.auraone.rubricstudio.open';
  const flagships = JSON.parse(
    readFileSync(new URL('../configs/flagships.json', import.meta.url), 'utf8'),
  );
  const rubric = flagships.flagships.find((product) => product.id === 'rubric-studio-open');
  const tauri = JSON.parse(
    readFileSync(new URL('../../rubric-studio-open/src-tauri/tauri.conf.json', import.meta.url), 'utf8'),
  );
  const blockers = readFileSync(new URL('../BLOCKERS.md', import.meta.url), 'utf8');

  assert.equal(rubric.bundleIdentifier, expected);
  assert.equal(tauri.identifier, expected);
  assert.match(blockers, new RegExp(expected.replaceAll('.', '\\.')));
});
