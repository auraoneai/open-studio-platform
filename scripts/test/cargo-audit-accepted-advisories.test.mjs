import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const root = new URL('../..', import.meta.url);
const config = JSON.parse(
  readFileSync(new URL('configs/cargo-audit/accepted-advisories.json', root), 'utf8'),
);

test('accepted Tauri audit advisories are explicit, expiring, and reviewed', () => {
  assert.equal(config.reviewed_on, '2026-05-13');
  assert.equal(config.review_owner, '@auraone/security');
  assert.match(config.scope, /Tauri 2 Linux GTK\/WebKit/);
  assert.match(config.policy, /platform Cargo workspace must pass cargo-audit with no ignores/i);

  const advisories = config.accepted;
  assert.equal(advisories.length, 17);
  assert.deepEqual(
    advisories.map((entry) => entry.id).sort(),
    [
      'RUSTSEC-2024-0370',
      'RUSTSEC-2024-0411',
      'RUSTSEC-2024-0412',
      'RUSTSEC-2024-0413',
      'RUSTSEC-2024-0414',
      'RUSTSEC-2024-0415',
      'RUSTSEC-2024-0416',
      'RUSTSEC-2024-0417',
      'RUSTSEC-2024-0418',
      'RUSTSEC-2024-0419',
      'RUSTSEC-2024-0420',
      'RUSTSEC-2024-0429',
      'RUSTSEC-2025-0075',
      'RUSTSEC-2025-0080',
      'RUSTSEC-2025-0081',
      'RUSTSEC-2025-0098',
      'RUSTSEC-2025-0100',
    ],
  );

  for (const entry of advisories) {
    assert.match(entry.dependency_path, /tauri|wry|gtk|webkit2gtk|tao|tauri-utils/i, entry.id);
    assert.match(entry.reason, /transitive|Linux|Tauri|GTK|Unicode/i, entry.id);
    assert.match(entry.mitigation, /direct|Tauri|Linux|re-audit|review|smoke/i, entry.id);
    assert.ok(entry.expires_on > '2026-05-13', `${entry.id} must have future expiry`);
    assert.ok(entry.expires_on <= '2026-08-31', `${entry.id} must be short lived`);
  }
});

test('accepted advisory scope is limited to Tauri desktop lockfiles', () => {
  assert.deepEqual(config.tauri_lockfiles.sort(), [
    '../rubric-studio-open/src-tauri/Cargo.lock',
    'templates/tauri-app/src-tauri/Cargo.lock',
  ]);
});
