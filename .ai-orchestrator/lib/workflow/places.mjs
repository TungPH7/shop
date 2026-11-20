// Where a run works (parallel-runs spec, part 1). With runs.worktrees on in project.yaml, the build and fix of each item
// run in a worktree of their own, its lane, next to the project folder: <parent>/<project>-wt/<KEY>. The project folder
// stays on develop. Reviews and QA keep the temporary worktrees they had. Pure, but checkoutBranch, which takes git.
import { basename, dirname, join } from 'node:path';

// The commands whose runs write on the branch of an item.
export const LANE_COMMANDS = ['build', 'fix'];
const REVIEWS = ['review', 'review-delta'];

// A key of a work item, as Jira writes it: the only part of a lane's path that comes from outside.
const KEY = /^[A-Z][A-Z0-9_]*-\d+$/;

// The folder that holds the lanes of a project, next to it.
export function laneRoot(projectDir) {
  const dir = projectDir.replace(/[\\/]+$/, '');
  return join(dirname(dir), `${basename(dir)}-wt`);
}

// The lane of an item. The key is checked, since it becomes a folder name.
export function laneDir(projectDir, key) {
  if (!KEY.test(key ?? '')) throw new Error(`${key} is not the key of a work item: no lane for it`);
  return join(laneRoot(projectDir), key);
}

// The key of the lane a run works in, or null for the project folder. Every run of /ao-build and /ao-fix works in the
// lane of its item, but a review, which keeps its temporary worktree: the dev agents, and ba or sa when a request
// changes the criteria or the plan on the branch of the PR, since that branch is checked out in the lane and git keeps a
// branch to one worktree. A Sub-task works in the lane of its Story, on the Story's branch. The runs of the Epic
// (/ao-spec, /ao-plan, /ao-request) stay in the project folder: they run alone (spec 5.1).
export function laneOf(run, { worktrees, command }) {
  // A review is known by its worktree, or by its purpose on the record of a run, which keeps no worktree.
  if (!worktrees || run.worktree || REVIEWS.includes(run.purpose) || !LANE_COMMANDS.includes(command)) return null;
  // A run with no branch to work on, as the build of an ops Task: a lane of it would never be pruned (review of shop PR #78).
  if (run.lane === false) return null;
  const key = run.story ?? run.key;
  return KEY.test(key ?? '') ? key : null;
}

// Puts a checkout on a branch, as before a run; git(...args) runs in that checkout and resolves { status, stdout,
// stderr }. A protected branch, such as develop, in a lane is checked out detached at its tip on origin: the project
// folder holds the branch itself, and git keeps a branch to one worktree. Resolves { ok, reason }.
export function checkoutBranch(git, { branch, from, pull }, { lane = false, isProtected = () => false } = {}) {
  const dirty = git('status', '--porcelain', '--untracked-files=no').stdout.trim();
  if (dirty) return { ok: false, reason: `the checkout has changes not committed (${dirty.split('\n').length} files): commit or stash them, then run the command again` };
  const fetched = git('fetch', '--quiet', 'origin');
  if (fetched.status !== 0) return { ok: false, reason: `git fetch failed: ${fetched.stderr.trim()}` };
  const onOrigin = git('rev-parse', '--verify', '--quiet', `refs/remotes/origin/${branch}`).status === 0;
  if (lane && isProtected(branch)) {
    if (!onOrigin) return { ok: false, reason: `origin has no ${branch} to start the lane from` };
    const detached = git('switch', '--quiet', '--detach', `origin/${branch}`);
    return detached.status === 0 ? { ok: true } : { ok: false, reason: `git could not put the lane on origin/${branch}: ${detached.stderr.trim()}` };
  }
  const local = git('rev-parse', '--verify', '--quiet', `refs/heads/${branch}`).status === 0;
  let result;
  if (local) result = git('switch', '--quiet', branch);
  else if (onOrigin) result = git('switch', '--quiet', '--track', `origin/${branch}`);
  // --no-track: the new branch must not take origin/develop as its upstream, or the agent's push would go there.
  else result = git('switch', '--quiet', '--no-track', '-c', branch, `origin/${from ?? 'develop'}`);
  if (result.status !== 0) return { ok: false, reason: `git could not switch to ${branch}: ${result.stderr.trim()}` };
  if ((pull || local) && onOrigin) {
    const merged = git('merge', '--ff-only', '--quiet', `origin/${branch}`);
    if (merged.status !== 0) return { ok: false, reason: `${branch} has commits that are not on origin/${branch}: ${merged.stderr.trim()}` };
  }
  return { ok: true };
}

// The lanes whose work is over: the PR of their branch is merged or closed, and none is open. lanes: [{ key, branch }];
// pulls: [{ headRef, state }] with state open, closed or merged. A lane with no branch yet, or whose branch has no PR,
// stays: its agent may still be at work, or stopped before it opened one.
export function lanesToPrune(lanes, pulls) {
  return lanes.filter(({ branch }) => {
    if (!branch) return false;
    const of = pulls.filter(({ headRef }) => headRef === branch);
    return of.length > 0 && of.every(({ state }) => state !== 'open');
  });
}

// The words added to the prompt of a run in a lane.
export const laneNote = (dir, key) =>
  `You work in the worktree ${dir.replaceAll('\\', '/')}, the lane of ${key}: this folder is the project, on your branch. The project folder itself stays on develop; do not read or change it. Your ledger goes in .ai/ledger/ of this folder.`;
