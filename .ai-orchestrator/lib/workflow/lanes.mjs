// The lanes of a project on this machine (parallel-runs spec, part 1): each a worktree of the repository at
// <parent>/<project>-wt/<KEY>, made at the first run of an item that needs one, with the packages of the project and of
// the kit installed, the untracked files project.yaml lists copied in, and the ledger of the item. A lane goes once the
// PR of its branch is merged or closed and it holds no work that is not pushed; its ledgers come back to the project
// folder first. Every effect is a parameter, so tests run it on real repositories with no network.
//   projectDir
//   gitIn(dir)                  (...args) => { status, stdout, stderr }: git in a folder
//   install(dir)                installs the packages of the project and of the kit in a lane: { ok, reason, notes }
//   fs                          { existsSync, mkdirSync, copyFileSync, readdirSync }
//   pullsOf(branch)             resolves the PRs whose head is the branch: [{ number, state }], state open, closed or merged
//   isProtected(branch)
//   settings                    { worktrees, copy } of project.yaml (runsSettings)
import { dirname, join } from 'node:path';
import { checkoutBranch, laneDir, laneNote, laneOf, laneRoot, lanesToPrune } from './places.mjs';

const KEY = /^[A-Z][A-Z0-9_]*-\d+$/;

export function laneKeeper({ projectDir, gitIn, install, fs, pullsOf, isProtected, settings }) {
  const git = gitIn(projectDir);
  const root = laneRoot(projectDir);
  const exists = (dir) => fs.existsSync(join(dir, '.git'));

  // The lanes there are: [{ key, dir, branch }].
  function list() {
    if (!fs.existsSync(root)) return [];
    return fs
      .readdirSync(root, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && KEY.test(entry.name) && exists(join(root, entry.name)))
      .map(({ name }) => {
        const dir = join(root, name);
        return { key: name, dir, branch: gitIn(dir)('branch', '--show-current').stdout.trim() };
      });
  }

  // Copies a file of the project folder into the lane, when it is there; the path is relative and stays inside both.
  function copyIn(dir, path) {
    const from = join(projectDir, path);
    if (!fs.existsSync(from)) return null;
    const to = join(dir, path);
    fs.mkdirSync(dirname(to), { recursive: true });
    fs.copyFileSync(from, to);
    return path;
  }

  // The lane of an item, made when it is not there: detached at origin/develop, its packages installed, the files of
  // runs.copy and the ledger of the item copied in. Resolves { ok, dir, made, notes } or { ok: false, reason }.
  async function ensure(key) {
    const dir = laneDir(projectDir, key);
    if (exists(dir)) return { ok: true, dir, made: false, notes: [] };
    fs.mkdirSync(root, { recursive: true });
    const fetched = git('fetch', '--quiet', 'origin');
    if (fetched.status !== 0) return { ok: false, reason: `git fetch failed: ${fetched.stderr.trim()}` };
    const added = git('worktree', 'add', '--detach', '--quiet', dir, 'origin/develop');
    if (added.status !== 0) return { ok: false, reason: `git could not add the lane of ${key} at ${dir}: ${(added.stderr || added.stdout).trim()}` };
    const installed = await install(dir);
    if (!installed.ok) return { ok: false, reason: `the lane of ${key} is at ${dir}, but its packages are not installed: ${installed.reason}` };
    const copied = [...settings.copy, join('.ai', 'ledger', `${key}.md`)].map((path) => copyIn(dir, path)).filter(Boolean);
    const notes = [`Made the lane of ${key} at ${dir}.`, ...(installed.notes ?? []), ...(copied.length > 0 ? [`Copied into it: ${copied.join(', ')}.`] : [])];
    return { ok: true, dir, made: true, notes };
  }

  // The lane a run works in: { key, dir } once it is there, or null for the project folder.
  async function placeOf(run, command) {
    const key = laneOf(run, { worktrees: settings.worktrees, command });
    if (!key) return null;
    const lane = await ensure(key);
    if (!lane.ok) throw new Error(lane.reason);
    return { key, dir: lane.dir, notes: lane.notes };
  }

  // Puts the checkout of a run on its branch: in its lane, or the project folder as before.
  async function checkout(spec, run, command) {
    const key = laneOf(run, { worktrees: settings.worktrees, command });
    if (!key) return checkoutBranch(git, spec);
    const lane = await ensure(key);
    if (!lane.ok) return lane;
    return checkoutBranch(gitIn(lane.dir), spec, { lane: true, isProtected });
  }

  // Whether a ledger of an item is on this machine: in the project folder or in a lane.
  const ledgerExists = (key) => [projectDir, ...list().map(({ dir }) => dir)].some((dir) => fs.existsSync(join(dir, '.ai', 'ledger', `${key}.md`)));

  // Work in a lane that nothing else holds: changes not committed, or, when its PR was closed without a merge, commits
  // its branch on origin does not have. A merged PR holds the work of the branch, even once merge-gate deleted it.
  function unsaved({ dir, branch }, merged) {
    const g = gitIn(dir);
    if (g('status', '--porcelain', '--untracked-files=normal').stdout.trim()) return 'changes not committed';
    if (merged) return null;
    const ahead = g('rev-list', '--count', `origin/${branch}..HEAD`);
    if (ahead.status !== 0) return `commits on ${branch}, which is gone from origin`;
    return Number(ahead.stdout.trim()) > 0 ? 'commits not pushed' : null;
  }

  // The lanes whose PR is merged or closed go: their ledgers come back to the project folder first. A lane with work
  // that is not pushed stays, and is named. Resolves notes.
  async function prune() {
    const lanes = list();
    if (lanes.length === 0) return [];
    const pulls = [];
    for (const { branch } of lanes) if (branch) pulls.push(...(await pullsOf(branch)).map((pr) => ({ ...pr, headRef: branch })));
    const notes = [];
    for (const lane of lanesToPrune(lanes, pulls)) {
      const merged = pulls.some(({ headRef, state }) => headRef === lane.branch && state === 'merged');
      const held = unsaved(lane, merged);
      if (held) {
        notes.push(`The lane of ${lane.key} stays at ${lane.dir}: its PR is ${merged ? 'merged' : 'closed'}, but it has ${held}. Look at it, then remove it with git worktree remove.`);
        continue;
      }
      const ledgers = join(lane.dir, '.ai', 'ledger');
      const back = fs.existsSync(ledgers) ? fs.readdirSync(ledgers).filter((name) => name.endsWith('.md')) : [];
      for (const name of back) {
        fs.mkdirSync(join(projectDir, '.ai', 'ledger'), { recursive: true });
        fs.copyFileSync(join(ledgers, name), join(projectDir, '.ai', 'ledger', name));
      }
      const removed = git('worktree', 'remove', '--force', lane.dir);
      notes.push(removed.status === 0 ? `Removed the lane of ${lane.key}: its PR is ${merged ? 'merged' : 'closed'}${back.length > 0 ? '; its ledgers are back in .ai/ledger/' : ''}.` : `The lane of ${lane.key} could not be removed: ${(removed.stderr || removed.stdout).trim()}`);
    }
    git('worktree', 'prune');
    return notes;
  }

  return { list, ensure, placeOf, checkout, ledgerExists, prune, note: laneNote };
}

// The runs part of project.yaml, checked: { worktrees, lanesMax, minFreeRamGb, portStep, copy }. Off and one lane when
// absent. lanes_max is also how many agents run at once (spec 6, Lượt 25 and 29); from 2 it needs worktrees. A path of
// runs.copy is relative and stays inside the project, since it is copied out of it and into a lane.
export function runsSettings(config) {
  const runs = config?.runs ?? {};
  const worktrees = runs.worktrees === true;
  const lanesMax = runs.lanes_max ?? 1;
  if (!Number.isInteger(lanesMax) || lanesMax < 1 || lanesMax > 6) throw new Error(`runs.lanes_max of project.yaml is ${JSON.stringify(runs.lanes_max)}: a whole number from 1 to 6`);
  if (lanesMax > 1 && !worktrees) throw new Error(`runs.lanes_max of project.yaml is ${lanesMax}, which needs runs.worktrees: true`);
  const minFreeRamGb = runs.min_free_ram_gb ?? 3;
  if (typeof minFreeRamGb !== 'number' || minFreeRamGb < 0 || minFreeRamGb > 64) throw new Error(`runs.min_free_ram_gb of project.yaml is ${JSON.stringify(runs.min_free_ram_gb)}: a number of GB from 0 to 64`);
  const portStep = runs.port_step ?? 100;
  if (!Number.isInteger(portStep) || portStep < 10 || portStep > 1000) throw new Error(`runs.port_step of project.yaml is ${JSON.stringify(runs.port_step)}: a whole number from 10 to 1000`);
  const copy = runs.copy ?? [];
  if (!Array.isArray(copy)) throw new Error('runs.copy of project.yaml is not a list of paths');
  for (const path of copy) {
    const plain = String(path).replaceAll('\\', '/');
    if (typeof path !== 'string' || plain === '' || plain.startsWith('/') || /^[A-Za-z]:/.test(plain) || plain.split('/').includes('..')) {
      throw new Error(`runs.copy of project.yaml has ${JSON.stringify(path)}: each path is relative and stays inside the project`);
    }
  }
  return { worktrees, lanesMax, minFreeRamGb, portStep, copy };
}
