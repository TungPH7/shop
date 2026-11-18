// How ao-step starts a run when lanes and parallel runs are on (parallel-runs spec 4 and 5), out of ao-step.mjs so tests
// reach it (review of shop PR #21): where the run works, its ports and variables, the RAM check before its agent, the qa run
// stopped when another deploy reaches its environment, the install of a new lane and the PRs of a lane's branch. Every
// effect is a parameter.
import { join } from 'node:path';
import { laneEnv, lanePorts, portOffset, portsNote } from './ports.mjs';

// The run as it starts: in its lane when it has one, told so; its ports and the variables of runs.lane_env moved by its
// slot when more than one run may go at once or it works in a lane, so it meets neither another run nor the apps and
// database you run in the project folder. keeper: laneKeeper; runs: runsSettings; apps: the apps of project.yaml;
// admitAgent() resolves once the agent may start, after the RAM check of locks.mjs (admitAgent there), or throws with the
// reason; log(line) gets what making the lane did.
export function runPlacer({ keeper, command, cap, slot, runs, apps, admitAgent, log = () => {} }) {
  return async (run) => {
    const place = await keeper.placeOf(run, command);
    for (const line of place?.notes ?? []) log(line);
    // Another agent starts only with enough free RAM while one runs (spec 5.1).
    if (cap > 1) await admitAgent();
    const moved = cap > 1 || Boolean(place);
    const offset = moved ? portOffset(slot, runs.portStep) : 0;
    const env = moved ? laneEnv(runs.laneEnv, slot, offset) : {};
    const ports = moved ? portsNote(lanePorts(apps, offset), offset, env) : null;
    const notes = [place && keeper.note(place.dir, place.key), ports].filter(Boolean);
    return {
      ...run,
      ...(place && { cwd: place.dir }),
      ...(moved && { env: { ...run.env, ...env } }),
      ...(notes.length > 0 && { prompt: [...notes, run.prompt].join('\n\n') }),
    };
  };
}

// A qa run stops at once when another deploy reaches its environment during the run (spec 5.1): its report would be
// about a version that no longer runs. Returns watch(run, start), where start(run, onStart(pid)) runs the agent; the
// result gets superseded with the reason, and the runner decides again, twice at most per command. readSha(environment)
// resolves the commit that runs there now; kill(pid) stops the agent and its children; every(fn, ms) and stop(timer)
// are setInterval and clearInterval.
export function qaWatcher({ readSha, kill, every = setInterval, stop = clearInterval, interval = 30_000, most = 2 }) {
  let superseded = 0;
  return async (run, start) => {
    if (!run.qa?.sha || superseded >= most) return start(run);
    let pid = null;
    let changed = null;
    const timer = every(async () => {
      if (pid === null || changed) return;
      const now = await readSha(run.qa.environment).catch(() => null);
      if (now && now !== run.qa.sha) {
        changed = now;
        kill(pid);
      }
    }, interval);
    try {
      const result = await start(run, (started) => (pid = started));
      if (!changed) return result;
      superseded += 1;
      return { ...result, superseded: `${run.qa.environment} ran ${run.qa.sha.slice(0, 8)} when qa started, and ${changed.slice(0, 8)} came during the run: qa was stopped before its report, and runs again on the new version` };
    } finally {
      stop(timer);
    }
  };
}

// The PRs whose head is a branch of this repository: [{ number, state }], state open, closed or merged.
export async function pullsOfBranch(github, repo, branch) {
  const [owner] = repo.split('/');
  const pulls = await github.getAll('/pulls', { state: 'all', head: `${owner}:${branch}` });
  return pulls.map((pr) => ({ number: pr.number, state: pr.merged_at ? 'merged' : pr.state }));
}

// Installs the packages of a lane (spec 4.2): those of the project by its lockfile, with the install scripts the project
// folder ran too, since the lane starts at origin/develop; and those of the kit copy, which agents run from the lane
// (ao-pr.mjs), with no scripts. env holds none of your secrets. exists(path), manager(exists) the package manager of the
// lockfile or null, args(manager, options) its install arguments, run(manager, args, options) runs it.
export function installLane(dir, { env, exists, manager, args, run }) {
  const notes = [];
  const options = { cwd: dir, env, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 };
  const found = manager((file) => exists(join(dir, file)));
  if (found) {
    const done = run(found, args(found), options);
    if (done.status !== 0) return { ok: false, reason: `${found} ${args(found)[0]} failed: ${(done.stderr || done.error?.message || '').trim().slice(-500)}` };
    notes.push(`Installed the packages of the project with ${found}.`);
  }
  if (exists(join(dir, '.ai-orchestrator', 'package-lock.json'))) {
    const kit = run('npm', [...args('npm', { ignoreScripts: true }), '--prefix', '.ai-orchestrator'], options);
    if (kit.status !== 0) return { ok: false, reason: `npm ci of .ai-orchestrator failed: ${(kit.stderr || kit.error?.message || '').trim().slice(-500)}` };
    notes.push('Installed the packages of the kit copy.');
  }
  return { ok: true, notes };
}
