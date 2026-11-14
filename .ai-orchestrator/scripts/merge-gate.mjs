// merge-gate (quality-gates spec section 2.5): merges each agent PR that meets every gate, with the ao-merge App, and
// prints what the others wait for. The logic is lib/quality/merge-gate.mjs; this file builds the clients. In a project
// it runs from .ai-orchestrator/scripts/, next to the project's copy of the kit.
// Usage: node scripts/merge-gate.mjs [--dry-run] [--repo <owner>/<name>]
// The repository is GITHUB_REPOSITORY, else the GitHub remote origin of the current folder. Reads use GITHUB_TOKEN or
// the GitHub CLI: an App token cannot read check runs. Merges use an installation token of the ao-merge App (Pilot 3,
// spec 2.9), the only App the rulesets let merge without your approval: its key is AO_MERGE_APP_KEY of the merge-gate
// environment, and no machine keeps it. A project with no ao-merge (AO_MERGE_APP unset) merges with ao-dev, as before,
// whose key is AO_DEV_APP_KEY in CI. The App slugs and ids, and your GitHub logins (AO_APPROVERS), come from the
// environment or from the env block of the project's .claude/settings.json.
// --dry-run prints the decisions and buys no App token.
// A docs PR of an Epic (dev-workflow spec 2.4) is merged once the Epic is past its gate: merge-gate reads the Epic with
// JIRA_CI_TOKEN, and the CI runs of the head, which the workflow token reads with actions: read. A PR you merge yourself
// gets a comment from the ao-dev App and, with JIRA_CI_TOKEN and AO_JIRA_SPACE, the Needs you flag on its item
// (dev-workflow spec 2.7). A merge back from main waits until each commit it brings passes the audit of a deploy.
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { readContract } from '../lib/contract.mjs';
import { auditBroughtBack } from '../lib/quality/audit.mjs';
import { projectSettings, setting } from '../lib/project-settings.mjs';
import { gatePassage } from '../lib/quality/docs-pr.mjs';
import { readGates } from '../lib/quality/gates.mjs';
import { appCredentials, installationToken } from '../lib/quality/github-app.mjs';
import { runMergeGate } from '../lib/quality/merge-gate.mjs';
import { createGitHubClient, originRepo, readGitHubToken } from '../lib/tracker/github-client.mjs';
import { bearerAuth, createJiraClient } from '../lib/tracker/jira-client.mjs';
import { readMapping } from '../lib/tracker/mapping.mjs';

const kit = fileURLToPath(new URL('..', import.meta.url));
const projectDir = process.env.GITHUB_WORKSPACE ?? process.cwd();

try {
  const { values } = parseArgs({ options: { 'dry-run': { type: 'boolean', default: false }, repo: { type: 'string' } } });
  const repo = values.repo ?? process.env.GITHUB_REPOSITORY ?? originRepo(projectDir);
  if (!repo) throw new Error('Set GITHUB_REPOSITORY, pass --repo <owner>/<name>, or run merge-gate in a clone whose origin is on GitHub');
  const settings = projectSettings(projectDir);
  const apps = { dev: setting('AO_DEV_APP', settings), review: setting('AO_REVIEW_APP', settings), merge: setting('AO_MERGE_APP', settings) };
  if (!apps.dev || !apps.review) throw new Error('Set AO_DEV_APP and AO_REVIEW_APP, the slugs of the two GitHub Apps, in .claude/settings.json');
  if (!apps.merge) console.log('Warning: no ao-merge App (AO_MERGE_APP), so merge-gate merges with ao-dev; with rulesets, only ao-merge may merge without your approval (docs/github-apps-setup.md)');
  const writer = apps.merge ? 'merge' : 'dev';
  const approvers = (setting('AO_APPROVERS', settings) ?? '').split(',').map((login) => login.trim()).filter(Boolean);
  if (approvers.length === 0) console.log('Warning: AO_APPROVERS is not set, so no PR counts as approved by you and none is merged');
  const token = readGitHubToken();
  if (!token) throw new Error('Set GITHUB_TOKEN, or log in to the GitHub CLI');

  const mergeClient = async () => {
    const prefix = `AO_${writer.toUpperCase()}_APP`;
    const env = { ...process.env, [prefix]: apps[writer], [`${prefix}_ID`]: setting(`${prefix}_ID`, settings) };
    const { appId, privateKey } = appCredentials(writer, { env });
    const { token: appToken } = await installationToken({ appId, privateKey, repo });
    return createGitHubClient({ repo, token: appToken, write: true });
  };
  const gates = readGates(join(kit, 'quality'));
  const mapping = readMapping(join(kit, 'tracker'));
  const jiraToken = process.env.JIRA_CI_TOKEN;
  // One Jira client for both: it writes only the flag of a PR you merge yourself, and not in a dry run.
  const jira = jiraToken ? createJiraClient({ cloudId: mapping.cloud_id, authorization: bearerAuth(jiraToken), write: !values['dry-run'] }) : undefined;
  const space = setting('AO_JIRA_SPACE', settings);
  const docs = jira ? { jira, passage: gatePassage(readContract(join(kit, 'contract')), mapping, gates.docs_pull_requests.gate), space } : undefined;
  const notify = { jira, mapping, space };
  const github = createGitHubClient({ repo, token });
  const { failures } = await runMergeGate({
    github,
    mergeClient,
    docs,
    notify,
    gates,
    apps,
    approvers,
    // A merge back waits until every commit it brings from main passes audit (review round 3 of shop PR #13).
    auditMain: (pr) => auditBroughtBack({ github, docs, pr, gates, apps, approvers, space }),
    dryRun: values['dry-run'],
  });
  if (failures.length > 0) process.exitCode = 1;
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
