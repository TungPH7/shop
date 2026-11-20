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

// The labels of an item without the changes of a level label the agents' account made after the item was created
// (review of shop PR #79). Only the human lowers a level, but an agent with the Jira permission edit writes the whole
// label list when it flags an item, so it could write a lower level there; block-atlassian cannot tell, since it does
// not read the item. ba creates the items of the plan with their level, which the changelog does not show, so that
// stays. histories: the values of GET /issue/{key}/changelog. agentAccount: the account id of the agents' identity;
// without it, the labels as they are. Changes are undone newest first, so a level the human set after an agent's
// change stays.
export function trustedLabels(labels = [], histories = [], { agentAccount, prefix }) {
  if (!agentAccount) return labels;
  const levels = (text) => (text ?? '').split(/\s+/).filter((label) => label.startsWith(prefix));
  const kept = new Set(labels);
  const newestFirst = [...histories].sort((a, b) => Date.parse(b.created ?? 0) - Date.parse(a.created ?? 0));
  for (const { author, items = [] } of newestFirst) {
    if (author?.accountId !== agentAccount) continue;
    for (const { fromString, toString } of items.filter((item) => item.field === 'labels')) {
      const before = levels(fromString);
      const after = levels(toString);
      for (const label of after.filter((l) => !before.includes(l))) kept.delete(label);
      for (const label of before.filter((l) => !after.includes(l))) kept.add(label);
    }
  }
  return labels.filter((label) => kept.has(label)).concat([...kept].filter((label) => !labels.includes(label)));
}

// The level an item's labels name, without a change of the agents' account that lowered it: { level, ignored }. The
// main session calls Jira with the agents' token too, so a level you raise through it is a change of that account: it
// counts, and only a change that lowers the level is left out (second review of shop PR #79). level is the higher of the
// label now and the label without the agents' changes (trustedLabels), no label counting as standard; null when that is
// no label. ignored: { label } when a lower label now on the item does not count (label null: the level label was
// taken off), for /ao-status and the review to say so; else null.
export function trustedLevel(labels = [], histories = [], { agentAccount, prefix }) {
  const now = labelLevel(labels, prefix);
  const trusted = labelLevel(trustedLabels(labels, histories, { agentAccount, prefix }), prefix);
  const rank = (level) => LEVELS.indexOf(level ?? 'standard');
  return rank(now) >= rank(trusted) ? { level: now, ignored: null } : { level: trusted, ignored: { label: now } };
}

// The account id of the agents' identity of tracker/jira.yaml, or undefined: its unsigned comments are an agent's, not
// the human's (review of PR #21), and its changes of a level label do not count.
export const agentsAccount = (mapping) => mapping.identities?.find(({ id }) => id === 'agents')?.account_id;

// A reader of the level an item's label names, with a Jira client: for merge-gate and audit, which work a review
// waiver out again (C1 spec 3.4). A level the agents' account lowered does not count (trustedLevel). Resolves to null
// when the item has no level label.
export const itemLevel = (jira, mapping) => async (key) => {
  const path = `/rest/api/3/issue/${encodeURIComponent(key)}`;
  const labels = (await jira.get(path, { fields: 'labels' })).fields?.labels ?? [];
  const histories = await jira.getAll(`${path}/changelog`);
  const prefix = mapping.work_labels.level_prefix;
  return trustedLevel(labels, histories, { agentAccount: agentsAccount(mapping), prefix }).level;
};
