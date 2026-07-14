import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const scripts = [
  'scripts/sign-windows.ps1',
  'installers/robotics-studio-open/install.ps1',
];

const powershellCacheRoot = mkdtempSync(join(tmpdir(), 'auraone-pwsh-cache-'));

try {
  for (const script of scripts) {
    const command = [
      '$ErrorActionPreference = "Stop"',
      `$tokens = $null; $errors = $null; [System.Management.Automation.Language.Parser]::ParseFile((Resolve-Path '${join(root, script).replaceAll("'", "''")}'), [ref]$tokens, [ref]$errors) > $null`,
      'if ($errors.Count) { throw ($errors | Out-String) }',
    ].join('; ');
    const result = spawnSync('pwsh', ['-NoProfile', '-Command', command], {
      encoding: 'utf8',
      env: {
        ...process.env,
        XDG_CACHE_HOME: powershellCacheRoot,
      },
    });
    if (result.status !== 0) {
      throw new Error(`PowerShell syntax validation failed for ${script}:\n${result.stdout}\n${result.stderr}`);
    }
    console.log(`parsed ${script}`);
  }
} finally {
  rmSync(powershellCacheRoot, { recursive: true, force: true });
}
