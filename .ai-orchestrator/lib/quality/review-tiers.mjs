// Review by risk (C1 spec section 3): the tier of a PR from the paths it changes, the effort of each review role, and
// the roles whose reports the merge needs. ao-step, merge-gate and audit all call these, on the PR's own list of files,
// so the review an agent skipped is the one the merge does not ask for. Pure.
import { isSteeringPath } from '../workflow/review-tree.mjs';
import { touchedPaths } from './diff-paths.mjs';
import { matchesGlob } from './glob.mjs';

// From the lowest. `docs`: every file is under review.docs_paths and none is critical.
export const TIERS = ['docs', 'normal', 'sensitive', 'critical'];

// The effort of each role on a full review, by tier (C1 spec 3.1, 3.2). null: the role does not run. `roster`: the
// roster's effort of the role (security keeps max there). A review of only the new part runs at high, or at the full
// effort of the tier of the new part when that is critical.
const EFFORTS = {
  docs: { reviewer: 'high', security: null },
  normal: { reviewer: 'high', security: null },
  sensitive: { reviewer: 'high', security: 'high' },
  critical: { reviewer: 'xhigh', security: 'roster' },
};
const DELTA_EFFORT = 'high';

// The names a PR changes: plain names, or the files of GET /pulls/{n}/files, a renamed one by both names.
const namesOf = (files = []) => (files.every((file) => typeof file === 'string') ? [...new Set(files)] : touchedPaths(files));

const matches = (globs, name) => globs.some((glob) => matchesGlob(glob, name, { ignoreCase: true }));

// The tier of one name: the protected paths are critical too, in any case, as merge-gate compares them. So is what
// steers an agent session at any depth, such as a CLAUDE.md or an AGENTS.md in an app, or a .claude/ there
// (review-tree.mjs): Markdown, but no doc, since Claude Code loads it as instructions for agents with Bash and git
// (review of shop PR #79). A docs PR or a waiver of a light item then never covers one.
function nameTier(name, gates) {
  const { review } = gates;
  if (isSteeringPath(name)) return 'critical';
  if (gates.protected_paths.some(({ path }) => matchesGlob(path, name, { ignoreCase: true })) || matches(review.critical_paths, name)) return 'critical';
  if (matches(review.sensitive_paths, name)) return 'sensitive';
  return 'normal';
}

// The gates with the project's own paths of a tier added: review.critical_paths and review.sensitive_paths of its
// .ai-orchestrator/project.yaml, a protected file the kit copy leaves alone (review of shop PR #79). They only add to
// the lists of the kit, so no project lowers a tier. config: the parsed project.yaml, or null.
export function withProjectPaths(gates, config) {
  const own = config?.review ?? {};
  const critical = own.critical_paths ?? [];
  const sensitive = own.sensitive_paths ?? [];
  if (critical.length === 0 && sensitive.length === 0) return gates;
  const { review } = gates;
  return { ...gates, review: { ...review, critical_paths: [...review.critical_paths, ...critical], sensitive_paths: [...review.sensitive_paths, ...sensitive] } };
}

// The highest tier the files touch, with the names of that tier: { tier, paths }. A PR with no file, or whose list
// GitHub cut short (`truncated`), counts as critical: its paths were not all checked.
export function pathTier(files, gates, { truncated = false } = {}) {
  const names = namesOf(files);
  if (truncated || names.length === 0) return { tier: 'critical', paths: [], reason: truncated ? 'GitHub listed only part of the files of the PR' : 'the PR changes no file' };
  const tiers = names.map((name) => [name, nameTier(name, gates)]);
  const top = TIERS[Math.max(...tiers.map(([, tier]) => TIERS.indexOf(tier)))];
  // A PR of docs only, such as a README in a dto folder, stays docs unless a file is critical (C1 spec 3.3).
  if (top !== 'critical' && names.every((name) => matches(gates.review.docs_paths, name))) return { tier: 'docs', paths: names };
  return { tier: top, paths: tiers.filter(([, tier]) => tier === top).map(([name]) => name) };
}

// The effort of `role` on a full review of a PR of `tier`, or null when the role does not run. rosterEffort: the
// roster's effort of the role.
export function fullEffort(role, tier, rosterEffort) {
  const effort = EFFORTS[tier]?.[role];
  if (effort === undefined) throw new Error(`no review effort for ${role} on a PR of tier ${tier}`);
  return effort === 'roster' ? rosterEffort : effort;
}

// The effort of a review of only the new part: high, or the full effort of the tier when the new part is critical.
export const deltaEffort = (role, deltaTier, rosterEffort) => (deltaTier === 'critical' ? fullEffort(role, 'critical', rosterEffort) : DELTA_EFFORT);

// The roles whose report the merge needs on the head (C1 spec 3.1): reviewer always; security when the tier makes it
// run, or once it has reported on the PR at all, so that undoing the change that called it in does not drop the High
// it found elsewhere. roles: the review roles of the App; reported: the roles with a report on the PR, any commit.
export function requiredReviewRoles({ roles, tier, reported = [] }) {
  return roles.filter((role) => fullEffort(role, tier, 'roster') !== null || reported.includes(role));
}
