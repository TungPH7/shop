// ao-kit add <dir> <app> --stack <nextjs|react|spring-boot> [--from <template> [--ref <branch>]] [--exclude <path>]... [--public --seo|--no-seo]
// (project-scaffold part 2, spec 2.2; spring-boot from part 3, spec 2.1, with --from only): one app more in a pnpm project. Its code is the skeleton of the stack, or HEAD of your template
// without what the kit replaces (template.mjs). The app goes into project.yaml, deploy.yaml and roster.local.yaml, the
// packages of the repo are installed again, settings.json and the agents are rendered again, and ao-kit add says what
// the code of the app still has to change, without changing it. Nothing is committed. git(args, cwd) and run(argv, cwd)
// are given, as for init.
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { isCollection, parseDocument, stringify } from 'yaml';
import { devCommand, managerOf } from '../quality/package-manager.mjs';
import { appReport } from './app-report.mjs';
import { nextIntlHealth } from './next-intl.mjs';
import { copyStack, findSkill, readStack, stackNames } from './profile.mjs';
import { PROJECT_FILE, readProjectConfig } from './project-config.mjs';
import { copyTemplate } from './template.mjs';

const DEPLOY_FILE = '.ai-orchestrator/deploy.yaml';
const ROSTER_FILE = '.ai-orchestrator/roster.local.yaml';
export const ADD_REPORT = '.ai/setup/add-report.md';
const RENDER = ['node', '.ai-orchestrator/scripts/render-agents.mjs', '--project', '.'];
const TODO = 'TODO';
// An app name of deploy.yaml: lower case, at most 20 characters, so it fits a container name on the VPS.
const APP_NAME = /^[a-z]([a-z0-9-]{0,18}[a-z0-9])?$/;

// The collections along `path` in block style: apps: {} of a new project.yaml would keep every app on one line.
function blockAlong(doc, path) {
  for (let i = 0; i <= path.length; i++) {
    const node = i === 0 ? doc.contents : doc.getIn(path.slice(0, i), true);
    if (isCollection(node)) node.flow = false;
  }
}

// Sets `path` of a YAML file to `value`, keeping its comments; makes the file from `header` when it is not there.
function setYaml(file, path, value, header) {
  const doc = parseDocument(existsSync(file) ? readFileSync(file, 'utf8') : `${header}\n`);
  if (doc.contents == null) doc.contents = doc.createNode({});
  doc.setIn(path, doc.createNode(value));
  blockAlong(doc, path.slice(0, -1));
  writeFileSync(file, String(doc));
  return doc;
}

// What the files of .ai-orchestrator/ still lack for a Spring Boot app, which add does not write (project-scaffold part
// 3, T21; du-an-1, SPEC-guided-setup.md 6): the env: of the app and the database of deploy.yaml, and the coverage_exclude
// JaCoCo's excludes call for. Read after the app is in. These files steer the kit, so they go into the first commit, or
// a PR you merge.
function kitFilesByHand({ projectDir, app, profile, read }) {
  if (profile !== 'spring-boot') return [];
  const lines = [];
  const deploy = parseDocument(readFileSync(join(projectDir, DEPLOY_FILE), 'utf8')).toJSON() ?? {};
  // The variables the VPS gives the app: its profile when the Dockerfile sets one for every environment, and the
  // database ones its config reads, with a default or not (DB_HOST is db on the VPS, localhost on your machine).
  const config = ['application.yml', 'application.yaml', 'application.properties'].map((name) => read(`src/main/resources/${name}`)).find((text) => text != null) ?? '';
  const wanted = [
    ...(/^\s*ENV\s+SPRING_PROFILES_ACTIVE[=\s]/m.test(read('Dockerfile') ?? '') ? ['SPRING_PROFILES_ACTIVE'] : []),
    ...[...config.matchAll(/\$\{((?:DB|POSTGRES)_[A-Z0-9_]*)[:}]/g)].map((match) => match[1]),
    ...[...config.matchAll(/\$\{([A-Z][A-Z0-9_]*)\}/g)].map((match) => match[1]),
  ];
  const missing = [...new Set(wanted)].filter((name) => !(deploy.apps?.[app]?.env ?? []).includes(name));
  if (missing.length > 0) lines.push(`${DEPLOY_FILE} names no ${missing.join(', ')} under env: of ${app}: write env: [ ${missing.join(', ')} ], so the deployer passes each from /etc/ao/secrets/<project>/<environment>.env`);
  if (!deploy.database) lines.push(`${DEPLOY_FILE} has no database: key, which ${app} needs for its PostgreSQL: write image, init and memory as docs/vps-setup.md section 14 shows`);
  const project = parseDocument(readFileSync(join(projectDir, PROJECT_FILE), 'utf8')).toJSON();
  // Only the <exclude> of the JaCoCo plugin: the pom has others, such as Lombok left out of the Spring Boot plugin.
  const jacoco = /<artifactId>jacoco-maven-plugin<\/artifactId>([\s\S]*?)<\/plugin>/.exec(read('pom.xml') ?? '')?.[1] ?? '';
  const excluded = [...jacoco.matchAll(/<exclude>\s*([^<\s]+)\s*<\/exclude>/g)].map((match) => match[1]);
  if (excluded.length > 0 && !project?.apps?.[app]?.coverage_exclude) {
    // A class pattern as a source path; a nested class ($) lives in the file of its outer class.
    const paths = excluded.filter((pattern) => !pattern.includes('$')).map((pattern) => `src/main/java/${pattern.replace(/\.class$/, '.java')}`);
    lines.push(`apps/${app}/pom.xml leaves ${excluded.length} patterns out of JaCoCo: write them as source paths under coverage_exclude of ${app} in ${PROJECT_FILE}, or build-test fails on files the report lacks. From its <excludes>: ${paths.join(', ')}`);
  }
  return lines;
}

// .ai/setup/add-report.md (SPEC-guided-setup.md section 4): one section for each app, the one of `app` written again.
// The second session of ao-kit-setup.md reads it to make the Task that changes the code; .ai/ is ignored by git.
function writeAddReport({ projectDir, app, stack, changes, byHand }) {
  const file = join(projectDir, ADD_REPORT);
  const header = '# What ao-kit add says each app still needs\n\nao-kit add writes one section for each app. The code changes go through one Task and one PR (SPEC-project-scaffold-2.md 2.3); the lines under "By hand" go into the first commit.\n';
  const old = existsSync(file) ? readFileSync(file, 'utf8') : header;
  const sections = old.split(/^(?=## )/m);
  const kept = sections.filter((section) => !section.startsWith(`## ${app} (`));
  const list = (lines) => (lines.length > 0 ? lines.map((line) => `- ${line}`).join('\n') : '- Nothing.');
  const section = `## ${app} (${stack})\n\nCode to change:\n\n${list(changes)}\n${byHand.length > 0 ? `\nBy hand:\n\n${list(byHand)}\n` : ''}\n`;
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${[...kept.map((text) => text.replace(/\n*$/, '\n\n')), section].join('').replace(/\n+$/, '\n')}`);
}

export function addApp({ kitDir, projectDir, app, options, git, run }) {
  const stop = (note) => ({ ok: false, notes: [note] });
  const file = join(projectDir, PROJECT_FILE);
  if (!existsSync(file)) return stop(`${projectDir} has no ${PROJECT_FILE}: run ao-kit init <dir> --package-manager pnpm first`);
  const { config, errors } = readProjectConfig(readFileSync(file, 'utf8'));
  if (!config) return stop(`${PROJECT_FILE}: ${errors.map(({ message }) => message).join('; ')}`);
  if (managerOf(config) !== 'pnpm') return stop(`ao-kit add takes a pnpm project, and ${PROJECT_FILE} says ${managerOf(config)}: the stacks of the kit run with pnpm (SPEC-project-scaffold-2.md 2.1)`);
  if (!APP_NAME.test(app ?? '')) return stop(`the app name ${JSON.stringify(app ?? '')} must be lower-case letters, digits and hyphens, at most 20 characters, starting with a letter, such as user or admin`);
  if (Object.hasOwn(config.apps ?? {}, app)) return stop(`${app} is an app of ${PROJECT_FILE} already`);
  if (!options.stack) return stop(`ao-kit add needs --stack, one of ${stackNames(kitDir).join(', ')}`);
  let stack;
  try {
    stack = readStack(kitDir, options.stack);
  } catch (error) {
    return stop(error.message);
  }
  if (stack.requires_template && !options.from) return stop(`the stack ${stack.name} has no skeleton of its own: ao-kit add needs --from <your template>`);
  // C1 spec 6.1: a public app says whether a search engine indexes it, so seo writes the SEO of its screens or not.
  if (options.public && options.seo === undefined) return stop(`${app} is public: say whether a search engine indexes its pages, with --seo for a site people find on Google, or --no-seo, as for an admin app (C1 spec 6.1)`);
  if (options.seo === true && !options.public) return stop(`--seo goes with --public: no search engine reaches an app that is not public`);

  const used =new Set(Object.values(config.apps ?? {}).map((other) => other.port.default));
  let port = stack.port;
  while (used.has(port)) port += 1;
  const path = `apps/${app}`;
  const project = { name: config.name, title: options.title ?? config.name };
  const notes = [];

  // The code: the skeleton of the stack, or the template and the files of the container it lacks.
  let skill = null;
  if (options.from) {
    const copied = copyTemplate({ from: options.from, ref: options.ref, projectDir, app, exclude: options.exclude ?? [], git });
    if (!copied.ok) return copied;
    notes.push(...copied.notes);
    skill = copied.skill;
    const missing = stack.container_files.filter((name) => !existsSync(join(projectDir, path, name)));
    if (missing.length > 0) {
      copyStack({ stack, projectDir, app, port, ...project, only: missing });
      notes.push(`Copied ${missing.join(' and ')} of the stack ${stack.name}, which the template has not`);
    }
  } else {
    if (existsSync(join(projectDir, path))) return stop(`${path} is in the project already: ao-kit add brings a new app only`);
    const written = copyStack({ stack, projectDir, app, port, ...project });
    notes.push(`Copied the ${stack.name} skeleton into ${path}: ${written.length} files`);
  }

  // A Next.js app with next-intl and localePrefix 'always' answers / with a redirect, which the smoke test does not
  // follow: its health path is /<defaultLocale> (part 3, spec 2.6).
  const read = (name) => (existsSync(join(projectDir, path, name)) ? readFileSync(join(projectDir, path, name), 'utf8') : null);
  const intl = stack.profile === 'nextjs' ? nextIntlHealth(read) : null;
  const health = intl?.health ?? stack.health;
  if (intl?.health) notes.push(`next-intl in apps/${app}/${intl.file} sends / to ${health}: health is ${health} in ${PROJECT_FILE} and ${DEPLOY_FILE}, and the smoke check of ${app} asks for it`);

  // The app in project.yaml, deploy.yaml and roster.local.yaml.
  const scripts = JSON.parse(readFileSync(join(projectDir, path, 'package.json'), 'utf8')).scripts ?? {};
  const devScript = scripts[stack.dev_script] ? stack.dev_script : TODO;
  if (devScript === TODO) notes.push(`apps/${app}/package.json has no ${stack.dev_script} script: write the dev command of ${app} in ${PROJECT_FILE}`);
  const repo = config.repos[0].name;
  setYaml(file, ['apps', app], {
    repo,
    path,
    profile: stack.profile,
    dev: devCommand('pnpm', path, devScript),
    port: { env: 'PORT', default: port },
    health,
    ...(options.public && { public: true, seo: options.seo === true }),
  });
  // A Dockerfile made for the app folder builds from it; a JVM app gets a memory cap and time to start (part 3, 2.5).
  const deployApp = {
    dockerfile: `${path}/${stack.dockerfile}`,
    ...(stack.build_context === 'app' && { context: path }),
    port,
    health,
    ...(options.public && { public: true }),
    ...(stack.memory && { memory: stack.memory }),
    ...(stack.start_timeout && { start_timeout: stack.start_timeout }),
  };
  const deploy = setYaml(join(projectDir, DEPLOY_FILE), ['apps', app], deployApp, `# How the deployer on the VPS builds, runs and smoke-tests the apps of ${config.name} (docs/release-workflow.md). ao-kit add\n# writes each app here; the smoke checks are yours to add to.\napps: {}\nsmoke: []`);
  const smoke = deploy.getIn(['smoke'])?.toJSON?.() ?? [];
  if (!smoke.some((check) => check.app === app)) {
    // Every page of Next.js and the index.html of Vite hold <html: the app answers with its own page. A stack whose
    // health path answers otherwise, such as the actuator of Spring Boot, names its text.
    deploy.setIn(['smoke'], deploy.createNode([...smoke, { app, path: health, expect_status: 200, expect_text: stack.smoke_text ?? '<html' }]));
    blockAlong(deploy, ['smoke']);
    writeFileSync(join(projectDir, DEPLOY_FILE), String(deploy));
  }
  const roles = Object.entries(stack.skills).map(([role, skills]) => [role, skills]);
  if (skill) roles.push([stack.dev_role ?? 'fe-dev', [skill.name]]);
  const roster = parseDocument(existsSync(join(projectDir, ROSTER_FILE)) ? readFileSync(join(projectDir, ROSTER_FILE), 'utf8') : `# Stack skills of this project (agent-roster spec 2.7). Each skill sits in .claude/skills/.\n${stringify({ roles: {} })}`);
  for (const [role, skills] of roles) {
    const have = roster.getIn(['roles', role, 'skills'])?.toJSON?.() ?? [];
    roster.setIn(['roles', role, 'skills'], roster.createNode([...new Set([...have, ...skills])]));
    blockAlong(roster, ['roles', role]);
  }
  writeFileSync(join(projectDir, ROSTER_FILE), String(roster));
  for (const name of Object.values(stack.skills).flat()) {
    const target = join(projectDir, '.claude', 'skills', name);
    if (existsSync(target)) continue;
    const source = findSkill(kitDir, name);
    if (!source) return { ok: false, notes: [...notes, `The kit has no skill ${name}, which the stack ${stack.name} names`] };
    cpSync(source, target, { recursive: true });
    notes.push(`Copied the stack skill ${name} into .claude/skills/`);
  }
  notes.push(`${app} is in ${PROJECT_FILE}, ${DEPLOY_FILE} and ${ROSTER_FILE}: port ${port}${options.public ? ', public' : ''}`);

  // The packages of the whole repo, then settings.json and the agents.
  for (const argv of [['pnpm', 'install'], RENDER]) {
    const done = run(argv, projectDir);
    if (done.status !== 0) return { ok: false, notes: [...notes, `${argv.join(' ')} failed: ${`${done.stderr ?? ''}${done.stdout ?? ''}`.trim().slice(-500)}. Fix it, then run ${argv.join(' ')} in the project`] };
    notes.push(`Ran ${argv.join(' ')}`);
  }

  const changes = [...appReport({ app, profile: stack.profile, read, port }), ...(intl?.problem ? [intl.problem] : [])];
  if (changes.length > 0) notes.push(`The code of ${app} still has to change, through a Task and a PR (SPEC-project-scaffold-2.md 2.3):`, ...changes.map((line) => `  - ${line}`));
  const byHand = kitFilesByHand({ projectDir, app, profile: stack.profile, read });
  if (byHand.length > 0) notes.push(`Write by hand before the first commit, since these files steer the kit:`, ...byHand.map((line) => `  - ${line}`));
  writeAddReport({ projectDir, app, stack: stack.name, changes, byHand });
  notes.push(`Wrote the section of ${app} in ${ADD_REPORT}, which git ignores, for the Task of ao-kit-setup.md`);
  notes.push(`Next: ao-kit check <dir>; ${options.public ? `when two or more apps are public, write the hosts of ${app} in development, staging and production under hosts: in ${PROJECT_FILE}, and ao-kit doctor prints the lines of /etc/ao/deployer.yaml; ` : ''}then the steps of docs/getting-started.md`);
  return { ok: true, notes };
}
