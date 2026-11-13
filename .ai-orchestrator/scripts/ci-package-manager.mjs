// CI of a project (project-scaffold part 2, spec 2.1): npm or pnpm, by the lockfile at the root of the checkout. For
// pnpm it installs the version packageManager of package.json names, with npm. It appends PM and PM_INSTALL to
// $GITHUB_ENV, so the next steps run `$PM_INSTALL` and `$PM run <script>`; without $GITHUB_ENV it prints them.
//   node .ai-orchestrator/scripts/ci-package-manager.mjs
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { runNpm } from '../lib/quality/npm.mjs';
import { ciPackageManager } from '../lib/quality/package-manager.mjs';

const packageJson = existsSync('package.json') ? JSON.parse(readFileSync('package.json', 'utf8')) : null;
const result = await ciPackageManager({
  exists: (path) => existsSync(path),
  packageJson,
  // npm's own output goes to stderr, never into $GITHUB_ENV.
  installPnpm: (version) => runNpm(['install', '--global', `pnpm@${version}`, '--no-audit', '--no-fund'], { stdio: ['ignore', 2, 2] }).status === 0,
});
if (result.error) {
  console.error(`::error::${result.error}`);
  process.exit(1);
}
const lines = Object.entries(result.env).map(([name, value]) => `${name}=${value}\n`).join('');
if (process.env.GITHUB_ENV) appendFileSync(process.env.GITHUB_ENV, lines);
else process.stdout.write(lines);
console.error(`package manager: ${result.env.PM}`);
