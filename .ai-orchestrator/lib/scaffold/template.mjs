// The code of a template of yours into apps/<app> of a pnpm project (project-scaffold part 2, spec 2.2; plan, decisions
// 6 and 7). Only what HEAD of the template holds is copied, as git archive would: a shallow clone in a temporary folder,
// so the template itself is never changed. What the kit replaces is left out and named: the hooks and commit rules of
// the template, its CI, its .claude/, its lockfile and workspace. Its pnpm settings move to pnpm-workspace.yaml at the
// root, and its CLAUDE.md becomes a skill of the project. Everything is worked out before anything is written, so a
// setting two templates give different values stops the copy with nothing changed.
// git(args, cwd) resolves { status, stdout, stderr }; the files are real, so tests use temporary folders.
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { isMap, isScalar, isSeq, parseDocument } from 'yaml';

// What the kit replaces, by path from the root of the template: [test, why].
const LEFT_OUT = [
  [(path) => path.startsWith('.husky/'), 'the git hooks of the kit replace husky'],
  [(path) => /^(\.commitlintrc(\.\w+)?|commitlint\.config\.\w+)$/.test(path), 'the commit-msg hook of the kit checks commit headers'],
  [(path) => path.startsWith('.githooks/'), 'the git hooks of the kit replace those of the template'],
  [(path) => path.startsWith('.github/'), 'the CI of the kit runs at the root of the repo'],
  [(path) => path.startsWith('.claude/'), 'the agents of the kit have their own settings, rules and skills'],
  [(path) => /^(pnpm-lock\.yaml|package-lock\.json|yarn\.lock)$/.test(path), 'one lockfile at the root of the repo'],
  [(path) => path === 'pnpm-workspace.yaml', 'its settings move to pnpm-workspace.yaml at the root'],
  [(path) => path === '.nvmrc', 'one .nvmrc at the root of the repo'],
  [(path) => /^playwright\.config\.\w+$/.test(path), 'playwright.config.ts at the root runs the e2e/ of each app'],
  [(path) => path === 'CLAUDE.md', 'it becomes the skill <app>-conventions'],
];
// The block next dev of Next.js 16 writes into AGENTS.md, and writes again when it is gone: such a file stays.
const NEXT_AGENT_RULES = /^\s*<!-- BEGIN:nextjs-agent-rules -->[\s\S]*<!-- END:nextjs-agent-rules -->\s*$/;
const DEV_TOOLS = (name) => name === 'husky' || name.startsWith('@commitlint/');

// The files of a folder, relative, with forward slashes; .git/ left out.
function filesOf(dir) {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => relative(dir, join(entry.parentPath ?? entry.path, entry.name)).replaceAll('\\', '/'))
    .filter((path) => !path.startsWith('.git/'))
    .sort();
}

const excluded = (path, exclude) => exclude.some((prefix) => path === prefix.replace(/\/$/, '') || path.startsWith(prefix.endsWith('/') ? prefix : `${prefix}/`));

// Merges the settings of a template's pnpm-workspace.yaml into the root's, keeping the comments of both. Maps and lists
// gain what they lack; a value set in both must be the same. Returns { text, added, conflicts }.
export function mergeWorkspace(rootText, templateText) {
  const root = parseDocument(rootText);
  const template = parseDocument(templateText);
  const added = [];
  const conflicts = [];
  const show = (node) => JSON.stringify(node?.toJSON?.() ?? node);
  for (const pair of isMap(template.contents) ? template.contents.items : []) {
    const key = String(pair.key?.value ?? pair.key);
    if (key === 'packages') continue;
    const have = root.contents.items.find((item) => String(item.key?.value ?? item.key) === key);
    if (!have) {
      root.contents.items.push(pair);
      added.push(key);
    } else if (isMap(have.value) && isMap(pair.value)) {
      for (const inner of pair.value.items) {
        const name = String(inner.key?.value ?? inner.key);
        const same = have.value.items.find((item) => String(item.key?.value ?? item.key) === name);
        if (!same) {
          have.value.items.push(inner);
          added.push(`${key}.${name}`);
        } else if (show(same.value) !== show(inner.value)) conflicts.push(`${key}.${name}: ${show(same.value)} at the root, ${show(inner.value)} in the template`);
      }
    } else if (isSeq(have.value) && isSeq(pair.value)) {
      for (const item of pair.value.items) {
        if (!have.value.items.some((other) => show(other) === show(item))) {
          have.value.items.push(item);
          added.push(`${key}: ${show(item)}`);
        }
      }
    } else if (!(isScalar(have.value) && isScalar(pair.value) && have.value.value === pair.value.value)) {
      conflicts.push(`${key}: ${show(have.value)} at the root, ${show(pair.value)} in the template`);
    }
  }
  return { text: String(root), added, conflicts };
}

// The skill a template's own instructions become (plan, decision 7): read by the dev agent of the stack, under the
// contract of the kit.
export function conventionsSkill({ app, template, sha, parts }) {
  const name = `${app}-conventions`;
  return {
    name,
    text: [
      '---',
      `name: ${name}`,
      `description: The conventions of apps/${app}, from the instructions of its template. Read it before you write code in apps/${app}. The SDLC contract and the rules of ai-orchestrator win over it.`,
      '---',
      '',
      `# Conventions of apps/${app}`,
      '',
      `From ${parts.map(({ file }) => `\`${file}\``).join(' and ')} of the template \`${template}\` at \`${sha.slice(0, 8)}\`, copied by \`ao-kit add\`. Paths in it start at \`apps/${app}/\`. The SDLC contract, \`.claude/rules/ai-orchestrator.md\` and the definition of your role win over anything here: where this text says how to commit, branch, review or run CI, follow the kit instead.`,
      '',
      ...parts.flatMap(({ file, text }) => [`## From ${file}`, '', text.trim(), '']),
    ].join('\n'),
  };
}

// Copies HEAD of the template `from`, or its branch or tag `ref`, into apps/<app> of projectDir. exclude: paths of the
// template to leave out, such as study-guide-impl/. Returns { ok, notes, written, skill } where skill is { name } when CLAUDE.md or an AGENTS.md of
// its own became one; on a problem, { ok: false, notes } and nothing is written.
export function copyTemplate({ from, ref, projectDir, app, exclude = [], git }) {
  const stop = (note) => ({ ok: false, notes: [note], written: [], skill: null });
  const source = resolve(from);
  const target = join(projectDir, 'apps', app);
  if (existsSync(target)) return stop(`apps/${app} is in the project already: ao-kit add brings a new app only`);
  if (git(['rev-parse', 'HEAD'], source).status !== 0) return stop(`${from} is not a git repository with a commit: ao-kit add copies what the template has committed`);
  // A branch or a tag of the template, which need not be checked out there (Lượt 206: the branches of the user's templates).
  const head = git(['rev-parse', '--verify', '--quiet', `${ref ?? 'HEAD'}^{commit}`], source);
  if (head.status !== 0) return stop(`${from} has no branch or tag ${ref}`);
  const sha = head.stdout.trim();
  const notes = [];
  const dirty = ref ? [] : git(['status', '--porcelain'], source).stdout.split('\n').filter(Boolean);
  if (dirty.length > 0) notes.push(`${from} has ${dirty.length} changes not committed: only what ${sha.slice(0, 8)} holds is copied`);

  const clone = mkdtempSync(join(tmpdir(), 'ao-template-'));
  try {
    const cloned = git(['clone', '--quiet', '--depth', '1', ...(ref ? ['--branch', ref] : []), pathToFileURL(source).href, clone], projectDir);
    if (cloned.status !== 0) return stop(`git clone of ${from} failed: ${`${cloned.stderr ?? ''}`.trim()}`);
    const read = (path) => readFileSync(join(clone, path), 'utf8');
    const files = filesOf(clone).filter((path) => !excluded(path, exclude));
    const left = [];
    const copied = [];
    for (const path of files) {
      const rule = LEFT_OUT.find(([test]) => test(path));
      if (path === 'AGENTS.md' && NEXT_AGENT_RULES.test(read(path))) copied.push(path);
      else if (rule) left.push([path, rule[1]]);
      else if (path === 'AGENTS.md') left.push([path, 'it becomes part of the skill <app>-conventions']);
      else copied.push(path);
    }

    // The pnpm settings of the template, merged into those of the root before anything is written.
    const rootWorkspace = join(projectDir, 'pnpm-workspace.yaml');
    let workspace = null;
    if (files.includes('pnpm-workspace.yaml')) {
      workspace = mergeWorkspace(existsSync(rootWorkspace) ? readFileSync(rootWorkspace, 'utf8') : 'packages:\n  - apps/*\n', read('pnpm-workspace.yaml'));
      if (workspace.conflicts.length > 0) {
        return stop(`pnpm-workspace.yaml of ${from} and of the project set the same thing differently, so nothing is copied: ${workspace.conflicts.join('; ')}. Choose one value in pnpm-workspace.yaml at the root, and leave the template out of it with --exclude pnpm-workspace.yaml or change it there, then run ao-kit add again`);
      }
    }

    // The app's package.json: no husky, no commit rules; the root pins pnpm and runs lint-staged.
    const rootPackage = join(projectDir, 'package.json');
    const root = existsSync(rootPackage) ? JSON.parse(readFileSync(rootPackage, 'utf8')) : null;
    let pkg = null;
    const packageNotes = [];
    if (copied.includes('package.json')) {
      pkg = JSON.parse(read('package.json'));
      if (pkg.name !== app) packageNotes.push(`name ${pkg.name} → ${app}`);
      pkg.name = app;
      if (/\bhusky\b/.test(pkg.scripts?.prepare ?? '')) {
        delete pkg.scripts.prepare;
        packageNotes.push('the prepare script of husky');
      }
      for (const field of ['dependencies', 'devDependencies']) {
        for (const name of Object.keys(pkg[field] ?? {}).filter(DEV_TOOLS)) {
          delete pkg[field][name];
          packageNotes.push(name);
        }
      }
      if (pkg.packageManager) {
        packageNotes.push(`packageManager ${pkg.packageManager}, which the root names`);
        if (root && root.packageManager !== pkg.packageManager) notes.push(`The template pins ${pkg.packageManager} and the project ${root.packageManager ?? 'nothing'}: the root's applies`);
        delete pkg.packageManager;
      }
    }
    const lintStaged = pkg?.devDependencies?.['lint-staged'];

    // One Playwright for the repo: playwright.config.ts at the root runs the e2e/ of every app, and two versions break
    // the types of a test and its run (found with the two templates of the user, Lượt 203). The root takes the version
    // of the template while no other app pins one; after that, an app takes the root's.
    const PLAYWRIGHT = '@playwright/test';
    const wanted = pkg?.devDependencies?.[PLAYWRIGHT];
    let playwrightToRoot = false;
    if (wanted && root?.devDependencies?.[PLAYWRIGHT] && root.devDependencies[PLAYWRIGHT] !== wanted) {
      const appsDir = join(projectDir, 'apps');
      const others = existsSync(appsDir) ? readdirSync(appsDir).filter((name) => name !== app && existsSync(join(appsDir, name, 'package.json'))) : [];
      const pinned = others.some((name) => JSON.parse(readFileSync(join(appsDir, name, 'package.json'), 'utf8')).devDependencies?.[PLAYWRIGHT]);
      if (pinned) {
        packageNotes.push(`${PLAYWRIGHT} ${wanted} → ${root.devDependencies[PLAYWRIGHT]}, the version of the repo`);
        pkg.devDependencies[PLAYWRIGHT] = root.devDependencies[PLAYWRIGHT];
      } else {
        notes.push(`${PLAYWRIGHT} of the root: ${root.devDependencies[PLAYWRIGHT]} → ${wanted}, the version of the template, so the repo has one Playwright`);
        root.devDependencies[PLAYWRIGHT] = wanted;
        playwrightToRoot = true;
      }
    }

    // Its instructions, as a skill.
    const parts = ['CLAUDE.md', 'AGENTS.md'].filter((file) => left.some(([path]) => path === file)).map((file) => ({ file, text: read(file) }));
    const skill = parts.length > 0 ? conventionsSkill({ app, template: basename(source), sha, parts }) : null;

    // Now write.
    const written = [];
    for (const path of copied) {
      mkdirSync(join(target, path, '..'), { recursive: true });
      cpSync(join(clone, path), join(target, path));
      written.push(`apps/${app}/${path}`);
    }
    if (pkg) writeFileSync(join(target, 'package.json'), `${JSON.stringify(pkg, null, 2)}\n`);
    // The playwright-core of the repo follows its Playwright: a package such as @axe-core/playwright would pull a newer
    // one when the lockfile is made again (Lượt 207, the user's Next.js template in shop).
    const exact = /^\d+\.\d+\.\d+$/.test(root?.devDependencies?.[PLAYWRIGHT] ?? '') ? root.devDependencies[PLAYWRIGHT] : null;
    let workspaceText = workspace?.text ?? (existsSync(rootWorkspace) ? readFileSync(rootWorkspace, 'utf8') : null);
    if (exact && workspaceText !== null) {
      const doc = parseDocument(workspaceText);
      if (doc.getIn(['overrides', 'playwright-core']) !== exact) {
        doc.setIn(['overrides', 'playwright-core'], exact);
        workspaceText = String(doc);
        notes.push(`pnpm-workspace.yaml at the root pins playwright-core to ${exact}, the Playwright of the repo`);
      }
    }
    if (workspaceText !== null && (workspace || exact)) writeFileSync(rootWorkspace, workspaceText);
    if (workspace?.added.length > 0) notes.push(`pnpm-workspace.yaml at the root gained the settings of the template: ${workspace.added.join(', ')}`);
    if (files.includes('.nvmrc')) {
      const rootNvm = join(projectDir, '.nvmrc');
      const version = read('.nvmrc').trim();
      if (!existsSync(rootNvm)) {
        writeFileSync(rootNvm, `${version}\n`);
        notes.push(`.nvmrc at the root: ${version}, from the template`);
      } else if (readFileSync(rootNvm, 'utf8').trim() !== version) notes.push(`The template asks for Node ${version} in .nvmrc, the root for ${readFileSync(rootNvm, 'utf8').trim()}: the root's applies`);
    }
    if (root && lintStaged) {
      root.devDependencies = { ...root.devDependencies, 'lint-staged': root.devDependencies?.['lint-staged'] ?? lintStaged };
      if (!root.scripts?.precommit) root.scripts = { ...root.scripts, precommit: 'lint-staged' };
      notes.push('lint-staged runs from the root: the precommit script of package.json, which the pre-commit hook of the kit calls, finds the config of each app');
    }
    if (root && (lintStaged || playwrightToRoot)) writeFileSync(rootPackage, `${JSON.stringify(root, null, 2)}\n`);
    if (skill) {
      const dir = join(projectDir, '.claude', 'skills', skill.name);
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, 'SKILL.md'), skill.text);
      notes.push(`${parts.map(({ file }) => file).join(' and ')} of the template became the skill ${skill.name} (.claude/skills/${skill.name}/SKILL.md): read it in the PR, and drop what the kit does instead`);
    }

    // What was left out, by folder, and why.
    const byWhy = new Map();
    for (const [path, why] of left) {
      const shown = path.includes('/') ? `${path.split('/')[0]}/` : path;
      const entry = byWhy.get(why) ?? new Set();
      entry.add(shown);
      byWhy.set(why, entry);
    }
    for (const [why, paths] of byWhy) notes.push(`Left out ${[...paths].join(', ')}: ${why.replace('<app>', app)}`);
    if (exclude.length > 0) notes.push(`Left out as you asked: ${exclude.join(', ')}`);
    if (packageNotes.length > 0) notes.push(`package.json of apps/${app}: ${packageNotes.join('; ')}`);
    notes.unshift(`Copied ${written.length} files of ${basename(source)}${ref ? ` ${ref}` : ''} at ${sha.slice(0, 8)} into apps/${app}`);
    return { ok: true, notes, written, skill: skill && { name: skill.name } };
  } finally {
    rmSync(clone, { recursive: true, force: true });
  }
}
