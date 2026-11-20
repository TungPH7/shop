// The process level of a work item (C1 spec section 2): light, standard or heavy, from its label ao-level-<level>
// (tracker/jira.yaml, work_labels.level_prefix), worked out again before each step. Pure.
//
// - No label: standard, so an item from before C1 keeps its process.
// - It only goes up by itself: a PR on a critical path makes it heavy, and a Critical or High finding of a review raises
//   it one step. A QA fail does not: a QA report gives no severity, and a fail raising standard to heavy would leave
//   no item for the QA again of level standard, which checks only the criteria that failed (decided while building
//   C1 step 4).
// - Only the human lowers it, by changing the label; never below what the tier of the PR asks for.

export const LEVELS = ['light', 'standard', 'heavy'];

const up = (level) => LEVELS[Math.min(LEVELS.indexOf(level) + 1, LEVELS.length - 1)];
const higher = (a, b) => (LEVELS.indexOf(a) >= LEVELS.indexOf(b) ? a : b);

// label: the level the item's label names, or null. tier: the tier of the PR (lib/quality/review-tiers.mjs), or null
// before there is one. blockingFound: a review of the PR found a Critical or High, on any commit. Returns { level,
// label, reasons }: reasons say why it is above the label.
export function effectiveLevel({ label = null, tier = null, blockingFound = false } = {}) {
  const start = LEVELS.includes(label) ? label : 'standard';
  const reasons = [];
  let level = start;
  if (blockingFound && level !== 'heavy') {
    level = up(level);
    reasons.push('a review found a Critical or High');
  }
  if (tier === 'critical' && level !== 'heavy') {
    level = higher(level, 'heavy');
    reasons.push('the PR touches a critical path');
  }
  return { level, label: LEVELS.includes(label) ? label : null, reasons };
}

// The level a label list names (work_labels.level_prefix), the highest when there are several, or null.
export function labelLevel(labels = [], prefix) {
  const named = labels.filter((label) => label.startsWith(prefix)).map((label) => label.slice(prefix.length)).filter((level) => LEVELS.includes(level));
  return named.sort((a, b) => LEVELS.indexOf(b) - LEVELS.indexOf(a))[0] ?? null;
}

// A reader of the level an item's label names, with a Jira client: for merge-gate and audit, which work a review
// waiver out again (C1 spec 3.4). Resolves to null when the item has no level label.
export const itemLevel = (jira, mapping) => async (key) => labelLevel((await jira.get(`/rest/api/3/issue/${encodeURIComponent(key)}`, { fields: 'labels' })).fields?.labels ?? [], mapping.work_labels.level_prefix);
