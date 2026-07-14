import { spawnSync } from 'node:child_process';

const commands = [
  ['node', ['scripts/verify-platform-contracts.mjs']],
  ['node', ['--test', 'tests/platform-contracts.test.mjs', 'tests/intake_roles_test.mjs']],
  ['pnpm', ['run', 'typecheck']],
  ['cargo', ['test', '--workspace']],
];

for (const [command, args] of commands) {
  const result = spawnSync(command, args, {
    cwd: new URL('..', import.meta.url),
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log('Open Studio Platform verification passed.');
