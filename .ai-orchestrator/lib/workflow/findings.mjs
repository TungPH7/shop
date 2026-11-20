// The findings Task of an Epic (C1 spec sections 2 and 4): the Medium and Low findings a review left on a PR that
// merged go to one Task of the Epic, labelled ao-findings, which blocks the Epic. ao-step makes it with the CI token at
// the first such finding, then adds one comment per PR; you Refine it when you want them fixed. Pure.

// The comment that records the findings of PR `pr` of item `key`: its first line names the PR, which is how ao-step
// tells it recorded them already. findings: [{ role, severity, where, finding, id, asked? }].
export function findingsComment({ key, pr, findings }) {
  const lines = findings.map(({ role, severity, where, finding, id, asked }) => `- ${severity}${asked ? ` (${asked} không có dòng tái hiện)` : ''} ${id}, ${role}: ${oneLine(where)}: ${oneLine(finding)}`);
  return [`Finding chưa sửa của PR #${pr} (${key}):`, '', ...lines].join('\n');
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
  if (!epic || !pr?.merged || minor.length === 0 || findings?.recorded) return null;
  return { action: 'findings-task', key: item.key, epic: epic.key, task: findings?.key ?? null, pr: pr.number, findings: minor, continue: true };
}
