import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, normalize } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const repoRoot = new URL('../../..', import.meta.url).pathname;
const configPath = join(root, 'configs/cargo-audit/accepted-advisories.json');
const config = JSON.parse(readFileSync(configPath, 'utf8'));
const today = process.env.AURAONE_AUDIT_DATE ?? new Date().toISOString().slice(0, 10);
const noFetch = process.argv.includes('--no-fetch');

function fail(message) {
  console.error(message);
  process.exit(1);
}

function validateAcceptedAdvisories() {
  const ids = new Set();
  for (const entry of config.accepted ?? []) {
    if (!/^RUSTSEC-\d{4}-\d{4}$/.test(entry.id)) {
      fail(`invalid advisory id: ${entry.id}`);
    }
    if (ids.has(entry.id)) {
      fail(`duplicate accepted advisory: ${entry.id}`);
    }
    ids.add(entry.id);
    for (const field of ['reason', 'mitigation', 'dependency_path']) {
      if (!entry[field] || String(entry[field]).trim().length < 12) {
        fail(`accepted advisory ${entry.id} is missing ${field}`);
      }
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.expires_on)) {
      fail(`accepted advisory ${entry.id} has invalid expires_on: ${entry.expires_on}`);
    }
    if (entry.expires_on < today) {
      fail(`accepted advisory ${entry.id} expired on ${entry.expires_on}`);
    }
  }
  if (ids.size < 17) {
    fail(`expected the Tauri GTK/WebKit advisory register to cover 17 advisories, found ${ids.size}`);
  }
  return [...ids].sort();
}

function runCargoAudit(lockfile, ignoredIds) {
  const args = [
    'audit',
    '--file',
    lockfile,
    '-D',
    'warnings',
    '-D',
    'unmaintained',
    '-D',
    'unsound',
    '-D',
    'yanked',
  ];
  if (noFetch) {
    args.push('--no-fetch');
  }
  for (const id of ignoredIds) {
    args.push('--ignore', id);
  }
  console.log(`cargo ${args.join(' ')}`);
  const result = spawnSync('cargo', args, {
    cwd: repoRoot,
    stdio: 'inherit',
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const acceptedIds = validateAcceptedAdvisories();
const platformLock = join(root, 'Cargo.lock');
if (!existsSync(platformLock)) {
  fail(`missing platform lockfile: ${platformLock}`);
}
runCargoAudit(platformLock, []);

for (const relative of config.tauri_lockfiles ?? []) {
  const lockfile = normalize(join(root, relative));
  if (!existsSync(lockfile)) {
    console.warn(`Skipping missing Tauri lockfile: ${relative}`);
    continue;
  }
  runCargoAudit(lockfile, acceptedIds);
}

console.log(`cargo-audit passed; ${acceptedIds.length} Tauri GTK/WebKit advisories are accepted until re-review.`);
