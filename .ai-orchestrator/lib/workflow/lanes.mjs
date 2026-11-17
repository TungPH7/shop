// The lanes of a project on this machine (parallel-runs spec, part 1): each a worktree of the repository at
// <parent>/<project>-wt/<KEY>, made at the first run of an item that needs one, with the packages of the project and of
// the kit installed, the untracked files project.yaml lists copied in, and the ledger of the item. A lane goes once the
// PR of its branch is merged or closed and it holds no work that is not pushed; its ledgers and the preview of its item
// come back to the project folder first. Every effect is a parameter, so tests run it on real repositories with no
// network.
//   projectDir
//   gitIn(dir)                  (...args) => { status, stdout, stderr }: git in a folder
//   install(dir)                installs the packages of the project and of the kit in a lane: { ok, reason, notes }
//   fs                          { existsSync, mkdirSync, copyFileSync, cpSync, readdirSync, rmSync, statSync, writeFileSync }
//   pullsOf(branch)             resolves the PRs whose head is the branch: [{ number, state }], state open, closed or merged
//   isProtected(branch)
//   settings                    { worktrees, lanesMax, copy } of project.yaml (runsSettings)
//   busy(key)                   whether another command runs on the item now: its lane is not pruned
import { dirname, join } from 'node:path';
import { checkoutBranch, laneDir, laneNote, laneOf, laneRoot, lanesToPrune } from './places.mjs';

const KEY = /^[A-Z][A-Z0-9_]*-\d+$/;
// Written in a lane once its packages are installed and its files copied: git ignores .ai/. A lane without it was cut
// short, so the next run finishes it (review of shop PR #21: one whose install failed was taken as ready).
const READY = join('.ai', 'lane-ready');

export function laneKeeper({ projectDir, gitIn, install, fs, pullsOf, isProtected, settings, busy = () => false, sleep = (ms) => new Promise((done) => setTimeout(done, ms)) }) {
  const git = gitIn(projectDir);
  const root = laneRoot(projectDir);
  const exists = (dir) => fs.existsSync(join(dir, '.git'));
  const ready = (dir) => fs.existsSync(join(dir, READY));

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

  // runs.lanes_max is also how many lanes are open at once, those of items that wait for you included (spec 5.1;
  // review round 2 of shop PR #21): each holds a full install of the packages. The open lanes are counted and the new
  // one reserved, as its empty folder, in one step under the mutex .reserve of the lane folder, so two commands that
  // start together cannot both pass the cap (review round 3); a reserved folder counts as open. A mutex older than a
  // minute was left by a command that died. Resolves { ok: true } or { ok: false, reason }.
  async function reserve(key, dir) {
    fs.mkdirSync(root, { recursive: true });
    const mutex = join(root, '.reserve');
    let held = false;
    for (let attempt = 0; attempt < 100 && !held; attempt++) {
      try {
        fs.writeFileSync(mutex, String(process.pid), { flag: 'wx' });
        held = true;
      } catch (error) {
        if (error.code !== 'EEXIST') throw error;
        // One released since the write met it is taken at the next try (review round 4 of shop PR #21).
        let age;
        try {
          age = Date.now() - fs.statSync(mutex).mtimeMs;
        } catch (gone) {
          if (gone.code === 'ENOENT') continue;
          throw gone;
        }
        if (age > 60_000) fs.rmSync(mutex, { force: true });
        else await sleep(100);
      }
    }
    if (!held) return { ok: false, reason: `the mutex ${mutex} of the lanes stayed busy` };
    try {
      const open = fs
        .readdirSync(root, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && KEY.test(entry.name) && entry.name !== key)
        .map(({ name }) => name);
      if (open.length >= (settings.lanesMax ?? Infinity)) {
        return { ok: false, reason: `${open.length} lanes are open (${open.join(', ')}), the most runs.lanes_max allows: ${key} waits until the PR of one is merged or closed, which removes its lane at the next command` };
      }
      fs.mkdirSync(dir, { recursive: true });
      return { ok: true };
    } finally {
      fs.rmSync(mutex, { force: true });
    }
  }

  // The lane of an item, made when it is not there: detached at origin/develop, its packages installed, the files of
  // runs.copy and the ledger of the item copied in. A lane cut short before that is finished, with the files of the
  // project folder: an agent that worked in it wrote its own ledger there. Resolves { ok, dir, made, notes } or
  // { ok: false, reason }.
  async function ensure(key) {
    const dir = laneDir(projectDir, key);
    if (exists(dir) && ready(dir)) return { ok: true, dir, made: false, notes: [] };
    const made = !exists(dir);
    if (made) {
      const reserved = await reserve(key, dir);
      if (!reserved.ok) return reserved;
      // A lane that git could not add gives back its place: its folder goes while it is empty.
      const giveBack = (reason) => {
        if (fs.existsSync(dir) && fs.readdirSync(dir).length === 0) fs.rmSync(dir, { recursive: true, force: true });
        return { ok: false, reason };
      };
      const fetched = git('fetch', '--quiet', 'origin');
      if (fetched.status !== 0) return giveBack(`git fetch failed: ${fetched.stderr.trim()}`);
      const added = git('worktree', 'add', '--detach', '--quiet', dir, 'origin/develop');
      if (added.status !== 0) return giveBack(`git could not add the lane of ${key} at ${dir}: ${(added.stderr || added.stdout).trim()}`);
    }
    const installed = await install(dir);
    if (!installed.ok) return { ok: false, reason: `the lane of ${key} is at ${dir}, but its packages are not installed: ${installed.reason}` };
    const ledger = join('.ai', 'ledger', `${key}.md`);
    const copied = [...settings.copy, ...(made || !fs.existsSync(join(dir, ledger)) ? [ledger] : [])].map((path) => copyIn(dir, path)).filter(Boolean);
    fs.mkdirSync(join(dir, '.ai'), { recursive: true });
    fs.writeFileSync(join(dir, READY), `${new Date().toISOString()}\n`);
    const first = made ? `Made the lane of ${key} at ${dir}.` : `Finished the lane of ${key} at ${dir}: its packages were not installed before.`;
    const notes = [first, ...(installed.notes ?? []), ...(copied.length > 0 ? [`Copied into it: ${copied.join(', ')}.`] : [])];
    return { ok: true, dir, made, notes };
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
      // Another command may be between making the lane and putting it on a new branch (review round 2 of shop PR #21).
      if (busy(lane.key)) {
        notes.push(`The lane of ${lane.key} stays: another command runs on ${lane.key}.`);
        continue;
      }
      const merged = pulls.some(({ headRef, state }) => headRef === lane.branch && state === 'merged');
      const held = unsaved(lane, merged);
      if (held) {
        notes.push(`The lane of ${lane.key} stays at ${lane.dir}: its PR is ${merged ? 'merged' : 'closed'}, but it has ${held}. Look at it, then remove it with git worktree remove.`);
        continue;
      }
      const ledgers = join(lane.dir, '.ai', 'ledger');
      // A ledger comes back unless the project folder has it newer, such as one qa wrote there after the lane did (review
      // round 2 of shop PR #21).
      const ledgerFiles = fs.existsSync(ledgers) ? fs.readdirSync(ledgers).filter((name) => name.endsWith('.md')) : [];
      const home = (name) => join(projectDir, '.ai', 'ledger', name);
      const newerHome = ledgerFiles.filter((name) => fs.existsSync(home(name)) && fs.statSync(home(name)).mtimeMs > fs.statSync(join(ledgers, name)).mtimeMs);
      const back = ledgerFiles.filter((name) => !newerHome.includes(name));
      for (const name of back) {
        fs.mkdirSync(join(projectDir, '.ai', 'ledger'), { recursive: true });
        fs.copyFileSync(join(ledgers, name), home(name));
      }
      // The screenshots and API samples of the item's dev agents (review of shop PR #21).
      const preview = join('.ai', 'runs', lane.key, 'preview');
      const previewBack = fs.existsSync(join(lane.dir, preview));
      if (previewBack) fs.cpSync(join(lane.dir, preview), join(projectDir, preview), { recursive: true });
      const kept = [
        ...(back.length > 0 ? ['its ledgers are back in .ai/ledger/'] : []),
        ...newerHome.map((name) => `.ai/ledger/${name} of the project folder is newer and stays`),
        ...(previewBack ? [`its preview in .ai/runs/${lane.key}/preview/`] : []),
      ];
      const removed = git('worktree', 'remove', '--force', lane.dir);
      notes.push(removed.status === 0 ? `Removed the lane of ${lane.key}: its PR is ${merged ? 'merged' : 'closed'}${kept.length > 0 ? `; ${kept.join(', ')}` : ''}.` : `The lane of ${lane.key} could not be removed: ${(removed.stderr || removed.stdout).trim()}`);
    }
    git('worktree', 'prune');
    return notes;
  }

  return { list, ensure, placeOf, checkout, ledgerExists, prune, note: laneNote };
}

// The runs part of project.yaml, checked: { worktrees, lanesMax, minFreeRamGb, portStep, copy, laneEnv }. Off and one lane when
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
  return { worktrees, lanesMax, minFreeRamGb, portStep, copy, laneEnv: laneEnvSettings(runs.lane_env) };
}

// runs.lane_env (review of shop PR #21): ports, variables whose port each lane moves, below 59536 so six lanes 1000
// apart stay under 65536; names, variables each lane ends with -s<slot>, in the letters Docker Compose takes for a
// project name.
const VARIABLE = /^[A-Z_][A-Z0-9_]*$/;
const NAME = /^[a-z0-9][a-z0-9_.-]{0,60}$/;
function laneEnvSettings(laneEnv = {}) {
  const ports = laneEnv.ports ?? {};
  const names = laneEnv.names ?? {};
  for (const [name, port] of Object.entries(ports)) {
    if (!VARIABLE.test(name) || !Number.isInteger(port) || port < 1 || port > 59535) throw new Error(`runs.lane_env.ports of project.yaml has ${name}: ${JSON.stringify(port)}: a variable in capitals, and a port from 1 to 59535`);
  }
  for (const [name, value] of Object.entries(names)) {
    if (!VARIABLE.test(name) || typeof value !== 'string' || !NAME.test(value)) throw new Error(`runs.lane_env.names of project.yaml has ${name}: ${JSON.stringify(value)}: a variable in capitals, and a name of lower-case letters, digits, -, _ and .`);
    if (name in ports) throw new Error(`runs.lane_env of project.yaml: ${name} is both a port and a name`);
  }
  return { ports, names };
}
