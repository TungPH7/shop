// The pre-commit hook (quality-gates spec section 2.3): secretlint on the staged text of every added or changed file,
// then the Suppressions check of the policy job on the staged lines, then the project's own precommit script, run with
// npm or pnpm, where project-scaffold puts the lint of staged files for its stack.
// Usage, from kit/.githooks/pre-commit: node .ai-orchestrator/scripts/pre-commit.mjs
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createEngine } from '@secretlint/node';
import { managerFromLockfile, runManager } from '../lib/quality/package-manager.mjs';
import { scanStaged } from '../lib/quality/pre-commit.mjs';
import { readGates } from '../lib/quality/gates.mjs';
import { addedLines, findSuppressions } from '../lib/quality/suppressions.mjs';

const git = (...args) => spawnSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const root = git('rev-parse', '--show-toplevel').stdout.trim();
const files = git('diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z').stdout.split('\0').filter(Boolean);

const engine = await createEngine({
  cwd: root,
  formatter: 'stylish',
  color: false,
  maskSecrets: true,
  configFileJSON: { rules: [{ id: '@secretlint/secretlint-rule-preset-recommend' }] },
});
const scan = await scanStaged({ files, read: (file) => git('show', `:${file}`).stdout, lint: engine.executeOnContent });
if (!scan.ok) {
  console.error(scan.output);
  console.error('pre-commit: a staged file holds a secret. Remove it, keep it in an environment variable, and stage again.');
  process.exit(1);
}

// The Suppressions check of the policy job, on the staged lines (kit followups before C1, batch 2): it went red after a
// push three times on shop (PR #30, #38, #62), each time a CI round and a /ao-fix run. The gates of the project copy,
// next to this script.
const gates = readGates(fileURLToPath(new URL('../quality', import.meta.url)));
const staged = git('diff', '--cached', '--unified=0', '--no-color', '--no-ext-diff', '--diff-filter=ACMR').stdout;
const suppressed = findSuppressions(addedLines(staged), gates.suppressions);
if (suppressed.length > 0) {
  for (const line of suppressed) console.error(line);
  console.error(`pre-commit: a staged line switches a check off. Put "${gates.suppressions.reason_marker} <why>" on the same line, or remove it (docs/quality-gates.md).`);
  process.exit(1);
}

const packageFile = join(root, 'package.json');
const scripts = existsSync(packageFile) ? (JSON.parse(readFileSync(packageFile, 'utf8')).scripts ?? {}) : {};
if (scripts.precommit) {
  // npm or pnpm, by the lockfile at the root (project-scaffold part 2, spec 2.1).
  const manager = managerFromLockfile((path) => existsSync(join(root, path))) ?? 'npm';
  const run = runManager(manager, ['run', 'precommit'], { cwd: root, stdio: 'inherit' });
  if (run.status !== 0) {
    console.error(`pre-commit: the project's precommit script failed (exit ${run.status})`);
    process.exit(1);
  }
}
