// ao-kit add <dir> <app> --stack <nextjs|react|spring-boot> [--from <template> [--ref <branch>]] [--exclude <path>]... [--public]
// (project-scaffold part 2, spec 2.2; spring-boot from part 3, spec 2.1, with --from only): one app more in a pnpm project. Its code is the skeleton of the stack, or HEAD of your template
// without what the kit replaces (template.mjs). The app goes into project.yaml, deploy.yaml and roster.local.yaml, the
// packages of the repo are installed again, settings.json and the agents are rendered again, and ao-kit add says what
// the code of the app still has to change, without changing it. Nothing is committed. git(args, cwd) and run(argv, cwd)
// are given, as for init.
import { cpSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { isCollection, parseDocument, stringify } from 'yaml';
import { devCommand, managerOf } from '../quality/package-manager.mjs';
import { appReport } from './app-report.mjs';
import { nextIntlHealth } from './next-intl.mjs';
import { copyStack, findSkill, readStack, stackNames } from './profile.mjs';
import { PROJECT_FILE, readProjectConfig } from './project-config.mjs';
import { copyTemplate } from './template.mjs';

const DEPLOY_FILE = '.ai-orchestrator/deploy.yaml';
const ROSTER_FILE = '.ai-orchestrator/roster.local.yaml';
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
    ...(options.public && { public: true }),
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
  notes.push(`Next: ao-kit check <dir>; ${options.public ? `when two or more apps are public, write the hosts of ${app} in development, staging and production under hosts: in ${PROJECT_FILE}, and ao-kit doctor prints the lines of /etc/ao/deployer.yaml; ` : ''}then the steps of docs/getting-started.md`);
  return { ok: true, notes };
}
