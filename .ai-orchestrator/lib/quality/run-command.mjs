// What scripts/run.mjs runs for one script of one app, and the short summary it prints (kit followups before C1, batch
// 2, Phiên 33 · Lượt 59–61). Agents guessed how to run Maven or pnpm on Windows and spent tens of steps on it in every
// run, and read whole logs to find one failure (SHOP-44, SHOP-21 of shop, Pilot 3). Pure.

// A name of an app folder under apps/, or "." for a project of one app at its root; a script name of package.json.
const NAME = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const SCRIPT = /^[A-Za-z0-9][A-Za-z0-9:._-]*$/;

// { app, script, extra, hasPom, manager } → { tool, args }. tool is kit-script (a script of the kit, run with node),
// pnpm or npm; args never go through a shell. A Java app runs through mvnw.mjs, which finds the JDK of its pom.xml;
// extra goes to Maven, or after -- to the script of a JS app.
export function runPlan({ app, script, extra = [], hasPom, manager }) {
  if (!(app === '.' || NAME.test(app ?? ''))) throw new Error(`app ${JSON.stringify(app)} is not the name of a folder under apps/, nor "."`);
  if (!SCRIPT.test(script ?? '')) throw new Error(`script ${JSON.stringify(script)} is not the name of a script of package.json`);
  const dir = app === '.' ? '.' : `apps/${app}`;
  if (hasPom) return { tool: 'kit-script', args: ['mvnw.mjs', dir, script, ...extra] };
  const after = extra.length > 0 ? ['--', ...extra] : [];
  if (manager === 'pnpm') return { tool: 'pnpm', args: [...(app === '.' ? [] : ['--filter', `./${dir}`]), 'run', script, ...after] };
  return { tool: 'npm', args: [...(app === '.' ? [] : ['--workspace', dir]), 'run', script, ...after] };
}

const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*[A-Za-z]`, 'g');
// The lines that count tests or say how the build ended.
const COUNTS = [
  /^\s*Test Files\s+.*\(\d+\)\s*$/, // vitest
  /^\s*Tests\s+.*\(\d+\)\s*$/, // vitest
  /^\s*\d+ (passed|failed|skipped|flaky|did not run)\b/, // Playwright
  /BUILD (SUCCESS|FAILURE)/, // Maven
];
const MAVEN_TOTAL = /^\[(INFO|ERROR|WARNING)\] Tests run: \d+, Failures: \d+, Errors: \d+, Skipped: \d+\s*$/;
// A failing test of vitest or Playwright, an error of Maven or Node, tsc, pnpm and npm. A line that npm or pnpm prints
// to echo the command of the script ("> node -e …") is not one, even when the command holds such a word.
const FAILURE = /(\bFAIL\b|✘|×|✖|\[ERROR\]|AssertionError|\bError:|\berror TS\d+|ERR_PNPM_|npm ERR!|^npm error )/;
const ECHO = /^\s*> /;

// The summary of a run's output: the count lines, the total of Maven, then from the first failure at most `max` lines.
// An empty list when the output has none of them.
export function summarize(output, { max = 40 } = {}) {
  const lines = String(output).replace(ANSI, '').split(/\r?\n/);
  const counts = lines.filter((line) => COUNTS.some((pattern) => pattern.test(line)));
  const totals = lines.filter((line) => MAVEN_TOTAL.test(line));
  const out = [...(totals.length > 0 ? [totals.at(-1)] : []), ...counts];
  const first = lines.findIndex((line) => FAILURE.test(line) && !ECHO.test(line));
  if (first !== -1) out.push('First failure:', ...lines.slice(first, first + max).filter((line) => line.trim() !== ''));
  return out;
}
