// The findings Task of an Epic (C1 spec sections 2 and 4): the Medium and Low findings a review left on a PR that
// merged go to one Task of the Epic, labelled ao-findings, which blocks the Epic. ao-step makes it with the CI token at
// the first such finding, then adds one comment per PR; you Refine it when you want them fixed. Pure.

// The comment that records the findings of PR `pr` of item `key`: its first line names the PR, which is how ao-step
// tells it recorded them already. findings: [{ role, severity, where, finding, id, asked? }].
// source: where they come from, when not from one PR: a review after merge (SPEC-review-per-item.md 4.5.4).
export function findingsComment({ key, pr, findings, source }) {
  const lines = findings.map(({ role, severity, where, finding, id, asked }) => `- ${severity}${asked ? ` (${asked} không có dòng tái hiện)` : ''} ${id}, ${role}: ${oneLine(where)}: ${oneLine(finding)}`);
  return [`Finding chưa sửa của ${source ?? `PR #${pr} (${key})`}:`, '', ...lines].join('\n');
}

export const recordedLine = (pr) => `Finding chưa sửa của PR #${pr} `;

const oneLine = (text) => String(text ?? '').replace(/\s+/g, ' ').trim();

// The Task itself, from templates/task.md: its summary and its description in Markdown.
export function findingsTask({ epic }) {
  return {
    summary: `Finding Medium và Low chưa sửa của ${epic}`,
    description: [
      `> **Epic:** ${epic} · **Plan:** không có, ao-step tạo Task này (C1 spec mục 2)`,
      '',
      '## Goal',
      '',
      `Gom các finding Medium và Low mà review để lại trên các PR đã merge của ${epic}. Mỗi comment là một PR, ghi mức, mã finding, role và chỗ.`,
      '',
      '## Technical Checklist',
      '',
      '- [ ] Với từng finding: sửa nếu nó còn đúng trên develop, hoặc ghi vì sao bỏ.',
      '- [ ] Gắn nhãn role của dev agent sẽ làm (ao-be-dev, ao-fe-dev) trước khi Refine.',
      '',
      '## Dependencies',
      '',
      'Không có.',
      '',
      '## Verification',
      '',
      '- Mỗi finding trong các comment của Task này đã sửa, kèm test hay commit, hoặc có lý do bỏ.',
    ].join('\n'),
  };
}

// The findings of a PR that merged that are still to record: its Medium and Low on the reports of its head, when its
// item is in an Epic and the Epic's findings Task does not name the PR yet. Returns the action, or null.
export function findingsStep({ item, epic, pr, findings }) {
  const minor = pr?.minorFindings ?? [];
  if (!epic || !pr?.merged || minor.length === 0 || findings?.recorded || ownFindings({ item, findings })) return null;
  return { action: 'findings-task', key: item.key, epic: epic.key, task: findings?.key ?? null, pr: pr.number, findings: minor, continue: true };
}

// The findings Task does not record the findings of its own PR in itself: its QA checks every finding of its comments,
// so it would never pass (SHOP-85 of shop, T14 of C2). They stay on the reports of the PR.
const ownFindings = ({ item, findings }) => Boolean(findings?.key) && findings.key === item?.key;

// The line /ao-qa of the findings Task prints for the findings of its own PR, or null.
export function ownFindingsLine({ item, epic, pr, findings }) {
  const minor = pr?.minorFindings ?? [];
  if (!epic || !pr?.merged || minor.length === 0 || !ownFindings({ item, findings })) return null;
  return `The ${minor.length} Medium and Low findings of PR #${pr.number} stay on its reports: ${item.key} is the findings Task of the Epic, and does not record those of its own PR. Make a Task for them if you want them fixed`;
}
