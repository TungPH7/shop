// What a review role reviews on a PR (dev-workflow spec 2.6; the reviewer too since C1 spec 3.2): only the changes
// since its last full report, when that report is readable and was posted by ao-review on a commit X that is an
// ancestor of the head, and the diff from X to the head has at most 300 added and deleted lines. Otherwise the whole PR.
// The new part has a tier (`tier`), and its protected paths are named (`protected`); Critical or High findings still
// open are passed on (`earlier`): the report of the new part lists each of them as Fixed or Open, and merge-gate keeps
// open those it leaves out (openFindings). Until Pilot 1, second review of ao-sample PR #13, both asked for a full
// review of the whole PR at max. Pure.
import { protectedPaths } from '../quality/merge-gate.mjs';
import { fullEffort, pathTier } from '../quality/review-tiers.mjs';

export const MAX_DELTA_LINES = 300;

const plural = (n) => `${n} Critical or High finding${n === 1 ? '' : 's'}`;

// The files of the compare since a report that the PR itself changes, by its own diff against its base (prFiles, the
// paths of /pulls/<n>/files). A merge of develop into the branch, to clear a conflict, brings the code of other PRs into
// the compare, reviewed already in those PRs: PR #41 of shop counted 3,749 lines, most of them SHOP-20 and SHOP-21, and
// security ran at max on them (Pilot 3). A renamed file counts by either of its names.
export function ownChanges(compareFiles, prFiles) {
  const own = new Set(prFiles);
  return compareFiles.filter(({ filename, previous_filename: previous }) => own.has(filename) || (previous && own.has(previous)));
}

// role: reviewer or security. report: its newest report as facts give it ({ sha, at, ok, blocking, open, onHead }), or
// null. full: the newest full one, the same when the newest has no Scope line; null when there is none. compare:
// GitHub's compare of the full report's commit X with the head ({ status, files }), or null.
// Returns { mode: 'none' | 'full' | 'delta', reason, since?, at?, lines?, tier?, protected?, earlier? }.
export function reviewScope({ role, report, full = report, compare, gates }) {
  if (!report) return { mode: 'full', reason: `no ${role} report on this PR yet` };
  if (report.onHead) return { mode: 'none', reason: `the ${role} report is on the head ${report.sha.slice(0, 7)}` };
  if (!report.ok) return { mode: 'full', reason: `the ${role} report on ${report.sha.slice(0, 7)} cannot be read` };
  if (!full) return { mode: 'full', reason: `no full ${role} report on this PR yet` };
  const since = full.sha.slice(0, 7);
  if (!full.ok) return { mode: 'full', reason: `the full ${role} report on ${since} cannot be read` };
  // ahead: the head has X and more. behind, diverged or no answer: a rebase or force-push took X out.
  if (compare?.status !== 'ahead') return { mode: 'full', reason: `${since} is no longer an ancestor of the head (rebase or force-push)` };
  const lines = compare.files.reduce((total, { additions = 0, deletions = 0 }) => total + additions + deletions, 0);
  if (lines > MAX_DELTA_LINES) return { mode: 'full', reason: `${lines} lines changed since ${since}, over ${MAX_DELTA_LINES}` };
  const paths = protectedPaths(compare.files, gates);
  // A new part of no file, after a merge of develop only, is not critical: there is nothing new to review in it.
  const tier = compare.files.length > 0 ? pathTier(compare.files, gates).tier : 'docs';
  // The findings to check: all that are open after the newest report, those it left out too (openFindings).
  const earlier = report.open ?? [];
  const reason = [`${lines} lines changed since ${since}`, paths.length > 0 && `on the protected path ${paths.join(', ')}`, earlier.length > 0 && `with ${plural(earlier.length)} open to check`].filter(Boolean).join(', ');
  return { mode: 'delta', reason, since: full.sha, at: full.at, lines, tier, ...(paths.length > 0 && { protected: paths }), ...(earlier.length > 0 && { earlier }) };
}

export const securityScope = (args) => reviewScope({ ...args, role: 'security' });

// The effort of a full review by `role` (C1 spec 3.1, 3.2): the higher of what the level of the item and the tier of
// the PR's files ask for. { effort, reason, tier }, effort null when the role does not run on such a PR. A heavy item
// is reviewed at the efforts of a critical PR, whatever its paths; a light or standard one by its tier. files: the
// paths the PR changes, a renamed file by both names; truncated: GitHub listed only part of them; level: the
// effective level of the item (lib/workflow/levels.mjs), standard when not given.
export function fullReviewEffort({ role = 'security', files, gates, rosterEffort, truncated = false, level = 'standard' }) {
  const { tier, paths, reason: why } = pathTier(files, gates, { truncated });
  if (level === 'heavy' && tier !== 'critical') return { effort: fullEffort(role, 'critical', rosterEffort), reason: 'the item is at level heavy', tier };
  const effort = fullEffort(role, tier, rosterEffort);
  const reason = {
    critical: why ?? `the PR touches the critical path ${paths.join(', ')}`,
    sensitive: `the PR touches the sensitive path ${paths.join(', ')}`,
    normal: 'the PR touches no sensitive or critical path',
    docs: 'the PR changes docs only',
  }[tier];
  return { effort, reason, tier };
}
