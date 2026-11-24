// The policy job of CI (quality-gates spec section 2.4). On a PR: the conventions of its branch, commits and title, the
// suppressions its added lines bring, the thresholds it lowers in quality/gates.yaml, the design.md files it touches
// (agent-roster spec 2.8), and the audit of npm or pnpm, by the lockfile at the root. On a push: the audit only. Results
// go to the job summary in CI.
// In CI the PR comes from the GitHub event; elsewhere: --base <ref> --branch <name> --title "<title>".
import { spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, globSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { parse } from 'yaml';
import { unquotePath } from '../lib/quality/diff-paths.mjs';
import { readGates } from '../lib/quality/gates.mjs';
import { auditArgs, managerFromLockfile, PNPM_MISSING, runManager } from '../lib/quality/package-manager.mjs';
import { checkDesignFile } from '../lib/quality/design-files.mjs';
import { usesProjectCodes } from '../lib/quality/design.mjs';
import { REGISTRY_FILE, checkRegistry, readRegistry } from '../lib/quality/screen-codes.mjs';
import { auditProblems, checkConventions, designFilesToCheck, osvProblems, pomsToScan, scanTries } from '../lib/quality/policy.mjs';
import { addedLines, deletedTests, findSuppressions, loweredThresholds } from '../lib/quality/suppressions.mjs';
import { auditRule, ownPackages, projectDependencies, unapprovedDependencies, workspaceCatalogs } from '../lib/quality/dependencies.mjs';

function run(command, args, options = {}) {
  return spawnSync(command, args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, ...options });
}
function git(...args) {
  const result = run('git', args);
  if (result.status !== 0) throw new Error(`git ${args.join(' ')}: ${result.stderr.trim()}`);
  return result.stdout.trim();
}

// The PR under check, or null on a push.
function pullRequest() {
  const { values } = parseArgs({ options: { base: { type: 'string' }, branch: { type: 'string' }, title: { type: 'string' } } });
  if (values.base) return { base: values.base, baseRef: values.base.replace(/^origin\//, ''), branch: values.branch ?? git('rev-parse', '--abbrev-ref', 'HEAD'), title: values.title ?? '' };
  if (process.env.GITHUB_EVENT_NAME !== 'pull_request') return null;
  const { pull_request: pr } = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
  return { base: pr.base.sha, baseRef: pr.base.ref, branch: pr.head.ref, title: pr.title };
}

const gatesDir = fileURLToPath(new URL('../quality/', import.meta.url));
const sections = [];
const notes = [];
try {
  const gates = readGates(gatesDir);
  const root = git('rev-parse', '--show-toplevel');
  const pr = pullRequest();
  // The project's own file: its approved libraries and its audit exceptions (C1 spec section 5). The kit repo has none.
  const projectFile = join(root, '.ai-orchestrator', 'project.yaml');
  const project = existsSync(projectFile) ? parse(readFileSync(projectFile, 'utf8')) : null;
  const rule = auditRule(gates, project);
  // The paths the PR changes, or null on a push.
  let changed = null;

  if (pr) {
    const base = git('merge-base', pr.base, 'HEAD');
    const commits = git('log', '--format=%h%x09%P%x09%s', `${base}..HEAD`)
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const [sha, parents, ...subject] = line.split('\t');
        return { sha, parents: parents.split(' ').length, subject: subject.join('\t') };
      });
    sections.push(['Conventions', checkConventions({ branch: pr.branch, base: pr.baseRef, commits, title: pr.title })]);

    const diff = git('diff', '-U0', '--no-color', '--no-ext-diff', base, 'HEAD');
    sections.push(['Suppressions', findSuppressions(addedLines(diff), gates.suppressions)]);
    for (const file of deletedTests(diff)) notes.push(`test file deleted: ${file}`);

    const gatesFile = relative(root, join(gatesDir, 'gates.yaml')).replaceAll('\\', '/');
    const before = run('git', ['show', `${base}:${gatesFile}`]);
    sections.push(['Thresholds', before.status === 0 ? loweredThresholds(parse(before.stdout), gates) : []]);

    const changes = git('diff', '--name-status', '--no-renames', base, 'HEAD')
      .split('\n')
      .filter(Boolean)
      .map((line) => ({ status: line[0], path: unquotePath(line.split('\t').at(-1)) }));
    changed = changes.map(({ path }) => path);
    // A direct dependency the PR adds must be approved first, at the plan or by dep-check (C1 spec section 5).
    if (project) {
      // pnpm-workspace.yaml too: its catalogs and overrides name packages (second review of shop PR #79).
      const manifests = changes.filter(({ path }) => /(^|\/)(package\.json|pom\.xml|pnpm-workspace\.yaml)$/.test(path) && !path.split('/').includes('node_modules'));
      const at = (ref, path) => {
        const shown = run('git', ['show', `${ref}:${path}`]);
        return shown.status === 0 ? shown.stdout : '';
      };
      const readJson = (path) => {
        try {
          return JSON.parse(readFileSync(join(root, path), 'utf8'));
        } catch {
          return null;
        }
      };
      // The packages of the project itself: with npm, those inside the workspaces of the root package.json; with pnpm,
      // none, which workspace: links (ownPackages; second review of shop PR #79).
      const own = ownPackages({
        manager: managerFromLockfile((path) => existsSync(join(root, path))),
        packageJson: readJson('package.json'),
        manifests: git('ls-files', '*package.json').split('\n').filter(Boolean).map((path) => ({ path, name: readJson(path)?.name })),
      });
      // A spec catalog: takes its version from the catalogs of pnpm-workspace.yaml at the head.
      const catalogs = workspaceCatalogs(at('HEAD', 'pnpm-workspace.yaml')) ?? {};
      const added = manifests.map(({ status, path }) => ({ path, before: status === 'A' ? '' : at(base, path), after: status === 'D' ? '' : at('HEAD', path) }));
      sections.push(['New dependencies', unapprovedDependencies(added, projectDependencies(project).approved, own, { catalogs })]);
    } else notes.push('no .ai-orchestrator/project.yaml: new dependencies are not checked');
    const designs = designFilesToCheck(changes, (path) => existsSync(join(root, path)));
    // The registry of screen codes, when the PR changes it (tasks/todo.md item 10): one code a screen, declared prefixes,
    // listed here once and not again by each design.md; and D11 of every design.md with project codes, which a retired
    // code or a new route of the registry breaks though the PR does not change it (review of shop PR #98).
    // A deleted or renamed registry counts too: every design.md with project codes then lacks it (independent pass).
    const registryChanged = changes.some(({ path }) => path === REGISTRY_FILE);
    const registryErrors = registryChanged && existsSync(join(root, REGISTRY_FILE)) ? checkRegistry(readRegistry(readFileSync(join(root, REGISTRY_FILE), 'utf8'))).map(({ rule, line, message }) => `${REGISTRY_FILE}:${line} ${rule} ${message}`) : [];
    const coded = registryChanged
      ? globSync('docs/specs/*/design.md', { cwd: root }).map((path) => path.replaceAll('\\', '/')).filter((path) => !designs.includes(path) && usesProjectCodes(readFileSync(join(root, path), 'utf8'))).sort()
      : [];
    const lines = (path, errors) => errors.filter((error) => !(registryChanged && error.registry)).map(({ rule, line, message }) => `${path}:${line} ${rule} ${message}`);
    sections.push(['Design', [
      ...designs.flatMap((path) => lines(path, checkDesignFile(join(root, path)))),
      ...coded.flatMap((path) => lines(path, checkDesignFile(join(root, path)).filter(({ rule }) => rule === 'D11'))),
      ...registryErrors,
    ]]);
  }

  const manager = managerFromLockfile((path) => existsSync(join(root, path)));
  if (manager) {
    // The audit exits non-zero when it finds anything; its JSON is what counts.
    const audit = runManager(manager, auditArgs(manager), { cwd: root, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
    if (audit.error) throw new Error(`${manager} audit: ${manager === 'pnpm' ? PNPM_MISSING : audit.error.message}`);
    const report = JSON.parse(audit.stdout || '{}');
    if (report.error) throw new Error(`${manager} audit: ${report.error.summary ?? report.error.message ?? report.error.code}`);
    sections.push(['Dependencies', auditProblems(report, rule, new Date().toISOString().slice(0, 10))]);
  } else notes.push('no package-lock.json or pnpm-lock.yaml: the audit is skipped');

  // A Java app: osv-scanner on its pom.xml, with the dependencies Maven resolves from Maven Central (project-scaffold
  // part 3, spec 2.3). CI installs the scanner when the repo has apps/*/pom.xml, and OSV_SCANNER names it.
  const poms = globSync('apps/*/pom.xml', { cwd: root }).map((path) => path.replaceAll('\\', '/')).sort();
  if (poms.length > 0) {
    const scanner = process.env.OSV_SCANNER;
    if (!scanner) throw new Error(`${poms.join(', ')}: osv-scanner is not installed, so the Java dependencies are not checked; set OSV_SCANNER to it`);
    const problems = [];
    const scanned = pomsToScan(poms, changed);
    for (const pom of poms.filter((path) => !scanned.includes(path))) notes.push(`${pom}: not scanned, since the PR changes nothing in its app; the push to the base scans it`);
    // Ten seconds before a failed scan is tried again.
    const pause = () => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10_000);
    for (const pom of scanned) {
      // It exits 0 when it finds nothing and 1 when it finds advisories; anything else is a failed scan, tried again.
      const scan = scanTries(() => run(scanner, ['scan', 'source', '--format', 'json', '--data-source', 'native', '--lockfile', pom], { cwd: root }), { pause });
      if (scan.status !== 0 && scan.status !== 1) throw new Error(`osv-scanner on ${pom}: ${`${scan.stderr ?? scan.error?.message ?? ''}`.trim().split('\n').at(-1)}`);
      problems.push(...osvProblems(JSON.parse(scan.stdout || '{}'), rule, new Date().toISOString().slice(0, 10)));
    }
    sections.push(['Java dependencies', problems]);
  }
} catch (error) {
  sections.push(['Policy', [error.message]]);
}

const failed = sections.filter(([, problems]) => problems.length > 0);
for (const [name, problems] of sections) console.log(`${problems.length === 0 ? 'ok' : 'FAIL'}  ${name}${problems.map((p) => `\n      ${p}`).join('')}`);
for (const note of notes) console.log(`note  ${note}`);
if (process.env.GITHUB_STEP_SUMMARY) {
  const lines = sections.map(([name, problems]) => `- ${problems.length === 0 ? '✅' : '❌'} **${name}**${problems.map((p) => `\n  - ${p}`).join('')}`);
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Policy\n\n${[...lines, ...notes.map((n) => `- ℹ️ ${n}`)].join('\n')}\n`);
}
if (failed.length > 0) process.exit(1);
