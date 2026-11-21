// Facts for the guards whose evidence is in Jira or GitHub (tracker-integration spec section 2.8). Every function takes
// a client (lib/tracker/jira-client.mjs or github-client.mjs, or a fake in tests) and does no other I/O.
import { checkBranch, extractKeys, parseBranch } from './conventions.mjs';
import { expectedOptions } from './expected.mjs';
import { plainText } from './stored-text.mjs';

const ITEM_FIELDS = ['issuetype', 'status', 'labels', 'description', 'parent', 'subtasks', 'issuelinks'];
// dor-met as automation checks it (contract note on `refine`): a Story or Task under an Epic whose plan is approved,
// that is an Epic in progress, and with a description.
const DOR_TYPES = ['story', 'task'];
const JIRA_GUARDS = ['dor-met', 'wip-available', 'subtasks-done', 'qa-report-failed', 'qa-report-passed', 'ops-evidence'];
const BLOCKS = new Set(['paragraph', 'heading', 'listItem', 'codeBlock', 'blockquote', 'tableRow', 'rule', 'mediaSingle', 'panel']);

export async function readItem(client, key) {
  const { key: found, fields } = await client.get(`/rest/api/3/issue/${encodeURIComponent(key)}`, { fields: ITEM_FIELDS.join(',') });
  return {
    key: found,
    type: fields.issuetype.name,
    status: fields.status.name,
    labels: fields.labels ?? [],
    description: adfText(fields.description).trim(),
    parent: fields.parent ? { key: fields.parent.key, type: fields.parent.fields.issuetype.name, status: fields.parent.fields.status.name } : null,
    subtasks: (fields.subtasks ?? []).map(({ key: sub, fields: { status } }) => ({ key: sub, status: status.name, done: status.statusCategory?.key === 'done' })),
    // The items this one waits for: Jira's Blocks link, seen from the blocked item.
    blockedBy: (fields.issuelinks ?? []).filter(({ type, inwardIssue }) => type?.inward === 'is blocked by' && inwardIssue).map(({ inwardIssue }) => inwardIssue.key),
  };
}

// The ids among `needed` of the Jira guards that hold for the item, in the order asked. Guards with evidence elsewhere
// (GitHub, or you) are left out. Pass `item` when it is already read.
export async function jiraGuards(client, { key, item, actor, needed, contract, mapping, agentsPerRole = {} }) {
  const current = item ?? (await readItem(client, key));
  // Both QA guards read the same comments, once.
  let qaResult;
  const latestQaResult = () => (qaResult ??= readLatestQaResult(client, current.key));
  const check = {
    'dor-met': () => dorMet(current, contract, mapping),
    'wip-available': () => wipAvailable(client, current, actor, contract, mapping, agentsPerRole),
    'subtasks-done': () => current.subtasks.every(({ done }) => done),
    'qa-report-failed': async () => (await latestQaResult()) === 'FAIL',
    'qa-report-passed': async () => (await latestQaResult()) === 'PASS',
    'ops-evidence': () => opsEvidence(client, current.key, contract, mapping),
  };
  const holds = [];
  for (const guard of needed.filter((id) => JIRA_GUARDS.includes(id))) if (await check[guard]()) holds.push(guard);
  return holds;
}

function dorMet(item, contract, mapping) {
  const typeOf = (id) => contract.work_types.find((type) => type.id === id).jira_issue_type;
  const epicWorkflow = Object.keys(contract.workflows).find((w) => contract.workflows[w].applies_to.includes('epic'));
  return (
    DOR_TYPES.map(typeOf).includes(item.type) &&
    item.description !== '' &&
    item.parent?.type === typeOf('epic') &&
    item.parent.status === mapping.workflows[epicWorkflow].states['in-progress'].status
  );
}

// The agent's in-progress work, counted by Sub-task when a Story has Sub-tasks, else by item (contract wip_limits).
async function wipAvailable(client, item, actor, contract, mapping, agentsPerRole) {
  const { keys, limit } = await wipHolders(client, { space: item.key.slice(0, item.key.lastIndexOf('-')), actor, contract, mapping, agentsPerRole });
  return keys.length < limit;
}

// The items In Progress that hold the WIP of a dev role, and its limit: { keys, limit }. A Story with Sub-tasks does not
// count; its Sub-task of the role does. ao-step reads it again before each build run, since a process lock that ends
// does not mean the item left In Progress on Jira (Pilot 3, SHOP-31 after SHOP-58).
// agentsPerRole: runs.agents_per_role of the project, which raises the limit of a role (C2 spec section 6).
export async function wipHolders(client, { space, actor, contract, mapping, agentsPerRole = {} }) {
  const field = contract.work_item_fields.find(({ id }) => id === 'agent');
  const index = field.values.findIndex(({ id }) => id === actor);
  if (index === -1) throw new Error(`No Agent value for role '${actor}'`);
  const agent = expectedOptions(contract, mapping, 'agent')[index];
  const workflows = Object.entries(contract.workflows).filter(([, w]) => w.applies_to.some((type) => field.applies_to.includes(type)));
  const statuses = [...new Set(workflows.map(([id]) => mapping.workflows[id].states['in-progress']?.status).filter(Boolean))];
  const jql = `project = "${space}" AND "${mapping.fields.agent.jira_field}" = "${agent}" AND status in (${statuses.map((s) => `"${s}"`).join(', ')})`;
  const busy = (await client.searchAll(jql, ['subtasks'])).filter(({ fields }) => (fields.subtasks ?? []).length === 0);
  return { keys: busy.map(({ key }) => key), limit: agentsPerRole[actor] ?? contract.wip_limits.find(({ id }) => id === 'dev-agent').limit };
}

// An ops Task: the label ao-ops, no commit and no PR (kit followups, batch 4 item 14; SHOP-12 of shop).
export const isOpsTask = (item, mapping) => (item.labels ?? []).includes(mapping.work_labels.ops);

// Whether devops left its evidence on an ops Task: a comment that starts with its Agent value and has the heading Ops
// evidence, a block of its own, as Rovo MCP stores the markdown ## Ops evidence.
async function opsEvidence(client, key, contract, mapping) {
  const field = contract.work_item_fields.find(({ id }) => id === 'agent');
  const devops = expectedOptions(contract, mapping, 'agent')[field.values.findIndex(({ id }) => id === 'devops')];
  const comments = await client.getAll(`/rest/api/3/issue/${encodeURIComponent(key)}/comment`, { orderBy: '-created' }, 'comments');
  return comments.some(({ body }) => {
    if (!adfText(body).startsWith(`${devops}:`)) return false;
    // Markdown as a string, or ADF with the heading as a block.
    if (typeof body === 'string') return body.split('\n').some((line) => /^#{1,6}\s*ops evidence\s*$/i.test(line.trim()));
    return (body?.content ?? []).some((block) => block.type === 'heading' && /^ops evidence$/i.test(adfText(block).trim()));
  });
}

async function readLatestQaResult(client, key) {
  return (await readLatestQaReport(client, key))?.result ?? null;
}

// The newest QA report of an item: { result, at } with `at` in ISO time, or null (human-loop spec 5.2 reads when it was
// written, to tell the runs of one rebuild after QA fail from those of another).
export async function readLatestQaReport(client, key) {
  const comments = await client.getAll(`/rest/api/3/issue/${encodeURIComponent(key)}/comment`, { orderBy: '-created' }, 'comments');
  const [newest] = comments
    .map(({ id, body, created }) => ({ id, body, result: qaReportResult(body), at: jiraTime(created) }))
    .filter(({ result }) => result)
    .sort((a, b) => b.at - a.at);
  // id and failed: which comment, and the criteria it failed, for a QA again of only those (C1 spec section 2).
  return newest ? { result: newest.result, at: new Date(newest.at).toISOString(), id: newest.id ?? null, failed: failedCriteria(newest.body) } : null;
}

// The criteria a QA report failed: the AC<n> codes in the first cell of each table row whose Result cell is FAIL. A
// Jira table is read by its rows and cells; a Markdown table, or one posted as paragraphs (lib/tracker/adf.mjs), by its
// lines. Only the codes, never the rest of the cell, reach the prompt of QA again (second review of shop PR #79); a row
// with no code gives none, so a Task, whose Verification lines have no code, is checked again in full. Pure.
export function failedCriteria(body) {
  const clean = (cell) => cell.replace(/[*_`]/g, '').replace(/\s+/g, ' ').trim();
  const tableRows = [];
  const walk = (node) => {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'tableRow') tableRows.push((node.content ?? []).map((cell) => clean(adfText(cell))));
    else (node.content ?? []).forEach(walk);
  };
  if (typeof body !== 'string') walk(body);
  const text = typeof body === 'string' ? body : adfText({ ...body, content: (body?.content ?? []).filter(({ type }) => type !== 'table') });
  const lineRows = text
    .split('\n')
    .filter((line) => line.includes('|'))
    .map((line) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(clean));
  const failed = [...tableRows, ...lineRows]
    .filter((cells) => cells.length >= 2 && cells.slice(1).includes('FAIL') && cells[0] && !/^acceptance criterion$/i.test(cells[0]))
    .flatMap(([criterion]) => criterion.match(/\bAC\d+\b/g) ?? []);
  return [...new Set(failed)];
}

// Milliseconds of a Jira timestamp such as 2026-10-28T10:00:00.000+0700, whose offset has no colon.
export function jiraTime(created) {
  return Date.parse(String(created).replace(/([+-]\d\d)(\d\d)$/, '$1:$2'));
}

// PASS, FAIL or NOT TESTED from a comment written with templates/qa-report.md, as ADF or as markdown text; null for
// any other comment, or a report whose Result is not filled in. NOT TESTED counts as a report, so it hides an older FAIL
// (agent-roster spec 2.9).
export function qaReportResult(body) {
  const lines = plainText(typeof body === 'string' ? body : adfText(body)).split('\n').map((line) => line.replace(/^#+\s*/, '').trim());
  if (!lines.some((line) => /^QA report\b/i.test(line))) return null;
  const at = lines.findIndex((line) => /^Result$/i.test(line));
  const result = lines.slice(at + 1).find((line) => line !== '');
  return at !== -1 && /^(PASS|FAIL|NOT TESTED)$/.test(result ?? '') ? result : null;
}

// Plain text of an Atlassian Document Format node, one line per block.
export function adfText(node) {
  if (!node) return '';
  if (typeof node === 'string') return node;
  if (node.type === 'text') return node.text ?? '';
  if (node.type === 'hardBreak') return '\n';
  const inner = (node.content ?? []).map(adfText).join(node.type === 'tableRow' ? ' | ' : '');
  return BLOCKS.has(node.type) ? `${inner}\n` : inner;
}

const GITHUB_GUARDS = ['ops-task', 'branch-created', 'dependencies-merged', 'pr-open', 'ci-green', 'changes-requested', 'merge-approved', 'pr-merged', 'qa-deployed', 'work-committed'];
const BRANCH_KINDS = ['feature', 'bugfix', 'hotfix'];
const PASSED = ['success', 'neutral', 'skipped'];
// The jobs of the kit that are check runs on a PR head but not CI: that of kit/.github/workflows/jira-sync.yml, which ran
// on pull_request in the copies made before, that of pr-review.yml, which relays a review to jira-sync (review of shop
// PR #21), and that of pr-events.yml, which relays the events of the PR (Pilot 3). A failed relay must not send an item
// back.
const NOT_CI = ['jira-sync', 'pr-review-relay', 'pr-events-relay'];
const FAILED = ['failure', 'timed_out'];
// Review states that decide; COMMENTED does not.
const DECISIVE = ['APPROVED', 'CHANGES_REQUESTED', 'DISMISSED'];

// The ids among `needed` of the GitHub guards that hold for the item (as readItem returns it), in the order asked.
// After qa-fail an item has several PRs; the newest one counts. `approvers` are your GitHub logins, for merge-approved.
export async function githubGuards(github, { item, needed, contract, mapping, approvers = [] }) {
  const workType = contract.work_types.find(({ jira_issue_type: type }) => type === item.type)?.id;
  const cache = new Map();
  const once = (key, read) => {
    if (!cache.has(key)) cache.set(key, read());
    return cache.get(key);
  };
  // A PR from a fork is never the item's, whatever its branch is called (review round 2 of shop PR #21).
  const sameRepo = (pr) => pr.head?.repo?.full_name === pr.base?.repo?.full_name;
  const allPulls = () => once('pulls', async () => (await github.getAll('/pulls', { state: 'all', sort: 'created', direction: 'desc' })).filter(sameRepo));
  const pullsOf = async (key) => (await allPulls()).filter(({ head }) => parseBranch(head.ref)?.key === key);
  const newest = async () => (await pullsOf(item.key))[0];
  const checks = (sha) => once(`checks ${sha}`, () => readChecks(github, sha));
  const reviews = (number) => once(`reviews ${number}`, () => github.getAll(`/pulls/${number}/reviews`));
  const intoBase = (pr) => checkBranch(pr.head.ref, { workType, base: pr.base.ref }).ok;
  const opsTask = () => once('ops-task', async () => workType === 'task' && isOpsTask(item, mapping) && (await branchesOf(github, item.key)).length === 0 && (await pullsOf(item.key)).length === 0);

  const check = {
    // A Task with the label ao-ops, no branch and no PR (review of shop PR #78: the label alone, which any agent can put,
    // let devops hand a Story with a PR to QA past submit and review).
    'ops-task': async () => opsTask(),
    // An ops Task has no branch (contract guard branch-created).
    'branch-created': async () => (await opsTask()) || (await branchesOf(github, item.key)).some((name) => checkBranch(name, { workType }).ok),
    'dependencies-merged': async () => {
      for (const key of item.blockedBy) {
        const [pr] = await pullsOf(key);
        if (!pr?.merged_at || !checkBranch(pr.head.ref, { base: pr.base.ref }).ok) return false;
      }
      return true;
    },
    // A draft PR waits for your preview: the item stays In Progress until /ao-review marks it ready (human-loop spec 4.1).
    'pr-open': async () => {
      const pr = await newest();
      return pr?.state === 'open' && !pr.draft && intoBase(pr);
    },
    'ci-green': async () => {
      const pr = await newest();
      return Boolean(pr) && (await checks(pr.head.sha)).green;
    },
    'changes-requested': async () => {
      const pr = await newest();
      if (!pr) return false;
      return changesRequestedOn(await reviews(pr.number), pr.head.sha) || (await checks(pr.head.sha)).failed;
    },
    'merge-approved': async () => {
      const pr = await newest();
      if (!pr || approvers.length === 0) return false;
      const list = await reviews(pr.number);
      return approvers.some((login) => lastDecision(list, login)?.state === 'APPROVED');
    },
    'pr-merged': async () => {
      const pr = await newest();
      return Boolean(pr?.merged_at) && intoBase(pr);
    },
    'qa-deployed': async () => {
      const pr = await newest();
      return Boolean(pr?.merged_at) && qaDeployed(github, pr, contract, mapping);
    },
    'work-committed': async () => {
      if (!item.parent) return false;
      const [branch] = (await branchesOf(github, item.parent.key)).sort((a, b) => parseBranch(b).round - parseBranch(a).round);
      if (!branch) return false;
      const commits = await github.get('/commits', { sha: branch, per_page: 100 });
      return commits.some(({ commit }) => extractKeys(commit.message.split('\n', 1)[0]).includes(item.key));
    },
  };
  const holds = [];
  for (const guard of needed.filter((id) => GITHUB_GUARDS.includes(id))) if (await check[guard]()) holds.push(guard);
  return holds;
}

// The work branches that carry the item key, whatever their prefix.
async function branchesOf(github, key) {
  const refs = await Promise.all(BRANCH_KINDS.map((kind) => github.get(`/git/matching-refs/heads/${kind}/${key}-`)));
  return refs
    .flat()
    .map(({ ref }) => ref.replace(/^refs\/heads\//, ''))
    .filter((name) => parseBranch(name)?.key === key);
}

// The latest review that decides (an approval, a request for changes, or one dismissed since), of anyone or of one
// login. GitHub lists reviews oldest first.
export function lastDecision(reviews, login) {
  return reviews.filter((r) => DECISIVE.includes(r.state) && (!login || r.user?.login === login)).at(-1);
}

// The review half of changes-requested: the latest deciding review of commit `sha` asks for changes. Only reviews of
// that commit count, so a push after a request for changes answers it. A failed check is the other half.
export function changesRequestedOn(reviews, sha) {
  return lastDecision(reviews.filter(({ commit_id: id }) => id === sha))?.state === 'CHANGES_REQUESTED';
}

// Green: at least one check, every check run finished and passed, and no commit status other than success. The check
// runs of NOT_CI do not count.
export async function readChecks(github, sha) {
  const runs = (await github.getAll(`/commits/${sha}/check-runs`, {}, 'check_runs')).filter(({ name }) => !NOT_CI.includes(name));
  const status = await github.get(`/commits/${sha}/status`);
  const statusState = status.total_count > 0 ? status.state : null;
  return {
    green:
      runs.length + status.total_count > 0 &&
      runs.every((r) => r.status === 'completed' && PASSED.includes(r.conclusion)) &&
      [null, 'success'].includes(statusState),
    failed: runs.some((r) => FAILED.includes(r.conclusion)) || ['failure', 'error'].includes(statusState),
    // Whether any check run or status is on the commit yet: CI that never started looks like CI still running.
    started: runs.length + status.total_count > 0,
  };
}

// A successful deployment to the QA environment of the PR's base branch (contract routing.yaml) that contains the
// merge commit. Deployments made before the merge cannot contain it.
async function qaDeployed(github, pr, contract, mapping) {
  const environment = mapping.environments[qaEnvironment(contract, pr.base.ref)].github_environment;
  const deployments = await github.getAll('/deployments', { environment });
  for (const deployment of deployments.filter(({ created_at: at }) => Date.parse(at) >= Date.parse(pr.merged_at))) {
    const contains =
      deployment.sha === pr.merge_commit_sha ||
      ['ahead', 'identical'].includes((await github.get(`/compare/${pr.merge_commit_sha}...${deployment.sha}`)).status);
    if (!contains) continue;
    const [latest] = await github.getAll(`/deployments/${deployment.id}/statuses`);
    if (latest?.state === 'success') return true;
  }
  return false;
}

// The first QA environment of the route whose base branch matches; release/* stands for any release branch.
export function qaEnvironment(contract, base) {
  const routes = [contract.new_work_route, ...contract.bug_routing.flatMap(({ routes: list }) => list)];
  const route = routes.find(({ base_branch: branch }) => branch === base || (branch === 'release/*' && base.startsWith('release/')));
  if (!route) throw new Error(`No QA environment for base branch '${base}'`);
  return route.qa_environments[0];
}
