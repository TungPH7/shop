// Review per item (SPEC-review-per-item.md): whether a PR of an item skips review, the trace of the skip on its head,
// the mark of the review after merge on a merged PR, and what a release PR still waits for. ao-step, merge-gate and audit
// all work the choice out from Jira and GitHub; none of them takes a trace or a mark of another on trust beyond the
// login of the review App that posted it. Pure, but the two readers at the end, whose clients are parameters.
import { parse } from 'yaml';
import { PROJECT_FILE } from '../scaffold/project-config.mjs';
import { parseBranch } from '../tracker/conventions.mjs';

// The default of the project (spec 2.1): review.default of its project.yaml, on or off. Anything but off is on.
export const projectReviewDefault = (config) => (config?.review?.default === 'off' ? 'off' : 'on');

// The two labels of tracker/jira.yaml (spec 2.2), or null for a mapping without them: every item is then reviewed.
export function reviewLabels(mapping) {
  const { review_on: on, review_skip: skip } = mapping?.work_labels ?? {};
  return on && skip ? { on, skip } : null;
}

// Whether a PR can skip review at all (spec 2.6): an item's PR into develop. A PR into a release branch, a hotfix into
// main, a docs PR, a release report and a merge back keep their rules.
export function skipScope(pr) {
  const base = pr?.base?.ref ?? pr?.base;
  const head = pr?.head?.ref ?? pr?.headRef;
  const branch = parseBranch(head ?? '');
  return base === 'develop' && ['feature', 'bugfix'].includes(branch?.kind);
}

const words = (text) => (text ?? '').split(/\s+/).filter(Boolean);
const time = (value) => (typeof value === 'number' ? value : Date.parse(value ?? 0));
const newestFirst = (histories) => [...histories].sort((a, b) => time(b.created) - time(a.created));
const labelChanges = (history) => (history.items ?? []).filter((item) => item.field === 'labels');

// The labels of an item at the time `at` (spec 2.5): the changes of its labels after `at` undone, newest first.
export function labelsAt(labels = [], histories = [], at) {
  const kept = new Set(labels);
  for (const history of newestFirst(histories).filter(({ created }) => time(created) > time(at))) {
    for (const { fromString, toString } of labelChanges(history)) {
      const before = words(fromString);
      const after = words(toString);
      for (const label of after.filter((l) => !before.includes(l))) kept.delete(label);
      for (const label of before.filter((l) => !after.includes(l))) kept.add(label);
    }
  }
  return [...kept];
}

// The labels without the changes of the agents' account towards skipping review (spec 2.4): its ao-review-skip added is
// taken off again, its ao-review-on taken off is put back. Its changes towards review count: the main session uses
// that account too. Without the account id, the labels as they are.
export function trustedReviewLabels(labels = [], histories = [], { agentAccount, names }) {
  if (!agentAccount || !names) return labels;
  const kept = new Set(labels);
  for (const history of newestFirst(histories)) {
    if (history.author?.accountId !== agentAccount) continue;
    for (const { fromString, toString } of labelChanges(history)) {
      const before = words(fromString);
      const after = words(toString);
      if (after.includes(names.skip) && !before.includes(names.skip)) kept.delete(names.skip);
      if (before.includes(names.on) && !after.includes(names.on)) kept.add(names.on);
    }
  }
  return [...kept];
}

const choiceOf = (labels, names, projectDefault) => {
  if (labels.includes(names.on)) return { skip: false, why: 'label' };
  if (labels.includes(names.skip)) return { skip: true, why: 'label' };
  return { skip: projectDefault === 'off', why: 'default' };
};

// The review choice of an item (spec 2.2–2.5): { skip, why, ignored }. why: label or default. ignored: { label } when
// the labels now say skip but a change of the agents' account made them so; it does not count. at: the time of the
// merge, for audit; without it the labels as they are now. names: reviewLabels(mapping); without them, review.
export function reviewChoice({ labels = [], histories = [], agentAccount, names, projectDefault = 'on', at } = {}) {
  if (!names) return { skip: false, why: 'default', ignored: null };
  const then = at === undefined ? labels : labelsAt(labels, histories, at);
  const past = at === undefined ? histories : histories.filter(({ created }) => time(created) <= time(at));
  const now = choiceOf(then, names, projectDefault);
  const trusted = choiceOf(trustedReviewLabels(then, past, { agentAccount, names }), names, projectDefault);
  if (now.skip && trusted.skip) return { ...now, ignored: null };
  if (now.skip) return { ...trusted, ignored: { label: names.skip } };
  return { ...now, ignored: null };
}

// Why an item skips review, in words, for a stop, a status line and the trace.
export const skipReason = ({ why }, names) => (why === 'label' ? `label ${names?.skip ?? 'ao-review-skip'}` : 'the project default, review.default: off in project.yaml');

// The trace of a skip on the head (spec 3.1): a COMMENT review of the review App.
const SKIP_LINE = /^Review skipped:\s*([A-Z][A-Z0-9]{0,9}-\d{1,7})\s*$/m;
export function skipBody({ key, sha, reason, critical = [] }) {
  const warn = critical.length > 0
    ? ['', `**PR này sửa file critical mà không review:** ${critical.map((file) => `\`${file}\``).join(', ')}. Đọc kỹ diff của các file này trước khi approve.`]
    : [];
  return [
    `# Bỏ review: ${key}`,
    '',
    `Review skipped: ${key}`,
    `Head: ${sha}`,
    `Why: ${reason}`,
    ...warn,
    '',
    `Item ${key} bỏ review (SPEC-review-per-item.md mục 3), nên không agent nào review PR này. merge-gate và audit tự tính lại lựa chọn này từ Jira và project.yaml. PR vẫn cần CI xanh và approve của bạn trên head. Bản release chứa PR này cần một lượt review sau merge: /ao-review <Epic>. Muốn review ngay: /ao-review <PR> full.`,
  ].join('\n');
}

// The item key of the newest trace the App (`bot`) posted on `head`, or null.
export function skipOnHead(reviews = [], { bot, head }) {
  const trace = reviews.filter((review) => review.user?.login === bot && review.commit_id === head && SKIP_LINE.test(review.body ?? '')).at(-1);
  return trace ? SKIP_LINE.exec(trace.body)[1] : null;
}

// Whether a PR skipped review on its last head (spec 4.2, 5.1): the App left the trace of a skip there, and nothing
// else, so no report of a full review asked for afterwards.
export function skippedReview(reviews = [], { bot, head }) {
  const onHead = reviews.filter((review) => review.user?.login === bot && review.commit_id === head);
  return onHead.length > 0 && onHead.every((review) => skipOnHead([review], { bot, head }) !== null);
}

// The mark of a review after merge on a merged PR (spec 4.5.2): an issue comment of the review App.
const MARK = {
  key: /^Reviewed after merge:\s*([A-Z][A-Z0-9]{0,9}-\d{1,7})\s*$/m,
  head: /^Head:\s*([0-9a-f]{40})\s*$/m,
  blocking: /^Blocking:\s*(\d{1,4})\s*$/m,
  fix: /^Fix:\s*([A-Z][A-Z0-9]{0,9}-\d{1,7})\s*$/m,
};
export function markBody({ key, head, blocking, fix = null }) {
  const outcome = blocking > 0 ? `Lượt review này tìm ra ${blocking} Critical hay High; Task ${fix} sửa chúng, và bản release chứa PR này cần PR của ${fix}.` : 'Lượt review này không tìm ra Critical hay High nào.';
  return [
    `# Review sau merge: ${key}`,
    '',
    `Reviewed after merge: ${key}`,
    `Head: ${head}`,
    `Blocking: ${blocking}`,
    ...(blocking > 0 ? [`Fix: ${fix}`] : []),
    '',
    `PR này đã merge mà không review. Lượt review sau merge của ${key} đã đọc phần nó sửa, trên develop ở ${head.slice(0, 7)}. ${outcome} Báo cáo đầy đủ ở ${key} trên Jira.`,
  ].join('\n');
}

// A mark read back, or null: { key, head, blocking, fix }. A mark that counts Critical or High names its fix.
export function readMark(body) {
  const text = body ?? '';
  const key = MARK.key.exec(text)?.[1];
  const head = MARK.head.exec(text)?.[1];
  const blocking = MARK.blocking.exec(text)?.[1];
  if (!key || !head || blocking === undefined) return null;
  const fix = MARK.fix.exec(text)?.[1] ?? null;
  if (Number(blocking) > 0 && !fix) return null;
  return { key, head, blocking: Number(blocking), fix };
}

// The newest mark the App (`bot`) left among the issue comments of a PR, or null.
export function newestMark(comments = [], { bot }) {
  const marks = comments.filter((comment) => comment.user?.login === bot).map((comment) => readMark(comment.body)).filter(Boolean);
  return marks.at(-1) ?? null;
}

// What a release PR still waits for (spec 5.1): one line per PR the release brings that skipped review and has no
// mark, or whose mark counts Critical or High with no PR of its fix in the release. pulls: [{ number, key, skipped,
// mark }], every PR of an item the release brings.
export function releaseReviewGaps(pulls = []) {
  const keys = new Set(pulls.map(({ key }) => key));
  return pulls.filter(({ skipped }) => skipped).flatMap(({ number, key, mark }) => {
    if (!mark) return [`review after merge of #${number} (${key}), which skipped review: /ao-review <its Epic>`];
    if (mark.blocking === 0 || keys.has(mark.fix)) return [];
    return [`the PR of ${mark.fix}, which fixes the ${mark.blocking} Critical or High that the review after merge ${mark.key} found in #${number} (${key}), merged into this release`];
  });
}

// A reader of the choice of an item, for merge-gate and audit: (key, { at, projectDefault }) resolves { skip, why,
// ignored }, from its labels and their changelog read with a Jira client.
export const itemReview = (jira, mapping) => async (key, { at, projectDefault = 'on' } = {}) => {
  const path = `/rest/api/3/issue/${encodeURIComponent(key)}`;
  const labels = (await jira.get(path, { fields: 'labels' })).fields?.labels ?? [];
  const histories = await jira.getAll(`${path}/changelog`);
  const agentAccount = mapping.identities?.find(({ id }) => id === 'agents')?.account_id;
  return reviewChoice({ labels, histories, agentAccount, names: reviewLabels(mapping), projectDefault, at });
};

// The default of the project at a commit or branch on GitHub (spec 2.5): from its project.yaml there. Any failure reads
// as on, so that a file GitHub does not give never turns review off.
export async function projectDefaultAt(github, ref) {
  try {
    const found = await github.get(`/contents/${PROJECT_FILE}`, { ref });
    if (!found?.content) return 'on';
    return projectReviewDefault(parse(Buffer.from(found.content, 'base64').toString('utf8')));
  } catch {
    return 'on';
  }
}
