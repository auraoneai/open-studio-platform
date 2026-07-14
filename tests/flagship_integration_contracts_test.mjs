import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const repo = new URL('../../..', import.meta.url).pathname;

function read(path) {
  return readFileSync(join(repo, path), 'utf8');
}

function packageJson(path) {
  return JSON.parse(read(path));
}

const flagships = [
  {
    name: 'rubric-studio-open',
    packagePath: 'opensource/rubric-studio-open/package.json',
    sources: [
      'opensource/rubric-studio-open/src/domain/platformTelemetry.ts',
      'opensource/rubric-studio-open/src/components/SettingsPanel.tsx',
      'opensource/rubric-studio-open/src/domain/keychain.ts',
      'opensource/rubric-studio-open/src/components/ExportPanel.tsx',
    ],
  },
  {
    name: 'robotics-studio-open',
    packagePath: 'opensource/robotics-studio/package.json',
    sources: [
      'opensource/robotics-studio/src/platformContracts.ts',
      'opensource/robotics-studio/src/App.tsx',
    ],
  },
  {
    name: 'agent-studio-open',
    packagePath: 'opensource/agent-studio-open/package.json',
    sources: [
      'opensource/agent-studio-open/app/src/platformTelemetry.ts',
      'opensource/agent-studio-open/app/src/platformIntake.ts',
      'opensource/agent-studio-open/app/src/App.tsx',
    ],
  },
];

test('all flagships declare and consume shared platform packages', () => {
  for (const flagship of flagships) {
    const manifest = packageJson(flagship.packagePath);
    assert.equal(
      manifest.dependencies?.['@auraone/platform-contracts'],
      'file:../open-studio-platform/packages/platform-contracts',
      `${flagship.name} must depend on shared platform contracts`,
    );
    assert.equal(
      manifest.dependencies?.['@auraone/aura-ide-kit'],
      'file:../open-studio-platform/packages/aura-ide-kit',
      `${flagship.name} must depend on shared Aura IDE kit`,
    );

    const source = flagship.sources.map(read).join('\n');
    assert.match(source, /@auraone\/platform-contracts/, `${flagship.name} must import platform contracts`);
    assert.match(source, /@auraone\/aura-ide-kit/, `${flagship.name} must import Aura IDE kit`);
  }
});

test('flagship settings UIs render the shared telemetry event log component', () => {
  assert.match(read('opensource/rubric-studio-open/src/components/SettingsPanel.tsx'), /AuraTelemetryEventLog/);
  assert.match(read('opensource/robotics-studio/src/App.tsx'), /AuraTelemetryEventLog/);
  assert.match(read('opensource/agent-studio-open/app/src/App.tsx'), /AuraTelemetryEventLog/);
});

test('flagship intake flows persist install signing keypairs through the shared keychain helper', () => {
  for (const flagship of flagships) {
    const source = flagship.sources.map(read).join('\n');
    assert.match(
      source,
      /ensureIntakeInstallSigningKeypair|ensure[A-Za-z]+IntakeInstallSigningKeypair/,
      `${flagship.name} must wire intake install keypair persistence`,
    );
  }

  const keychainContract = read(
    'opensource/open-studio-platform/packages/platform-contracts/src/keychain.ts',
  );
  assert.match(
    keychainContract,
    /INTAKE_INSTALL_KEYPAIR_SCOPE\s*=\s*['"]intake-install-signing-key['"]/,
    'the shared keychain contract must define the approved intake install signing scope',
  );
  assert.match(
    keychainContract,
    /scope:\s*INTAKE_INSTALL_KEYPAIR_SCOPE/,
    'the shared intake helper must persist through the approved scope constant',
  );
});

test('Python sidecar packages require Python 3.11 or newer', () => {
  const pyprojects = [
    'opensource/agent-studio-open/cli/pyproject.toml',
    'opensource/robostudio-engine/pyproject.toml',
    'opensource/open-studio-platform/distribution/pypi/agentstudio/pyproject.toml',
    'opensource/open-studio-platform/registries/pypi/rubric-studio/pyproject.toml',
  ];

  for (const path of pyprojects) {
    const source = read(path);
    assert.match(source, /requires-python = ">=3\.11"/, `${path} must require Python 3.11+`);
    assert.doesNotMatch(source, /Programming Language :: Python :: 3\.10/, `${path} must not advertise Python 3.10`);
  }
});
