// A profile of the kit (project-scaffold spec 2.6): the skeleton of a stack in profiles/<name>/files/, and its
// profile.yaml, which says the apps, the stack skills, the version of Node and what runs once the files are copied.
// ao-kit init copies a profile into an empty folder; npm run profiles:check builds one in a temporary folder.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parse, stringify } from 'yaml';

// The profiles of the kit: the folders of profiles/ that hold a profile.yaml. profiles/stacks/ holds the stacks of
// ao-kit add instead (project-scaffold part 2, spec 2.3).
export function profileNames(kitDir) {
  const root = join(kitDir, 'profiles');
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(root, entry.name, 'profile.yaml')))
    .map((entry) => entry.name)
    .sort();
}

// Reads profiles/<name>/profile.yaml of the kit. `after` comes back as argv lists, run with no shell. package_manager
// is npm when the profile does not name one.
export function readProfile(kitDir, name) {
  const dir = join(kitDir, 'profiles', name);
  if (!existsSync(join(dir, 'profile.yaml'))) throw new Error(`no profile ${name} in profiles/; the kit has ${profileNames(kitDir).join(', ') || 'none'}`);
  const data = parse(readFileSync(join(dir, 'profile.yaml'), 'utf8'));
  return { ...data, package_manager: data.package_manager ?? 'npm', after: (data.after ?? []).map((command) => command.trim().split(/\s+/)), filesDir: join(dir, 'files') };
}

// A text file has no NUL byte; an image or an icon has.
const isText = (buffer) => !buffer.includes(0);

// Copies the files of `fromDir` into `toDir`, with each placeholder of `values` ({ __NAME__: 'shop' }) replaced in every
// text file. keep(path) chooses the files. Returns the paths written, relative to toDir, with forward slashes.
function copyTree(fromDir, toDir, values, keep = () => true) {
  const written = [];
  for (const entry of readdirSync(fromDir, { recursive: true, withFileTypes: true }).filter((e) => e.isFile())) {
    const from = join(entry.parentPath ?? entry.path, entry.name);
    const path = relative(fromDir, from).replaceAll('\\', '/');
    if (!keep(path)) continue;
    const buffer = readFileSync(from);
    const text = () => Object.entries(values).reduce((content, [key, value]) => content.replaceAll(key, value), buffer.toString('utf8'));
    mkdirSync(join(toDir, path, '..'), { recursive: true });
    writeFileSync(join(toDir, path), isText(buffer) ? text() : buffer);
    written.push(path);
  }
  return written.sort();
}

// Copies the skeleton of the profile into projectDir, with __NAME__ (the project, lower case) and __TITLE__ (its name
// for people) replaced in every text file. Returns the paths written, relative, with forward slashes.
export function copyProfile({ profile, projectDir, name, title }) {
  return copyTree(profile.filesDir, projectDir, { __NAME__: name, __TITLE__: title });
}

// The stacks of ao-kit add (project-scaffold part 2, spec 2.3): the folders of profiles/stacks/ that hold a stack.yaml.
export function stackNames(kitDir) {
  const root = join(kitDir, 'profiles', 'stacks');
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(root, entry.name, 'stack.yaml')))
    .map((entry) => entry.name)
    .sort();
}

// Reads profiles/stacks/<name>/stack.yaml of the kit: one app of a project, its skeleton in files/.
export function readStack(kitDir, name) {
  const dir = join(kitDir, 'profiles', 'stacks', name);
  if (!existsSync(join(dir, 'stack.yaml'))) throw new Error(`no stack ${name} in profiles/stacks/; the kit has ${stackNames(kitDir).join(', ') || 'none'}`);
  const data = parse(readFileSync(join(dir, 'stack.yaml'), 'utf8'));
  return { ...data, container_files: data.container_files ?? [], skills: data.skills ?? {}, filesDir: join(dir, 'files') };
}

// Copies the skeleton of a stack into apps/<app> of projectDir, with __APP__, __PORT__, __NAME__ and __TITLE__ replaced.
// only: the files to copy, such as the container_files next to the code of a template; every file when absent. Returns
// the paths written, relative to the project.
export function copyStack({ stack, projectDir, app, port, name, title, only }) {
  const values = { __APP__: app, __PORT__: String(port), __NAME__: name, __TITLE__: title };
  return copyTree(stack.filesDir, join(projectDir, 'apps', app), values, only ? (path) => only.includes(path) : undefined).map((path) => `apps/${app}/${path}`);
}

// The folder of a stack skill in the kit, or null: a stack may keep its own in profiles/stacks/<stack>/skills/, and the
// skills a profile already holds are shared, such as vercel-react-best-practices in profiles/next-nest/files/.claude/.
export function findSkill(kitDir, skill) {
  const candidates = [
    ...stackNames(kitDir).map((stack) => join(kitDir, 'profiles', 'stacks', stack, 'skills', skill)),
    ...profileNames(kitDir).map((profile) => join(kitDir, 'profiles', profile, 'files', '.claude', 'skills', skill)),
  ];
  return candidates.find((dir) => existsSync(join(dir, 'SKILL.md'))) ?? null;
}

// The project.yaml of a new project made from the profile. project: { name, space, repo, approvers, apps: { dev,
// dev_id, review, review_id }, kitPeers }.
export function projectYaml(profile, project) {
  const repoName = project.repo.split('/')[1];
  const config = {
    name: project.name,
    ...(profile.package_manager !== 'npm' && { package_manager: profile.package_manager }),
    jira: { space: project.space },
    github: { repo: project.repo, approvers: project.approvers, apps: project.apps, kit_peers: project.kitPeers ?? [] },
    repos: [{ name: repoName, path: '.' }],
    apps: Object.fromEntries(Object.entries(profile.apps).map(([app, value]) => [app, { repo: repoName, ...value }])),
    roles: { optional: [] },
    claude: { allow: [] },
  };
  return `# The config of this project (SPEC-project-scaffold.md 2.1), written by ao-kit init from the profile ${profile.name}.\n${stringify(config)}`;
}

// roster.local.yaml of a new project: the stack skills of the profile.
export function rosterLocalYaml(profile) {
  const roles = Object.fromEntries(Object.entries(profile.skills ?? {}).map(([role, skills]) => [role, { skills }]));
  return `# Stack skills of this project (agent-roster spec 2.7), from the profile ${profile.name}. Each skill sits in .claude/skills/.\n${stringify({ roles })}`;
}
