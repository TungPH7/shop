// Libraries approved before they are installed (C1 spec section 5): the list `dependencies.approved` of the project's
// .ai-orchestrator/project.yaml, a protected file the kit copy leaves alone, with the project's own audit exceptions
// beside it. The policy job, gh-guard and dep-check read it through these. Pure.
import { rangeWithin } from './version-range.mjs';

export const ECOSYSTEMS = ['npm', 'maven'];

// The dependencies block of a project.yaml config: { approved, exceptions }, empty when it has none.
export function projectDependencies(config) {
  const block = config?.dependencies ?? {};
  return { approved: block.approved ?? [], exceptions: block.exceptions ?? [] };
}

// The audit rule of the policy job: the kit's level and exceptions, with the project's exceptions added. A kit copy no
// longer wipes them, as it wiped the picomatch exception of shop at SHOP-74.
export function auditRule(gates, config) {
  return { ...gates.dependencies, exceptions: [...(gates.dependencies.exceptions ?? []), ...projectDependencies(config).exceptions] };
}

// Whether `name` of `ecosystem` is on the approved list (approvalOf, below).
export const isApproved = (approved, ecosystem, name) => Boolean(approvalOf(approved, ecosystem, name));

const NPM_FIELDS = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'];

// The direct dependencies a package.json names, or [] for a text that is not JSON.
export function packageJsonDependencies(text) {
  let json;
  try {
    json = JSON.parse(text ?? '');
  } catch {
    return [];
  }
  return [...new Set(NPM_FIELDS.flatMap((field) => Object.keys(json?.[field] ?? {})))].sort();
}

// The groupId:artifactId of each <dependency> of a pom.xml, those in <dependencyManagement> and <plugins> included, as
// written: a coordinate that takes a ${property} is kept as it reads.
export function pomDependencies(text) {
  const found = new Set();
  for (const [, block] of String(text ?? '').replace(/<!--[\s\S]*?-->/g, '').matchAll(/<dependency>([\s\S]*?)<\/dependency>/g)) {
    const group = /<groupId>\s*([^<\s]+)\s*<\/groupId>/.exec(block)?.[1];
    const artifact = /<artifactId>\s*([^<\s]+)\s*<\/artifactId>/.exec(block)?.[1];
    if (group && artifact) found.add(`${group}:${artifact}`);
  }
  return [...found].sort();
}

// The direct dependencies a change adds: in `after`, not in `before` (the same file at the base, or '' for a new file).
// A version change of a dependency already there is not new: audit and osv-scanner check it.
export function addedDependencies({ path, before = '', after = '' }) {
  const read = /(^|\/)pom\.xml$/.test(path) ? pomDependencies : /(^|\/)package\.json$/.test(path) ? packageJsonDependencies : null;
  if (!read) return [];
  const was = new Set(read(before));
  return read(after).filter((name) => !was.has(name)).map((name) => ({ ecosystem: read === pomDependencies ? 'maven' : 'npm', name }));
}

// The entry of `name` on the approved list, or undefined. A Maven name is groupId:artifactId; npm names compare in
// lower case, as the registry keeps them.
export function approvalOf(approved, ecosystem, name) {
  const key = ecosystem === 'npm' ? String(name).toLowerCase() : String(name);
  return approved.find((entry) => entry.ecosystem === ecosystem && (ecosystem === 'npm' ? entry.name.toLowerCase() : entry.name) === key);
}

// Where a spec of a package.json takes a package from (review of shop PR #79): 'registry' for a version, a range or a
// tag; 'workspace' for workspace: and catalog: of pnpm, the project's own packages and versions; 'other' for anything
// else, such as an alias npm:evil@1, git, github:x/y, a URL, file:, link: or a path, none of which dep-check checked.
// A registry spec never holds a colon or a slash; a path starts with a dot.
export function specSource(spec) {
  const text = String(spec ?? '').trim();
  if (/^(?:workspace|catalog):/.test(text)) return 'workspace';
  return /[:/\\]/.test(text) || text.startsWith('.') ? 'other' : 'registry';
}

// The specs of a package.json: [{ key, name, spec, dependency }], those of its dependency fields and of the overrides
// of npm, pnpm and yarn, which can point a name at another package too. [] for an empty text (a file deleted), null for
// a text that is not JSON.
function packageJsonEntries(text) {
  if (String(text ?? '').trim() === '') return [];
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    return null;
  }
  const entries = NPM_FIELDS.flatMap((field) => Object.entries(json?.[field] ?? {}).map(([name, spec]) => ({ key: `${field}:${name}`, name, spec: String(spec), dependency: true })));
  // npm overrides nest: { "react": { "scheduler": "1.0.0", ".": "19.0.0" } }.
  const overrides = (value, at) => (value && typeof value === 'object' ? Object.entries(value).flatMap(([name, inner]) => overrides(inner, `${at}>${name}`)) : [{ key: at, name: at.split('>').filter((part) => part !== '.').slice(1).join('>'), spec: String(value), dependency: false }]);
  for (const [field, value] of [['overrides', json?.overrides], ['pnpm.overrides', json?.pnpm?.overrides], ['resolutions', json?.resolutions]]) {
    if (value && typeof value === 'object') entries.push(...overrides(value, field));
  }
  return entries;
}

// The problems of one change of a package.json or a pom.xml, for the policy job and gh-guard (C1 spec section 5):
// a new direct dependency not on the approved list; a spec that points away from the registry, new or changed; and a
// new approved npm dependency whose spec is not inside the range dep-check approved (review of shop PR #79). A version
// change of a dependency already there is not new: audit and osv-scanner check it. own: the names of the project's own
// packages, which are not libraries.
export function dependencyProblems({ path, before = '', after = '' }, approved, own = []) {
  const notApproved = (ecosystem, name) => `${path}: ${name} (${ecosystem}) is new and not on dependencies.approved of project.yaml: run node .ai-orchestrator/scripts/dep-check.mjs ${ecosystem} ${name}@<version> first`;
  if (/(^|\/)pom\.xml$/.test(path)) {
    return addedDependencies({ path, before, after })
      .filter(({ name }) => !/\$\{/.test(name) && !isApproved(approved, 'maven', name))
      .map(({ name }) => notApproved('maven', name));
  }
  if (!/(^|\/)package\.json$/.test(path)) return [];
  const now = packageJsonEntries(after);
  if (now === null) return [`${path} is no JSON after this change, so its dependencies cannot be read: write it whole, as valid JSON`];
  const was = packageJsonEntries(before) ?? [];
  const wasSpec = new Map(was.map(({ key, spec }) => [key, spec]));
  const wasName = new Set(was.filter(({ dependency }) => dependency).map(({ name }) => name));
  const problems = [];
  for (const { key, name, spec, dependency } of now) {
    if (wasSpec.get(key) === spec) continue;
    const source = specSource(spec);
    if (source === 'other') {
      problems.push(`${path}: ${name} points to ${spec}, which is no version of the registry: install libraries by name, after dep-check (C1 spec section 5)`);
      continue;
    }
    if (source === 'workspace' || !dependency || wasName.has(name) || own.includes(name)) continue;
    const approval = approvalOf(approved, 'npm', name);
    if (!approval) {
      problems.push(notApproved('npm', name));
      continue;
    }
    const within = rangeWithin(spec, approval.range);
    if (within === false) problems.push(`${path}: ${name} asks for ${spec}, outside ${approval.range}, the range dep-check approved: ask for a version inside it, or run dep-check on the new one`);
    else if (within === null) problems.push(`${path}: ${name} asks for ${spec}, which cannot be checked against ${approval.range}, the range dep-check approved: write a version or a range inside it`);
  }
  return problems;
}

// The problems of the policy job for the dependencies a PR changes. changes: [{ path, before, after }] of the
// package.json and pom.xml files the PR changes.
export function unapprovedDependencies(changes, approved, own = []) {
  return changes.flatMap((change) => dependencyProblems(change, approved, own));
}

// The verdict of dep-check from what it read about one version of a library (C1 spec section 5): { ok, problems,
// notes }. facts: { vulnerabilities: [ids], license, published (ISO), downloads (a week, or null for Maven),
// maintainers (count, or null), installScripts: [names], provenance (true, false, or null when the registry has no such
// thing), errors: [what could not be read] }. A check that could not be read makes the verdict "suspicious", never "ok".
export const MIN_AGE_DAYS = 14;
export const MIN_WEEKLY_DOWNLOADS = 1000;
export function depVerdict(facts, { licenses, today }) {
  const problems = [];
  const notes = [];
  for (const error of facts.errors ?? []) problems.push(`could not read ${error}`);
  if (facts.vulnerabilities?.length > 0) problems.push(`known vulnerabilities: ${facts.vulnerabilities.join(', ')}`);
  if (!facts.license) problems.push('no license');
  else if (!licenseAllowed(facts.license, licenses)) problems.push(`license ${facts.license} is not on dependencies.licenses of quality/gates.yaml`);
  if (facts.published) {
    const days = Math.floor((Date.parse(today) - Date.parse(facts.published)) / 86400000);
    if (days < MIN_AGE_DAYS) problems.push(`published ${days} days ago, less than ${MIN_AGE_DAYS}`);
  }
  if (facts.downloads != null && facts.downloads < MIN_WEEKLY_DOWNLOADS) problems.push(`${facts.downloads} downloads last week, fewer than ${MIN_WEEKLY_DOWNLOADS}`);
  if (facts.maintainers === 0) problems.push('no maintainer listed');
  else if (facts.maintainers === 1) notes.push('one maintainer');
  if (facts.installScripts?.length > 0) problems.push(`runs scripts at install: ${facts.installScripts.join(', ')}`);
  if (facts.provenance === false) notes.push('no npm provenance');
  return { ok: problems.length === 0, problems, notes };
}

// An SPDX expression is allowed when one of its OR branches has only allowed licenses.
export function licenseAllowed(expression, licenses) {
  const branches = String(expression).replace(/[()]/g, ' ').split(/\s+OR\s+/i);
  return branches.some((branch) => branch.split(/\s+AND\s+/i).map((id) => id.trim()).filter(Boolean).every((id) => licenses.includes(id)));
}

// The libraries a package-manager command installs or runs, for gh-guard (C1 spec section 5): [{ ecosystem, name,
// version, run }]; [{ refused }] for what is no registry package (a path, a URL, git, an alias such as
// zod@npm:evil-pkg), and [{ refused, registry: true }] for another registry; or null for a command that installs and
// downloads no named library, such as `pnpm install` or `npm ci`, which take the lockfile. run: npx, npm exec and the
// dlx of pnpm, yarn and bun download a package the project does not have, and run it (review of shop PR #79).
// program: the name of the program, such as npm; args: the words after it; env: the VAR=value words before it.
const INSTALL_VERBS = {
  npm: ['install', 'i', 'in', 'ins', 'inst', 'insta', 'instal', 'isnt', 'isnta', 'isntal', 'isntall', 'add'],
  pnpm: ['add', 'install', 'i'],
  yarn: ['add'],
  bun: ['add', 'install', 'i'],
};
const RUN_VERBS = { npm: ['exec', 'x'], pnpm: ['dlx'], yarn: ['dlx'], bun: ['x'] };
const RUNNERS = ['npx', 'bunx'];
// Options that take the next word as their value, before or after the verb.
const VALUE_OPTIONS = ['-F', '--filter', '-C', '--dir', '--prefix', '-w', '--workspace', '--cwd', '--tag'];
const MAVEN = ['mvn', 'mvnw', 'mvn.cmd', 'mvnw.cmd'];
// Another registry, by an option or a variable of the package manager: what dep-check read is the package of the
// project's registry, not one of the same name elsewhere.
const REGISTRY_OPTION = /^--(?:@[\w.-]+:)?registry(?:=|$)|^-D(?:remoteRepositories|repoUrl)=/;
const REGISTRY_VARIABLE = /^(?:npm_config_|yarn_|bun_config_)\S*registry\S*=/i;

export function installTargets(program, args, { env = [] } = {}) {
  let targets;
  if (MAVEN.includes(program)) targets = mavenTargets(args);
  else if (RUNNERS.includes(program) || isRunVerb(program, args)) targets = runTargets(program, args);
  else targets = npmTargets(program, args);
  if (targets === undefined) return null;
  const registry = [...env.filter((word) => REGISTRY_VARIABLE.test(word)), ...args.filter((word) => REGISTRY_OPTION.test(word))][0];
  return registry ? [{ refused: registry, registry: true }] : targets;
}

// One word of a command as a package of the registry: { ecosystem, name, version }, or { refused } when the part after
// the name is a source of its own, such as npm:, github:, a URL or a path. A scope keeps its @: @nestjs/core@11 is
// @nestjs/core at 11.
function packageOf(word) {
  const at = word.startsWith('@') ? word.indexOf('@', 1) : word.indexOf('@');
  const name = at < 0 ? word : word.slice(0, at);
  const version = at < 0 ? undefined : word.slice(at + 1);
  if (!/^(@[\w.-]+\/)?[\w.-]+$/.test(name) || (version !== undefined && (version === '' || /[:/\\]/.test(version)))) return { refused: word };
  return { ecosystem: 'npm', name, ...(version !== undefined && { version }) };
}

// undefined: the command installs nothing. null: it installs what the lockfile names.
function mavenTargets(args) {
  if (!args.some((word) => /^dependency:/.test(word))) return undefined;
  const artifact = args.map((word) => /^-Dartifact=(.+)$/.exec(word)?.[1]).find(Boolean);
  if (!artifact) return null;
  const [group, name, version] = artifact.split(':');
  return group && name ? [{ ecosystem: 'maven', name: `${group}:${name}`, ...(version && { version }) }] : [{ refused: artifact }];
}

function npmTargets(program, args) {
  const verbs = INSTALL_VERBS[program];
  if (!verbs) return undefined;
  let i = 0;
  while (i < args.length && args[i].startsWith('-')) i += VALUE_OPTIONS.includes(args[i]) ? 2 : 1;
  // yarn 1 installs for the whole machine with yarn global add.
  if (program === 'yarn' && args[i] === 'global') i += 1;
  if (!verbs.includes(args[i])) return undefined;
  const targets = [];
  for (let j = i + 1; j < args.length; j++) {
    const word = args[j];
    if (word.startsWith('-')) {
      if (VALUE_OPTIONS.includes(word)) j++;
      continue;
    }
    targets.push(packageOf(word));
  }
  return targets.length > 0 ? targets : null;
}

// npm exec, npm x and the dlx of a package manager, after its options.
function isRunVerb(program, args) {
  const verb = args.find((word) => !word.startsWith('-'));
  return RUN_VERBS[program]?.includes(verb) ?? false;
}

// The packages npx, npm exec or a dlx downloads: those of --package, else the command. null with --no, which runs only
// what the project has.
function runTargets(program, args) {
  const packages = [];
  let j = 0;
  const option = (word) => {
    const given = /^--package=(.+)$/.exec(word)?.[1];
    if (given) packages.push(given);
    else if (word === '-p' || word === '--package') packages.push(args[++j]);
  };
  if (!RUNNERS.includes(program)) {
    for (; j < args.length && args[j].startsWith('-'); j++) option(args[j]);
    j++;
  }
  let downloads = true;
  for (; j < args.length; j++) {
    const word = args[j];
    if (word === '--') {
      j++;
      break;
    }
    if (!word.startsWith('-')) break;
    if (['--no', '--no-install', '--offline'].includes(word)) downloads = false;
    option(word);
  }
  if (!downloads) return null;
  if (packages.length === 0 && j < args.length) packages.push(args[j]);
  return packages.length > 0 ? packages.filter(Boolean).map((word) => ({ ...packageOf(word), run: true })) : null;
}

// Why gh-guard refuses an install or a run, or null. approved: the list of project.yaml; tools: what the kit itself
// runs with npx, such as playwright-cli (dependencies.tools of quality/gates.yaml). A version given must be inside the
// range of its entry (review of shop PR #79).
export function installRefusal(targets, approved, { tools = [] } = {}) {
  if (!targets) return null;
  const odd = targets.find(({ refused }) => refused);
  if (odd?.registry) return `${odd.refused}: install and run packages only from the registry of the project, the one dep-check read (C1 spec section 5)`;
  if (odd) return `${odd.refused} is no package of the registry: install libraries by name, after dep-check (C1 spec section 5)`;
  const entryOf = ({ ecosystem, name, run }) => approvalOf(approved, ecosystem, name) ?? (run ? approvalOf(tools, ecosystem, name) : undefined);
  const missing = targets.filter((target) => !entryOf(target));
  if (missing.length > 0) {
    const [first] = missing;
    const names = `${missing.map(({ name }) => name).join(', ')} ${missing.length > 1 ? 'are' : 'is'} not on dependencies.approved of project.yaml`;
    const check = `node .ai-orchestrator/scripts/dep-check.mjs ${first.ecosystem} ${first.name}@<version>`;
    if (first.run) return `${names}, and npx, npm exec or a dlx downloads it when the project does not have it: run what the project has with pnpm exec or npx --no, or run ${check} first (C1 spec section 5)`;
    return `${names}: run ${check} first, and install it once it passes (C1 spec section 5)`;
  }
  for (const target of targets) {
    const entry = entryOf(target);
    if (target.version === undefined || !entry.range || target.version === entry.range) continue;
    const within = rangeWithin(target.version, entry.range);
    const spec = `${target.name}@${target.version}`;
    if (within === false) return `${spec} is outside ${entry.range}, the range dep-check approved: install a version inside it, or run dep-check on the new one first (C1 spec section 5)`;
    if (within === null) return `${spec} cannot be checked against ${entry.range}, the range dep-check approved: give a version inside it, such as ${target.name}@<x.y.z>`;
  }
  return null;
}

// The libraries of the "New Libraries" section of a plan.md (templates/plan.md): [{ ecosystem, spec, why }], one per line
// "- <npm | maven> <name>@<version>: <why>". A line of another shape is left out.
export function planLibraries(plan) {
  const section = /^## New Libraries[ \t]*\r?\n([\s\S]*?)(?=^## |(?![\s\S]))/m.exec(String(plan ?? ''))?.[1] ?? '';
  return section
    .replace(/<!--[\s\S]*?-->/g, '')
    .split(/\r?\n/)
    .map((line) => /^\s*[-*]\s+(npm|maven)\s+(\S+@\S+?):?\s*(?::\s*(.*))?$/.exec(line.replace(/`/g, '')))
    .filter(Boolean)
    .map(([, ecosystem, spec, why]) => ({ ecosystem, spec: spec.replace(/:$/, ''), why: (why ?? '').trim() }));
}
