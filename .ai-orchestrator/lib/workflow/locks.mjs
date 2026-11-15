// Who may run now (parallel-runs spec, part 2). Each ao-step command that runs agents holds a lock while it runs:
// .ai/runs/active/<KEY>.json for a command on one item, .ai/runs/active/_project.json for a command that runs alone.
// admit decides from the live locks; takeLock writes the new one under a short mutex, so two commands started at the
// same moment cannot both pass. Pure, but takeLock and liveLocks, which take fs.

import { join } from 'node:path';

// The commands that may run next to others: each touches only its own item, its branch, its lane and its PR.
export const PARALLEL = ['build', 'fix', 'review', 'qa'];
// The commands of a dev agent: one at a time per role, as the WIP limit of the contract has it.
const DEV_COMMANDS = ['build', 'fix'];
// Whether each run of a command puts its role on the lock first (claimRole).
export const claimsRole = (command) => DEV_COMMANDS.includes(command);
const PROJECT = '_project';

// Whether a command may start next to the live ones: { ok: true, name, slot } or { ok: false, reason }. live: the locks
// of commands still running, [{ name, command, key, role, environment, slot, pid }]. cap: how many may run at once.
// A slot is the smallest number from 0 no live lock holds: the lane's ports are offset by it (spec 5.2).
export function admit({ live, command, key, role, environment, cap }) {
  const alone = live.find(({ name }) => name === PROJECT);
  if (alone) return { ok: false, reason: `ao-step is running ${what(alone)}, which runs alone` };
  if (!PARALLEL.includes(command) || cap <= 1) {
    if (live.length > 0) return { ok: false, reason: `ao-step is already running ${describe(live)}; ${PARALLEL.includes(command) ? 'agents run one at a time' : `/ao-${command} runs alone`}` };
    return { ok: true, name: PARALLEL.includes(command) ? key : PROJECT, slot: 0 };
  }
  const same = live.find((lock) => lock.key === key);
  if (same) return { ok: false, reason: `ao-step is already running ${same.command} on ${key} (process ${same.pid}): one run per item` };
  if (command === 'qa' && environment) {
    const testing = live.find((lock) => lock.command === 'qa' && lock.environment === environment);
    if (testing) return { ok: false, reason: `qa is testing ${testing.key} on ${environment} (process ${testing.pid}): one QA at a time on an environment, since the E2E tests share its data` };
  }
  if (DEV_COMMANDS.includes(command) && role) {
    const busy = live.find((lock) => DEV_COMMANDS.includes(lock.command) && lock.role === role);
    if (busy) return { ok: false, reason: `${role} is at work on ${busy.key} (process ${busy.pid}): a dev agent builds one item at a time` };
  }
  if (live.length >= cap) return { ok: false, reason: `${live.length} runs are going already, the most runs.lanes_max allows: ${describe(live)}` };
  const taken = new Set(live.map(({ slot }) => slot));
  let slot = 0;
  while (taken.has(slot)) slot += 1;
  return { ok: true, name: key, slot };
}

const what = ({ command, key, pid }) => `${command}${key ? ` ${key}` : ''} (process ${pid})`;
const describe = (live) => live.map(what).join(', ');

// The locks of commands still running; a lock whose process is gone is removed. One that cannot be read is removed only
// with clean, under the mutex: a read from outside, such as /ao-status, keeps it (review round 2 of shop PR #21). fs:
// { existsSync, readdirSync, readFileSync, rmSync }; alive(pid).
export function liveLocks(dir, { fs, alive, clean = false }) {
  if (!fs.existsSync(dir)) return [];
  const live = [];
  for (const file of fs.readdirSync(dir).filter((name) => name.endsWith('.json'))) {
    let lock;
    try {
      lock = JSON.parse(fs.readFileSync(join(dir, file), 'utf8'));
    } catch {
      lock = null;
    }
    if (lock && alive(lock.pid)) live.push({ ...lock, name: file.slice(0, -'.json'.length) });
    else if (lock || clean) fs.rmSync(join(dir, file), { force: true });
  }
  return live;
}

// Writes a lock whole: a file aside, then a rename over the lock, so a read never meets half of it (review round 2 of
// shop PR #21). fs adds renameSync.
function writeLock(fs, file, lock) {
  const aside = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(aside, `${JSON.stringify(lock)}\n`);
  fs.renameSync(aside, file);
}

// Runs decide() under the mutex file of the folder, so two commands cannot both read the locks before either writes.
// Resolves what decide returns, or { ok: false, reason } when the mutex stays busy.
async function underMutex(dir, pid, decide, { fs, alive, sleep, tries = 50 }) {
  fs.mkdirSync(dir, { recursive: true });
  const mutex = join(dir, '.admit');
  let held = false;
  for (let attempt = 0; attempt < tries && !held; attempt++) {
    try {
      fs.writeFileSync(mutex, String(pid), { flag: 'wx' });
      held = true;
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      // A mutex left by a process that died while it held it.
      const owner = Number(fs.readFileSync(mutex, 'utf8'));
      if (!alive(owner)) fs.rmSync(mutex, { force: true });
      else await sleep(100);
    }
  }
  if (!held) return { ok: false, reason: `the lock of the runs in ${dir} stayed busy` };
  try {
    return decide();
  } finally {
    fs.rmSync(mutex, { force: true });
  }
}

// Takes a lock for a command: under a mutex file, reads the live locks, admits or refuses, and writes the lock.
// Resolves { ok: true, file, slot } or { ok: false, reason }. fs adds writeFileSync and mkdirSync; sleep(ms).
export async function takeLock(dir, holder, { fs, alive, cap, sleep, tries = 50 }) {
  return underMutex(
    dir,
    holder.pid,
    () => {
      const decided = admit({ live: liveLocks(dir, { fs, alive, clean: true }), ...holder, cap });
      if (!decided.ok) return decided;
      const file = join(dir, `${decided.name}.json`);
      writeLock(fs, file, { ...holder, slot: decided.slot });
      return { ok: true, file, slot: decided.slot };
    },
    { fs, alive, sleep, tries },
  );
}

// Puts the role of the next run of build or fix on the command's lock (review of shop PR #21: /ao-build of a Story runs
// be-dev, then fe-dev, and the lock named only the first). A dev agent builds one item at a time, so while another
// command's run holds that role this one waits, looking again every poll ms, most times at most; its lock holds no role
// meanwhile, so two commands that wait for each other's role cannot both wait. onWait(busy) is told once. Resolves
// { ok: true, waited } or { ok: false, reason }.
export async function claimRole(dir, file, role, { fs, alive, sleep, poll = 30_000, most = 240, onWait = () => {} }) {
  for (let attempt = 0; attempt <= most; attempt++) {
    const result = await underMutex(
      dir,
      process.pid,
      () => {
        if (!fs.existsSync(file)) return { ok: false, reason: `the lock ${file} is gone` };
        const own = JSON.parse(fs.readFileSync(file, 'utf8'));
        const busy = liveLocks(dir, { fs, alive, clean: true }).find((lock) => join(dir, `${lock.name}.json`) !== file && DEV_COMMANDS.includes(lock.command) && lock.role === role);
        writeLock(fs, file, { ...own, role: busy ? null : role });
        return busy ? { ok: false, busy } : { ok: true, waited: attempt > 0 };
      },
      { fs, alive, sleep },
    );
    if (!result.busy) return result;
    if (attempt === 0) onWait(result.busy);
    if (attempt === most) return { ok: false, reason: `${role} stayed at work on ${result.busy.key} (process ${result.busy.pid}) while this command waited for it: a dev agent builds one item at a time` };
    await sleep(poll);
  }
  return { ok: false, reason: `${role} stayed busy` };
}
