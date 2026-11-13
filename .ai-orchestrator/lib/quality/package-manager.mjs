// npm or pnpm (project-scaffold part 2, spec 2.1; plan, decision 3): the one place that knows how the package manager of
// a project installs, runs a script, starts one app and audits. project.yaml names it in package_manager, npm when it
// does not; CI tells them apart by the lockfile at the root. The kit's own packages in .ai-orchestrator/ always use npm.
//
// Both run with no shell, as npm.mjs explains. On Windows pnpm is pnpm.cmd, so its JavaScript entry is run with node:
// pnpm.cjs of a global npm install of pnpm, or pnpm.js of corepack, which takes the version packageManager names.
// Elsewhere, and for a standalone pnpm.exe, plain `pnpm` is run.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { runNpm } from './npm.mjs';

export const MANAGERS = ['npm', 'pnpm'];
const LOCKFILES = { npm: 'package-lock.json', pnpm: 'pnpm-lock.yaml' };

const known = (manager) => {
  if (!MANAGERS.includes(manager)) throw new Error(`package manager ${JSON.stringify(manager)} is not one of ${MANAGERS.join(', ')}`);
  return manager;
};

// The package manager of a project: package_manager of its project.yaml, npm when the file does not say.
export const managerOf = (config) => known(config?.package_manager ?? 'npm');

export const lockfileOf = (manager) => LOCKFILES[known(manager)];

// The package manager whose lockfile sits at the root, or null; pnpm wins when both do. exists(path) is relative to the
// root.
export function managerFromLockfile(exists) {
  return ['pnpm', 'npm'].find((manager) => exists(LOCKFILES[manager])) ?? null;
}

// The version packageManager of package.json pins for pnpm, without its hash: "pnpm@11.8.0+sha512.…" gives "11.8.0".
// null when the field names no pnpm version.
export function pnpmVersion(packageJson) {
  return /^pnpm@(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)(?:\+.*)?$/.exec(packageJson?.packageManager ?? '')?.[1] ?? null;
}

// The arguments that install the packages of the lockfile as it is. ignoreScripts: no install script of any package
// runs, for code that is not yet reviewed (preview, the worktree of qa).
export function installArgs(manager, { ignoreScripts = false } = {}) {
  const skip = ignoreScripts ? ['--ignore-scripts'] : [];
  return known(manager) === 'npm' ? ['ci', ...skip, '--no-audit', '--no-fund'] : ['install', '--frozen-lockfile', ...skip];
}

export function runArgs(manager, script) {
  known(manager);
  return ['run', script];
}

// The command project.yaml writes for the dev script of one app: npm run dev -w apps/web, pnpm --filter ./apps/user run
// dev. Plain words only, so it runs with no shell.
export function devCommand(manager, path, script = 'dev') {
  return known(manager) === 'npm' ? `npm run ${script} -w ${path}` : `pnpm --filter ./${path} run ${script}`;
}

// npm audit and pnpm audit both print their report as JSON with --json, and exit non-zero when they find anything.
export function auditArgs(manager) {
  known(manager);
  return ['audit', '--json'];
}

// The JavaScript entry of pnpm next to node, or undefined: a global npm install of pnpm (node_modules/ next to node on
// Windows, ../lib/node_modules/ elsewhere, or %APPDATA%\npm on Windows), then corepack.
export function pnpmCli(execPath = process.execPath, env = process.env) {
  const dir = dirname(execPath);
  const roots = [join(dir, 'node_modules'), join(dir, '..', 'lib', 'node_modules'), ...(env.APPDATA ? [join(env.APPDATA, 'npm', 'node_modules')] : [])];
  const candidates = [...roots.map((root) => join(root, 'pnpm', 'bin', 'pnpm.cjs')), ...roots.map((root) => join(root, 'corepack', 'dist', 'pnpm.js'))];
  return candidates.find((file) => existsSync(file));
}

// Runs the package manager with no shell. options go to spawnSync. Corepack is told not to ask before it downloads the
// pnpm that packageManager names, since nobody may be there to answer.
export function runManager(manager, args, options = {}) {
  if (known(manager) === 'npm') return runNpm(args, options);
  const env = { ...(options.env ?? process.env), COREPACK_ENABLE_DOWNLOAD_PROMPT: '0' };
  const cli = pnpmCli();
  return cli ? spawnSync(process.execPath, [cli, ...args], { ...options, env }) : spawnSync('pnpm', args, { ...options, env });
}

// The package manager of a project in CI (scripts/ci-package-manager.mjs), by the lockfile at its root: npm when there
// is none, so npm ci says what is missing as before. For pnpm, installPnpm(version) installs the version packageManager
// names and resolves to whether it did. Returns { env } with PM, the command, and PM_INSTALL, how it installs the
// lockfile as it is; or { error }.
export async function ciPackageManager({ exists, packageJson, installPnpm }) {
  const manager = managerFromLockfile(exists) ?? 'npm';
  if (manager === 'pnpm') {
    const version = pnpmVersion(packageJson);
    if (!version) return { error: 'the repo has pnpm-lock.yaml, but package.json names no pnpm version in packageManager, such as "pnpm@11.8.0"' };
    if (!(await installPnpm(version))) return { error: `npm install --global pnpm@${version} failed` };
  }
  return { env: { PM: manager, PM_INSTALL: [manager, ...installArgs(manager)].join(' ') } };
}

// What to tell someone whose machine has no pnpm the kit can run.
export const PNPM_MISSING = 'pnpm was not found: install the version packageManager of package.json names, with npm install -g pnpm@<version>, or turn on corepack with corepack enable';
