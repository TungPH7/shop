// Coverage of the lines a PR adds or changes (quality-gates spec section 2.4): the lcov files of the tests intersected
// with a zero-context git diff. Only lines lcov lists count, since only those can run. Pure: scripts/coverage-diff.mjs
// runs git and finds the lcov files.
import { diffLines } from './diff-paths.mjs';
import { matchesGlob } from './glob.mjs';

const slashes = (path) => path.replaceAll('\\', '/');
const isAbsolute = (path) => /^(?:[A-Za-z]:)?\//.test(path);

// A path with forward slashes and without `.` or `..` segments.
function normalize(path) {
  const parts = [];
  for (const part of slashes(path).split('/')) {
    if (part === '..' && parts.length > 0 && parts.at(-1) !== '..') parts.pop();
    else if (part !== '.' && (part !== '' || parts.length === 0)) parts.push(part);
  }
  return parts.join('/');
}

// The path inside the repository, or null for a file outside it.
function inside(path, root) {
  const base = `${normalize(root).replace(/\/$/, '')}/`;
  return path.toLowerCase().startsWith(base.toLowerCase()) ? path.slice(base.length) : null;
}

// { file: Map(line, hits) } of one lcov file. A relative SF is relative to the package that ran the tests, which is the
// folder holding the lcov file's coverage folder; `lcovDir` is that package folder.
export function parseLcov(text, { lcovDir, root }) {
  const files = new Map();
  let hits = null;
  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith('SF:')) {
      const source = slashes(line.slice(3));
      const file = inside(normalize(isAbsolute(source) ? source : `${lcovDir}/${source}`), root);
      hits = file === null ? null : (files.get(file) ?? new Map());
      if (file !== null) files.set(file, hits);
    } else if (line.startsWith('DA:') && hits) {
      const [number, count] = line.slice(3).split(',').map(Number);
      hits.set(number, Math.max(hits.get(number) ?? 0, count));
    } else if (line === 'end_of_record') hits = null;
  }
  return files;
}

// { file: Map(line, hits) } of the JaCoCo XML report of one Java app (project-scaffold part 3, spec 2.3). A sourcefile
// sits in src/main/java/<package>/ of the app; the hits of a line are its covered instructions, so 0 means not run.
// appDir: the app folder, from the root of the repo.
export function parseJacoco(text, { appDir, sourceRoot = 'src/main/java' }) {
  const files = new Map();
  for (const [, pkg, body] of text.matchAll(/<package name="([^"]*)">([\s\S]*?)<\/package>/g)) {
    for (const [, name, lines] of body.matchAll(/<sourcefile name="([^"]+)">([\s\S]*?)<\/sourcefile>/g)) {
      const hits = new Map();
      for (const [, nr, ci] of lines.matchAll(/<line nr="(\d+)" mi="\d+" ci="(\d+)"/g)) hits.set(Number(nr), Number(ci));
      files.set(normalize([appDir, sourceRoot, pkg, name].filter(Boolean).join('/')), hits);
    }
  }
  return files;
}

// The coverage_exclude of each app in project.yaml, from the root of the repo: a glob of the app folder gets its path
// in front. project.yaml is a protected path, so only a PR you merge widens these (project-scaffold part 3, spec 2.3).
export function projectCoverageExcludes(config) {
  return Object.values(config?.apps ?? {}).flatMap((app) => (app.coverage_exclude ?? []).map((glob) => `${app.path.replace(/\/$/, '')}/${glob}`));
}

// { file: [line numbers] } added or changed in the new version, from `git diff -U0`. Deleted files have none. A path git
// quotes is read as it is on disk.
export function changedLines(diff) {
  const changed = new Map();
  let lines = null;
  for (const part of diffLines(diff)) {
    if (part.kind === 'file') lines = null;
    else if (part.kind === 'header' && part.side === '+++') {
      lines = part.path === null ? null : [];
      if (lines) changed.set(part.path, lines);
    } else if (part.kind === 'hunk' && lines) {
      for (let n = part.start; n < part.start + part.count; n++) lines.push(n);
    }
  }
  return changed;
}

// A Java source with no code to run, which JaCoCo leaves out of its report (project-scaffold part 3, T20):
// package-info.java, module-info.java, or interfaces and annotations whose methods have no body and whose fields need
// no initializer to run. A class, an enum or a record always has code. Comments and strings are dropped first, so a
// brace in a query or a Javadoc does not count.
export function javaHasNoCode(file, text) {
  const name = file.split('/').at(-1);
  if (name === 'package-info.java' || name === 'module-info.java') return true;
  if (typeof text !== 'string') return false;
  const code = text
    .replace(/"""[\s\S]*?"""/g, '""')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\/\/.*$/gm, ' ')
    .replace(/"(?:\\.|[^"\\\n])*"/g, '""')
    .replace(/'(?:\\.|[^'\\\n])'/g, "''");
  if (/(^|[^.\w])(class|enum|record)\s+[A-Za-z_$]/.test(code)) return false;
  if (!/(^|[^.\w])@?interface\s+[A-Za-z_$]/.test(code)) return false;
  // A method body, a static block, a lambda or an object made in a field initializer is code.
  return !/\)\s*(throws\s+[\w.<>,\s]+)?\{|\bstatic\s*\{|->|\bnew\s+[A-Za-z_$]/.test(code);
}

// coverage: the coverage block of quality/gates.yaml. read(file), when given, is the text of a changed file, so a
// Java file with no code to run is not asked for in a report.
export function changedLineCoverage({ changed, lcov, coverage, read }) {
  const counted = (file) => coverage.source.some((glob) => matchesGlob(glob, file)) && !coverage.exclude.some((glob) => matchesGlob(glob, file));
  const files = [];
  const problems = [];
  for (const [file, lines] of changed) {
    if (!counted(file)) continue;
    const hits = lcov.get(file);
    if (!hits) {
      if (read && file.endsWith('.java') && javaHasNoCode(file, read(file))) continue;
      problems.push(`${file} is not in any coverage report: the coverage of the tests must include every source file`);
      continue;
    }
    const runnable = lines.filter((line) => hits.has(line));
    if (runnable.length === 0) continue;
    const uncovered = runnable.filter((line) => hits.get(line) === 0);
    files.push({ file, covered: runnable.length - uncovered.length, total: runnable.length, uncovered });
  }
  const covered = files.reduce((sum, f) => sum + f.covered, 0);
  const total = files.reduce((sum, f) => sum + f.total, 0);
  const percent = total === 0 ? 100 : Math.round((covered / total) * 1000) / 10;
  if (percent < coverage.changed_lines_min) problems.push(`changed lines covered: ${percent}% (${covered} of ${total}), below ${coverage.changed_lines_min}%`);
  return { ok: problems.length === 0, percent, covered, total, files, problems };
}
