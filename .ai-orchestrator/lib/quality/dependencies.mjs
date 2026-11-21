// Libraries approved before they are installed (C1 spec section 5): the list `dependencies.approved` of the project's
// .ai-orchestrator/project.yaml, a protected file the kit copy leaves alone, with the project's own audit exceptions
// beside it. The policy job, gh-guard and dep-check read it through these. Pure.
import { parse } from 'yaml';
import { matchesGlob } from './glob.mjs';
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

// The groupId:artifactId of each artifact a pom.xml makes Maven download (second review of shop PR #79): every
// <dependency>, those in <dependencyManagement> and in a plugin included, every <plugin> (its groupId is
// org.apache.maven.plugins when it has none), every build <extension>, the <parent> and each <path> of the
// annotationProcessorPaths of the compiler, however the tag is written.
// A ${property} is read from the <properties> of the pom and from its own or its parent's groupId; one it does not set
// is kept as it reads.
const POM_ARTIFACTS = ['dependency', 'plugin', 'extension', 'parent'];
// The blocks inside an artifact whose groupId and artifactId are not its own.
const POM_NESTED = ['exclusions', 'dependencies', 'configuration', 'executions'];
const pomElements = (text, tag) => [...text.matchAll(new RegExp(`<${tag}(?:\\s[^>]*)?(?<!/)>([\\s\\S]*?)</${tag}\\s*>`, 'g'))].map(([, inner]) => inner);
const pomField = (text, tag) => new RegExp(`<${tag}(?:\\s[^>]*)?>\\s*([^<]*?)\\s*</${tag}\\s*>`).exec(text)?.[1] || undefined;
const pomStrip = (text, tags) => tags.reduce((left, tag) => left.replace(new RegExp(`<${tag}(?:\\s[^>]*)?(?<!/)>[\\s\\S]*?</${tag}\\s*>`, 'g'), ''), text);
const pomText = (text) => String(text ?? '').replace(/<!--[\s\S]*?-->/g, '');

function pomProperties(pom) {
  const properties = {};
  for (const block of pomElements(pom, 'properties')) {
    for (const [, name, value] of block.matchAll(/<([\w.-]+)(?:\s[^>]*)?>\s*([^<]*?)\s*<\/\1\s*>/g)) properties[name] ??= value;
  }
  const top = pomStrip(pom, ['parent', 'dependencies', 'dependencyManagement', 'build', 'profiles', 'reporting', 'properties', 'repositories', 'pluginRepositories', 'distributionManagement', 'modules']);
  const parentGroup = pomField(pomElements(pom, 'parent')[0] ?? '', 'groupId');
  const group = pomField(top, 'groupId') ?? parentGroup;
  if (group) properties['project.groupId'] ??= group;
  if (parentGroup) properties['project.parent.groupId'] ??= parentGroup;
  const artifact = pomField(top, 'artifactId');
  if (artifact) properties['project.artifactId'] ??= artifact;
  return properties;
}

export function pomDependencies(text) {
  const pom = pomText(text);
  const properties = pomProperties(pom);
  const resolve = (value) => {
    let out = value;
    for (let i = 0; i < 5 && /\$\{/.test(out); i++) out = out.replace(/\$\{([^}]+)\}/g, (whole, name) => properties[name] ?? whole);
    return out;
  };
  const found = new Set();
  const add = (inner, defaultGroup) => {
    const own = pomStrip(inner, POM_NESTED);
    const group = pomField(own, 'groupId') ?? defaultGroup;
    const artifact = pomField(own, 'artifactId');
    if (group && artifact) found.add(`${resolve(group)}:${resolve(artifact)}`);
  };
  for (const tag of POM_ARTIFACTS) for (const inner of pomElements(pom, tag)) add(inner, tag === 'plugin' ? 'org.apache.maven.plugins' : undefined);
  // The annotation processors of the compiler plugin, which Maven downloads as it does a dependency.
  for (const paths of pomElements(pom, 'annotationProcessorPaths')) for (const inner of pomElements(paths, 'path')) add(inner);
  return [...found].sort();
}

// The URLs of the <repository> and <pluginRepository> blocks of a pom.xml: where Maven would download from besides
// Maven Central, which dep-check reads.
export function pomRepositories(text) {
  const pom = pomText(text);
  return [...new Set(['repository', 'pluginRepository'].flatMap((tag) => pomElements(pom, tag).map((inner) => pomField(inner, 'url')).filter(Boolean)))];
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
// tag; 'workspace' for workspace: of pnpm, the project's own packages; 'catalog' for catalog: of pnpm, a version kept in
// pnpm-workspace.yaml, which is read there (second review of shop PR #79); 'other' for anything else, such as an alias
// npm:evil@1, git, github:x/y, a URL, file:, link: or a path, none of which dep-check checked. A registry spec never
// holds a colon or a slash; a path starts with a dot.
export function specSource(spec) {
  const text = String(spec ?? '').trim();
  if (/^workspace:/.test(text)) return 'workspace';
  if (/^catalog:/.test(text)) return 'catalog';
  return /[:/\\]/.test(text) || text.startsWith('.') ? 'other' : 'registry';
}

// The catalogs of a pnpm-workspace.yaml: { <catalog>: { <name>: spec } }, the one of `catalog` as default; {} for no
// text, null for a text that is not YAML.
export function workspaceCatalogs(text) {
  const workspace = readYaml(text);
  if (workspace === null) return null;
  const named = isObject(workspace.catalogs) ? workspace.catalogs : {};
  return { ...named, default: isObject(workspace.catalog) ? workspace.catalog : isObject(named.default) ? named.default : {} };
}

const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const readYaml = (text) => {
  if (String(text ?? '').trim() === '') return {};
  try {
    const value = parse(text);
    return isObject(value) ? value : value == null ? {} : null;
  } catch {
    return null;
  }
};

// The spec catalog: or catalog:<name> stands for, from the catalogs of pnpm-workspace.yaml, or undefined.
function catalogSpec(catalogs, spec, name) {
  const catalog = String(spec).trim().slice('catalog:'.length) || 'default';
  const value = catalogs?.[catalog]?.[name];
  return value === undefined || value === null ? undefined : String(value);
}

// The entries of a pnpm-workspace.yaml that name a package: those of its catalogs, and its overrides, which can point
// a name at another package: [{ key, name, spec, dependency }], as packageJsonEntries. null for a text that is not YAML.
function workspaceEntries(text) {
  const workspace = readYaml(text);
  if (workspace === null) return null;
  const catalogs = workspaceCatalogs(text);
  const entries = Object.entries(catalogs).flatMap(([catalog, packages]) => (isObject(packages) ? Object.entries(packages) : []).map(([name, spec]) => ({ key: `catalog:${catalog}:${name}`, name, spec: String(spec), dependency: true })));
  if (isObject(workspace.overrides)) entries.push(...Object.entries(workspace.overrides).map(([name, spec]) => ({ key: `overrides:${name}`, name, spec: String(spec), dependency: false })));
  return entries;
}

// The packages of the project itself, which a package.json may name without approval (second review of shop PR #79):
// none with pnpm, which links them only by workspace:, a spec that passes anyway; with npm, which links them by name,
// the names of the package.json files inside the workspaces of the root package.json. A package.json elsewhere, under
// any name, is no package of the project. manifests: [{ path, name }] of the package.json files of the repo.
export function ownPackages({ manager, packageJson, manifests = [] }) {
  if (manager === 'pnpm') return [];
  const workspaces = packageJson?.workspaces;
  const globs = Array.isArray(workspaces) ? workspaces : Array.isArray(workspaces?.packages) ? workspaces.packages : [];
  const inside = (path) => globs.some((glob) => typeof glob === 'string' && matchesGlob(`${glob.replace(/\/+$/, '')}/package.json`, path));
  return manifests.filter(({ path, name }) => name && path !== 'package.json' && inside(path)).map(({ name }) => name);
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

// The problems of one change of a package.json, a pnpm-workspace.yaml or a pom.xml, for the policy job and gh-guard
// (C1 spec section 5): a new direct dependency not on the approved list; a spec that points away from the registry, new
// or changed; and a new approved npm dependency whose spec is not inside the range dep-check approved (review of shop
// PR #79). A version change of a dependency already there is not new: audit and osv-scanner check it. own: the names of
// the project's own packages, which are not libraries (ownPackages). catalogs: those of the pnpm-workspace.yaml of the
// project, for a spec catalog: (workspaceCatalogs).
export function dependencyProblems({ path, before = '', after = '' }, approved, own = [], { catalogs = {} } = {}) {
  const notApproved = (ecosystem, name) => `${path}: ${name} (${ecosystem}) is new and not on dependencies.approved of project.yaml: run node .ai-orchestrator/scripts/dep-check.mjs ${ecosystem} ${name}@<version> first`;
  if (/(^|\/)pom\.xml$/.test(path)) {
    const problems = addedDependencies({ path, before, after }).flatMap(({ name }) => {
      if (/\$\{/.test(name)) return [`${path}: ${name} takes a property this pom.xml does not set, so it cannot be checked: write its groupId and artifactId out`];
      return isApproved(approved, 'maven', name) ? [] : [notApproved('maven', name)];
    });
    const had = new Set(pomRepositories(before));
    for (const url of pomRepositories(after).filter((found) => !had.has(found))) {
      problems.push(`${path} adds the repository ${url}: libraries come only from Maven Central, the registry dep-check reads (C1 spec section 5)`);
    }
    return problems;
  }
  const workspace = /(^|\/)pnpm-workspace\.yaml$/.test(path);
  if (!workspace && !/(^|\/)package\.json$/.test(path)) return [];
  const now = workspace ? workspaceEntries(after) : packageJsonEntries(after);
  if (now === null) {
    return [workspace ? `${path} is no YAML after this change, so its catalogs and overrides cannot be read: write it whole, as valid YAML` : `${path} is no JSON after this change, so its dependencies cannot be read: write it whole, as valid JSON`];
  }
  const was = (workspace ? workspaceEntries(before) : packageJsonEntries(before)) ?? [];
  const wasSpec = new Map(was.map(({ key, spec }) => [key, spec]));
  const wasName = new Set(was.filter(({ dependency }) => dependency).map(({ name }) => name));
  const problems = [];
  for (const { key, name, spec, dependency } of now) {
    if (wasSpec.get(key) === spec) continue;
    let source = specSource(spec);
    let version = spec;
    // catalog: takes its version from pnpm-workspace.yaml (second review of shop PR #79); there, an entry is a version.
    if (source === 'catalog' && !workspace) {
      version = catalogSpec(catalogs, spec, name);
      if (version === undefined) {
        problems.push(`${path}: ${name} asks for ${spec}, which pnpm-workspace.yaml has no entry for`);
        continue;
      }
      source = specSource(version) === 'registry' ? 'registry' : 'other';
    } else if (source === 'catalog' || (workspace && dependency && source === 'workspace')) source = 'other';
    const asked = version === spec ? spec : `${spec} (${version} in pnpm-workspace.yaml)`;
    if (source === 'other') {
      problems.push(`${path}: ${name} points to ${asked}, which is no version of the registry: install libraries by name, after dep-check (C1 spec section 5)`);
      continue;
    }
    if (source === 'workspace' || !dependency || wasName.has(name) || own.includes(name)) continue;
    const approval = approvalOf(approved, 'npm', name);
    if (!approval) {
      problems.push(notApproved('npm', name));
      continue;
    }
    const within = rangeWithin(version, approval.range);
    if (within === false) problems.push(`${path}: ${name} asks for ${asked}, outside ${approval.range}, the range dep-check approved: ask for a version inside it, or run dep-check on the new one`);
    else if (within === null) problems.push(`${path}: ${name} asks for ${asked}, which cannot be checked against ${approval.range}, the range dep-check approved: write a version or a range inside it`);
  }
  return problems;
}

// The problems of the policy job for the dependencies a PR changes. changes: [{ path, before, after }] of the
// package.json, pnpm-workspace.yaml and pom.xml files the PR changes; options: { catalogs } (dependencyProblems).
export function unapprovedDependencies(changes, approved, own = [], options = {}) {
  return changes.flatMap((change) => dependencyProblems(change, approved, own, options));
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
  npm: ['install', 'i', 'in', 'ins', 'inst', 'insta', 'instal', 'isnt', 'isnta', 'isntal', 'isntall', 'add', 'install-test', 'it'],
  pnpm: ['add', 'install', 'i'],
  yarn: ['add'],
  bun: ['add', 'install', 'i'],
};
const RUN_VERBS = { npm: ['exec', 'x'], pnpm: ['dlx'], yarn: ['dlx'], bun: ['x'] };
const RUNNERS = ['npx', 'bunx', 'pnpx'];
// npm init <initializer> and the create of each package manager download the package create-<initializer> and run it
// (docs.npmjs.com/cli/commands/npm-init; second review of shop PR #79).
const CREATE_VERBS = { npm: ['init', 'create', 'innit'], pnpm: ['create'], yarn: ['create'], bun: ['create', 'c'] };
// corepack <package manager>[@<version>] runs that package manager with the words after it.
const COREPACK_TOOLS = ['npm', 'npx', 'pnpm', 'pnpx', 'yarn'];
// Options that take the next word as their value, before or after the verb.
const VALUE_OPTIONS = ['-F', '--filter', '-C', '--dir', '--prefix', '-w', '--workspace', '--cwd', '--tag'];
const MAVEN = ['mvn', 'mvnw', 'mvn.cmd', 'mvnw.cmd'];
// Another registry, by an option or a variable of the package manager: what dep-check read is the package of the
// project's registry, not one of the same name elsewhere.
const REGISTRY_OPTION = /^--(?:@[\w.-]+:)?registry(?:=|$)|^-D(?:remoteRepositories|repoUrl)=/;
const REGISTRY_VARIABLE = /^(?:npm_config_|yarn_|bun_config_)\S*registry\S*=/i;
// Variables that point a package manager, Maven or the JVM that runs it elsewhere, before any program: a script of the
// project may run the package manager (review of shop PR #80). MAVEN_ARGS adds words to every mvn and mvnw of Maven
// 3.9; the JVM takes -D words, such as -Duser.home, from MAVEN_OPTS and the other two.
// npm_config_userconfig and globalconfig point npm at another .npmrc, YARN_RC_FILENAME yarn at another .yarnrc.yml; a
// value appended with += counts too, and the bare name, which export or declare sets after printf -v or read (review of
// shop PR #81). The home and config folders of the user hold .npmrc and the rc files of pnpm and yarn, and
// npm_config_prefix the global .npmrc: USERPROFILE=<folder> pnpm add read another registry (second review of shop PR
// #81).
const SOURCE_NAMES = '(?:(?:npm_config_|yarn_|bun_config_)\\S*registry\\S*|npm_config_(?:user|global)config|npm_config_prefix|YARN_RC_FILENAME|MAVEN_ARGS|MAVEN_OPTS|JAVA_TOOL_OPTIONS|JDK_JAVA_OPTIONS|_JAVA_OPTIONS|USERPROFILE|HOME|HOMEDRIVE|HOMEPATH|XDG_CONFIG_HOME|LOCALAPPDATA|APPDATA)';
export const SOURCE_VARIABLE = new RegExp(`^${SOURCE_NAMES}\\+?=`, 'i');
export const SOURCE_NAME = new RegExp(`^${SOURCE_NAMES}$`, 'i');

// The options of Maven 3.9 (CLIManager): short name, long name, and whether it takes a value.
const MAVEN_OPTIONS = [
  ['h', 'help'], ['q', 'quiet'], ['X', 'debug'], ['e', 'errors'], ['v', 'version'], ['V', 'show-version'], ['B', 'batch-mode'],
  ['N', 'non-recursive'], ['o', 'offline'], ['U', 'update-snapshots'], ['C', 'strict-checksums'], ['c', 'lax-checksums'],
  ['fae', 'fail-at-end'], ['ff', 'fail-fast'], ['fn', 'fail-never'], ['am', 'also-make'], ['amd', 'also-make-dependents'],
  ['nsu', 'no-snapshot-updates'], ['ntp', 'no-transfer-progress'], ['npr', 'no-plugin-registry'], ['npu', 'no-plugin-updates'],
  ['cpu', 'check-plugin-updates'], ['up', 'update-plugins'], ['llr', 'legacy-local-repository'], ['itr', 'ignore-transitive-repositories'],
  ['emp', 'encrypt-master-password', true], ['ep', 'encrypt-password', true], ['D', 'define', true], ['f', 'file', true],
  ['l', 'log-file', true], ['P', 'activate-profiles', true], ['pl', 'projects', true], ['rf', 'resume-from', true],
  ['s', 'settings', true], ['gs', 'global-settings', true], ['t', 'toolchains', true], ['gt', 'global-toolchains', true],
  ['T', 'threads', true], ['b', 'builder', true], [null, 'color', true],
].map(([short, long, value = false]) => ({ short, long, value }));
const SETTINGS = ['settings', 'global-settings'];
// Maven reads settings.xml from .m2 of user.home.
const SETTINGS_PROPERTY = /^(?:user\.home|[\w.-]*settings[\w.-]*)=/i;
const optionNamed = (name) => MAVEN_OPTIONS.find(({ short, long }) => short === name || long === name);

// Whether one word of a Maven command makes it read another settings file (second review of shop PR #79; review of shop
// PR #80). Maven reads its words with commons-cli, which takes more than -s: the value joined to a short option (-sx.xml,
// -gsx.xml), short options one after another (-qsx.xml), a long option by any prefix that names it, after one dash or
// two (--sett, -settings), and -D before user.home. next: the word after it.
export function readsMavenSettings(word, next) {
  return mavenOptionsOf(word, next).some(({ long, value }) => SETTINGS.includes(long) || (long === 'define' && SETTINGS_PROPERTY.test(value ?? '')));
}

// The options one word of a Maven command sets, as commons-cli reads it: [{ long, value }], value being the joined
// rest or the next word for an option that takes one. A long name by any prefix after one dash or two counts as each
// option it may name (review of shop PR #81: --define, -define, -qD).
function mavenOptionsOf(word, next) {
  if (!word.startsWith('-') || word === '-' || word === '--') return [];
  const valued = (option, rest) => ({ long: option.long, value: option.value ? (rest !== '' ? rest.replace(/^=/, '') : next) : undefined });
  const prefixed = (name, rest) => MAVEN_OPTIONS.filter(({ long }) => name !== '' && long.startsWith(name)).map((option) => valued(option, rest));
  if (word.startsWith('--')) {
    const [name, ...value] = word.slice(2).split('=');
    return prefixed(name, value.length > 0 ? `=${value.join('=')}` : '');
  }
  const token = word.slice(1);
  const at = token.indexOf('=');
  const name = at < 0 ? token : token.slice(0, at);
  const exact = optionNamed(name);
  if (exact) return [valued(exact, at < 0 ? '' : token.slice(at))];
  if (at < 0 && MAVEN_OPTIONS.some(({ long }) => long.startsWith(token))) return prefixed(token, '');
  // The longest name the word starts with; one that takes a value has the rest as its value.
  for (let end = token.length - 1; end > 0; end -= 1) {
    const option = optionNamed(token.slice(0, end));
    if (option) {
      if (option.value) return [valued(option, token.slice(end))];
      break;
    }
  }
  // Letters of options one after another, up to one that takes a value, which has the rest.
  const found = [];
  for (let i = 0; i < token.length; i += 1) {
    const option = MAVEN_OPTIONS.find(({ short }) => short === token[i]);
    if (!option) return found;
    found.push(valued(option, token.slice(i + 1)));
    if (option.value) return found;
  }
  return found;
}

// The first word of a Maven command that makes it read another settings file, or undefined.
export const mavenSettingsWord = (args) => args.find((word, i) => readsMavenSettings(word, args[i + 1]));

export function installTargets(program, args, { env = [] } = {}) {
  if (program === 'corepack') {
    const tool = args[0]?.replace(/@[^@]*$/, '');
    return COREPACK_TOOLS.includes(tool) ? installTargets(tool, args.slice(1), { env }) : null;
  }
  // A settings file of Maven can hold a mirror, which serves every artifact from elsewhere, whatever the goal (second
  // review of shop PR #79).
  const settings = MAVEN.includes(program) ? (env.find((word) => SOURCE_VARIABLE.test(word)) ?? mavenSettingsWord(args)) : undefined;
  if (settings) return [{ refused: settings, registry: true }];
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
  if (CREATE_VERBS[program]?.includes(args[i])) return createTargets(args.slice(i + 1));
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

// The package npm init <initializer> or a create runs: create-<name> for a name, @scope/create-<name> for a scoped
// one, @scope/create for a scope alone, with the version given. null when it names none, as npm init -y.
function createTargets(args) {
  for (let j = 0; j < args.length; j++) {
    const word = args[j];
    if (word.startsWith('-')) {
      if (VALUE_OPTIONS.includes(word)) j++;
      continue;
    }
    const scope = /^(@[\w.-]+)(?:@(.*))?$/.exec(word);
    if (scope) return [scope[2] === '' ? { refused: word } : { ecosystem: 'npm', name: `${scope[1]}/create`, ...(scope[2] !== undefined && { version: scope[2] }), run: true }];
    const target = packageOf(word);
    if (target.refused) return [target];
    const [scopePart, rest] = target.name.startsWith('@') ? target.name.split('/') : [null, target.name];
    return [{ ...target, name: scopePart ? `${scopePart}/create-${rest}` : `create-${rest}`, run: true }];
  }
  return null;
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
    if (first.run) return `${names}, and npx, npm exec, a dlx or a create downloads it when the project does not have it: run what the project has with pnpm exec or npx --no, or run ${check} first (C1 spec section 5)`;
    return `${names}: run ${check} first, and install it once it passes (C1 spec section 5)`;
  }
  for (const target of targets) {
    const entry = entryOf(target);
    // A name alone installs the newest version, which dep-check did not read (second review of shop PR #79). A run of
    // npx takes the version the project has, when it has one.
    if (target.version === undefined && entry.range && !target.run) {
      return `${target.name} alone installs the newest version, which dep-check did not read: give a version inside ${entry.range}, such as ${target.name}@<x.y.z> (C1 spec section 5)`;
    }
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
