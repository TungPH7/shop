// The commit-msg hook (quality-gates spec section 2.3): refuses a commit whose header breaks the convention.
// Usage, from kit/.githooks/commit-msg: node .ai-orchestrator/scripts/commit-msg.mjs <message file>
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { checkCommitMessage } from '../lib/quality/git-hooks.mjs';

// No commit on any ref yet: this is the root commit of the repository, which needs no Jira key. An orphan branch of a
// repository that has commits, and a git that fails, still need it (review of ao-sample PR #30).
const commits = spawnSync('git', ['rev-list', '-n', '1', '--all'], { encoding: 'utf8' });
const root = commits.status === 0 && commits.stdout.trim() === '';
const result = checkCommitMessage(readFileSync(process.argv[2], 'utf8'), { root });
if (!result.ok) {
  console.error(`commit-msg: ${result.reason}`);
  console.error('The header is type(scope): subject (<KEY>), for example: feat(api): add login endpoint (DEMO-12)');
  process.exit(1);
}
