import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

const root = resolve(process.argv[2] ?? process.cwd());
const platformScripts = 'opensource/open-studio-platform/scripts';
const blockedScripts = new Map([
  ['sign-macos.sh', [`${platformScripts}/sign-macos.sh`]],
  ['notarize.sh', [`${platformScripts}/notarize.sh`]],
  [
    'sign-and-notarize-macos.sh',
    [`${platformScripts}/sign-macos.sh`, `${platformScripts}/notarize.sh`],
  ],
  ['sign-windows.ps1', [`${platformScripts}/sign-windows.ps1`]],
  ['sign-linux.sh', [`${platformScripts}/sign-linux.sh`]],
]);
const blockedNames = new Set(blockedScripts.keys());
const wrapperPaths = new Set([...blockedScripts.values()].flat());
const ignored = new Set(['.git', 'node_modules', 'target', 'dist', 'build', '.next', '.docusaurus']);
const workflowExtensions = new Set(['.yml', '.yaml']);

function walk(directory, files = []) {
  for (const entry of readdirSync(directory)) {
    if (ignored.has(entry)) continue;
    const path = join(directory, entry);
    const status = statSync(path);
    if (status.isDirectory()) {
      walk(path, files);
    } else {
      files.push(path);
    }
  }
  return files;
}

function normalized(path) {
  return path.split(sep).join('/');
}

const files = walk(root);
const copiedScripts = [];
const workflowViolations = [];

for (const file of files) {
  const rel = normalized(relative(root, file));
  const basename = rel.split('/').at(-1);
  if (blockedNames.has(basename) && !wrapperPaths.has(rel)) {
    copiedScripts.push(rel);
  }

  if (!rel.includes('/workflows/') || !workflowExtensions.has(rel.slice(rel.lastIndexOf('.')))) {
    continue;
  }

  const body = readFileSync(file, 'utf8');
  for (const name of blockedNames) {
    if (!body.includes(name)) continue;
    const wrappers = blockedScripts.get(name);
    if (!wrappers.some((wrapper) => body.includes(wrapper))) {
      workflowViolations.push(
        `${rel}: references ${name} without ${wrappers.join(' or ')}`,
      );
    }
  }
}

if (copiedScripts.length || workflowViolations.length) {
  for (const path of copiedScripts) {
    console.error(`Copied signing script is not allowed: ${path}`);
  }
  for (const violation of workflowViolations) {
    console.error(`Workflow must call platform signing wrapper: ${violation}`);
  }
  process.exit(1);
}

console.log('Signing wrapper usage verified.');
