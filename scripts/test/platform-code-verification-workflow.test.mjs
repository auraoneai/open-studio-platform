import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const root = new URL('../..', import.meta.url);
const repoRoot = new URL('../../../../', import.meta.url);

function read(path) {
  return readFileSync(new URL(path, root), 'utf8');
}

function readRepo(path) {
  return readFileSync(new URL(path, repoRoot), 'utf8');
}

test('platform code verification workflow covers OS matrix template builds', () => {
  const text = read('.github-templates/workflows/platform-code-verification.yml');

  for (const snippet of [
    'macos-14',
    'windows-latest',
    'ubuntu-24.04',
    'pnpm --dir opensource/open-studio-platform/templates/tauri-app run verify',
    'libwebkit2gtk-4.1-dev',
    'libayatana-appindicator3-dev',
  ]) {
    assert.match(text, new RegExp(snippet.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('platform code verification workflow wires native keychain and GPU fixture gates', () => {
  const text = read('.github-templates/workflows/platform-code-verification.yml');

  for (const snippet of [
    'AURAONE_RUN_NATIVE_KEYCHAIN_SMOKE',
    'native_backend_round_trip_on_current_os',
    'AURAONE_RUN_GPU_DECODE_SMOKE',
    'AURAONE_GPU_FIXTURE',
    'gpu_decode_fixture_contract',
    'release-flow-contracts',
    'verify:code-gates',
  ]) {
    assert.match(text, new RegExp(snippet.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('root hosted smoke workflow and reusable template support runner overrides', () => {
  const files = [
    readRepo('.github/workflows/open-studio-platform-hosted-smokes.yml'),
    read('.github-templates/workflows/platform-code-verification.yml'),
  ];

  for (const text of files) {
    for (const snippet of [
      'runs-on: ${{ fromJSON(',
      'macos_runs_on',
      'windows_runs_on',
      'linux_runs_on',
      'macos_gpu_runs_on',
      'windows_gpu_runs_on',
      'linux_gpu_runs_on',
      'AURAONE_PLATFORM_MACOS_RUNS_ON',
      'AURAONE_PLATFORM_WINDOWS_RUNS_ON',
      'AURAONE_PLATFORM_LINUX_RUNS_ON',
      'AURAONE_PLATFORM_MACOS_GPU_RUNS_ON',
      'AURAONE_PLATFORM_WINDOWS_GPU_RUNS_ON',
      'AURAONE_PLATFORM_LINUX_GPU_RUNS_ON',
    ]) {
      assert.match(text, new RegExp(snippet.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }
  }
});

test('security workflow uses the expiring cargo-audit advisory register', () => {
  const text = read('.github-templates/workflows/security.yml');

  assert.match(text, /scripts\/run-cargo-audit\.mjs/);
  assert.doesNotMatch(text, /find opensource\/open-studio-platform -name Cargo\.lock/);
});
