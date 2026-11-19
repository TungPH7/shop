// run.mjs (kit followups before C1, batch 2): runs one script of one app of the project and prints a short summary, the
// counts of tests and the first failure, with the whole output in .ai/tmp/run-<app>-<script>.log. A Java app runs with
// the Maven wrapper and the JDK its pom.xml asks for (mvnw.mjs); a JS app with the package manager of the project, which
// the kit calls without the shell shims that failed in agent sessions (SHOP-44, SHOP-21 of shop, Pilot 3). It runs in
// the foreground until the script ends, and exits with its code. Run it from the project root.
//   node .ai-orchestrator/scripts/run.mjs <app|.> <script> [-- <arguments for the tool>]
// Such as: run.mjs api test -- -Dtest=ProductServiceTest; run.mjs user test -- product-card; run.mjs admin lint
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { managerFromLockfile, runManager } from '../lib/quality/package-manager.mjs';
import { runPlan, summarize } from '../lib/quality/run-command.mjs';

const kitScripts = fileURLToPath(new URL('.', import.meta.url));
const projectDir = process.cwd();
const argv = process.argv.slice(2);
const cut = argv.indexOf('--');
const [app, script] = cut === -1 ? argv : argv.slice(0, cut);
const extra = cut === -1 ? [] : argv.slice(cut + 1);

function fail(message) {
  console.error(`run: ${message}`);
  console.error('usage: node .ai-orchestrator/scripts/run.mjs <app|.> <script> [-- <arguments for the tool>]');
  process.exit(2);
}

if (!app || !script) fail('name the app and the script');
const dir = app === '.' ? projectDir : join(projectDir, 'apps', app);
if (!existsSync(join(dir, 'package.json')) && !existsSync(join(dir, 'pom.xml'))) fail(`${app === '.' ? 'the project' : `apps/${app}`} has no package.json or pom.xml`);
let plan;
try {
  plan = runPlan({ app, script, extra, hasPom: existsSync(join(dir, 'pom.xml')), manager: managerFromLockfile((file) => existsSync(join(projectDir, file))) ?? 'npm' });
} catch (error) {
  fail(error.message);
}

const options = { cwd: projectDir, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 };
const done = plan.tool === 'kit-script'
  ? spawnSync(process.execPath, [join(kitScripts, plan.args[0]), ...plan.args.slice(1)], options)
  : runManager(plan.tool, plan.args, options);
const output = `${done.stdout ?? ''}${done.stderr ?? ''}${done.error ? `\n${done.error.message}` : ''}`;
const logDir = join(projectDir, '.ai', 'tmp');
mkdirSync(logDir, { recursive: true });
const log = join(logDir, `run-${app === '.' ? 'root' : app}-${script.replaceAll(':', '-')}.log`);
writeFileSync(log, output);
const code = done.status ?? 1;
for (const line of summarize(output)) console.log(line);
console.log(`run: ${app} ${script} exited with ${code}. The whole output is in ${log.replaceAll('\\', '/')}`);
process.exit(code);
