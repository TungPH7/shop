// The review after merge (SPEC-review-per-item.md section 4): /ao-review <KEY> reviews at once the PRs of an Epic's items,
// or of one item, that merged into develop without review. What ao-step reads for it, what it posts after the runs of
// reviewer and security, and the words it posts. Pure.
import { createHash } from 'node:crypto';

// The note a run of the review after merge keeps on its record: the PRs it reviews, so that a run of the same set
// counts and one of another set does not.
export const afterMergeNote = (numbers) => `after-merge:${[...numbers].sort((a, b) => a - b).join(',')}`;
// The PRs of a note, back.
export const noteNumbers = (note) => (/^after-merge:([\d,]+)$/.exec(note ?? '')?.[1] ?? '').split(',').filter(Boolean).map(Number);

// The hash of a report, which ao-step keeps on the record of the run that wrote it, and checks before it posts: another
// role with .ai/** may write the file in between (review of shop PR #93, security Medium 1).
export const reportHash = (text) => createHash('sha256').update(text ?? '', 'utf8').digest('hex');

// The PRs a review after merge takes (spec 4.2): merged into develop, skipped review on their last head, no mark yet.
// pulls: [{ number, key, merged, skipped, mark }].
export const afterMergeTodo = (pulls = []) => pulls.filter(({ merged, skipped, mark }) => merged && skipped && !mark);

// The report a run saves (spec 4.4): .ai/reviews/<KEY>-<role>-<head>.md in the project folder, by the head it reviewed,
// so that the report of an earlier review after merge of KEY never passes for this one.
export const afterMergeReport = (key, role, head) => `${key}-${role}-${head.slice(0, 7)}.md`;

// The worktree of a run of the review after merge, at the head of develop it reviews.
export const afterMergeTree = (key, role) => `after-${key}-${role}`;

const oneLine = (text) => String(text ?? '').replace(/\s+/g, ' ').replaceAll('|', '/').trim();

// The Critical and High of the reports, which go to one fix Task (spec 4.5.1); the Medium and Low, which go to the
// findings Task. reports: { role: readReviewReport(...) }.
export function splitFindings(reports) {
  const all = Object.entries(reports).flatMap(([role, report]) => (report?.findings ?? []).map((finding) => ({ role, ...finding })));
  return { blocking: all.filter(({ severity }) => ['Critical', 'High'].includes(severity)), minor: all.filter(({ severity }) => ['Medium', 'Low'].includes(severity)) };
}

// The summary of the fix Task, by which a second run finds it.
export const fixSummary = (key, head) => `Sửa Critical và High của review sau merge ${key} ở ${head.slice(0, 7)}`;

// The fix Task (spec 4.5.1), from templates/task.md: its summary, description in Markdown, and the dev roles of the apps
// its findings are in (roleOf(where) gives the role of a Where, or null).
export function fixTask({ key, head, findings, pulls, roleOf }) {
  const roles = [...new Set(findings.map(({ where }) => roleOf(where)).filter(Boolean))].sort();
  const description = [
    `> **Epic:** ${key} · **Plan:** không có, ao-step tạo Task này từ lượt review sau merge (SPEC-review-per-item.md mục 4)`,
    '',
    '## Goal',
    '',
    `Sửa ${findings.length} finding Critical và High mà lượt review sau merge của ${key} tìm ra trên develop ở ${head.slice(0, 7)}, trong phần sửa của ${pulls.map((n) => `PR #${n}`).join(', ')}. Bản release chứa các PR đó chờ PR của Task này.`,
    '',
    '## Findings',
    '',
    '| Severity | Role | Where | Finding |',
    '|---|---|---|---|',
    ...findings.map(({ severity, role, where, finding }) => `| ${severity} | ${role} | ${oneLine(where)} | ${oneLine(finding)} |`),
    '',
    '## Technical Checklist',
    '',
    '- [ ] Mỗi finding có một test đỏ trước, rồi bản sửa.',
    ...(roles.length === 0 ? ['- [ ] Gắn nhãn role của dev agent sẽ làm (ao-be-dev, ao-fe-dev) trước khi build: các finding nằm ngoài app nào.'] : []),
    '',
    '## Dependencies',
    '',
    'Không có.',
    '',
    '## Verification',
    '',
    '- Mỗi finding trong bảng trên đã sửa, kèm test.',
    '- PR của Task này có review như thường: nó mang nhãn ao-review-on.',
  ].join('\n');
  return { summary: fixSummary(key, head), description, roles };
}

// The Sub-task of one role of a fix Task in several apps.
export const fixSubtask = (role, key) => ({ summary: `${role === 'be-dev' ? 'BE' : role === 'fe-dev' ? 'FE' : role}: sửa phần của ${role} trong review sau merge ${key}`, description: `Sửa các finding của bảng trong Task cha nằm ở app của ${role}.` });

// The first line of the comment on KEY, by which a second run finds it. It starts with ao-step, the signer of the kit's
// own comments, so that the reports in it, written by agents, never pass for a QA report (review of shop PR #93).
export const reportLine = (key, head) => `ao-step: Review sau merge ${key} ở ${head.slice(0, 7)}`;

// The comment on KEY in Jira (spec 4.5.3): the PRs, the part reviewed, the fix, and each report in full.
export function reportComment({ key, head, base, pulls, files, fix, reports }) {
  return [
    `${reportLine(key, head)}: ${pulls.map((n) => `PR #${n}`).join(', ')}.`,
    '',
    `Phần đã đọc: \`git diff ${base.slice(0, 7)} ${head.slice(0, 7)}\` trên ${files.length} file của các PR đó.`,
    fix ? `Critical và High: Task ${fix} sửa chúng. Bản release chứa các PR này chờ PR của ${fix}.` : 'Không có Critical hay High: bản release chứa các PR này không phải chờ gì thêm từ lượt review này.',
    ...Object.entries(reports).flatMap(([role, text]) => ['', `---`, '', `Báo cáo của ${role}:`, '', text.trim()]),
  ].join('\n');
}

// The source line of the Medium and Low in the findings Task, by which a second run finds them.
export const findingsSource = (key, head) => `lượt review sau merge ${key} ở ${head.slice(0, 7)}`;
