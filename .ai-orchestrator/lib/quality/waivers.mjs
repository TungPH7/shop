// Review waived by rule, with a trace (C1 spec section 3.4): a PR whose every file is in the files of a waiver of
// quality/gates.yaml (review.waivers), for an item whose effective level is that waiver's level, needs no report. ao-step
// posts a COMMENT review on the head instead, as the review App, with the line "Waiver: <id>". merge-gate and audit
// work the rule out again from the PR's own files and the item's label, and never take the line on trust. Pure.
import { touchedPaths } from './diff-paths.mjs';
import { matchesGlob } from './glob.mjs';
import { pathTier } from './review-tiers.mjs';
import { effectiveLevel } from '../workflow/levels.mjs';

const namesOf = (files = []) => (files.every((file) => typeof file === 'string') ? [...new Set(files)] : touchedPaths(files));
const covers = (waiver, names) => names.length > 0 && names.every((name) => waiver.files.some((glob) => matchesGlob(glob, name, { ignoreCase: true })));

// The waivers whose files take in every file of the PR, whatever the level: whether the item's label is worth reading.
export const waiverCandidates = (files, gates) => (gates.review.waivers ?? []).filter((waiver) => covers(waiver, namesOf(files)));

// The waiver that holds for a PR, or null. files: its files, a renamed one by both names; label: the level its item's
// label names, or null; blockingFound: a review of the PR found a Critical or High; truncated: GitHub listed only part
// of its files. Returns { id, level, files }.
export function waiverFor({ files, gates, label, blockingFound = false, truncated = false }) {
  const names = namesOf(files);
  if (truncated || names.length === 0) return null;
  const { tier } = pathTier(names, gates);
  const { level } = effectiveLevel({ label, tier, blockingFound });
  const waiver = (gates.review.waivers ?? []).find((candidate) => candidate.level === level && covers(candidate, names));
  return waiver ? { id: waiver.id, level, files: names } : null;
}

// The line of the trace, and the review that carries it.
const WAIVER_LINE = /^Waiver:\s*([a-z0-9-]+)\s*$/m;
export function waiverBody({ id, level, files, key, sha }) {
  return [
    `# Review waiver: ${key}`,
    '',
    `Waiver: ${id}`,
    `Level: ${level}`,
    `Head: ${sha}`,
    '',
    `Mọi file của PR nằm trong danh sách miễn \`${id}\` của quality/gates.yaml, và mức hiệu lực của item là ${level}, nên PR không cần báo cáo review (C1 spec mục 3.4). merge-gate và audit tự tính lại luật này. Muốn review đủ: /ao-review <PR> full.`,
    '',
    'Files:',
    ...files.map((file) => `- ${file}`),
  ].join('\n');
}

// The waiver id of the newest review the App (`bot`) posted on `head` with a waiver line, or null.
export function waiverOnHead(reviews, { bot, head }) {
  const trace = reviews.filter((review) => review.user?.login === bot && review.commit_id === head && WAIVER_LINE.test(review.body ?? '')).at(-1);
  return trace ? WAIVER_LINE.exec(trace.body)[1] : null;
}
