// audit (quality-gates spec section 2.6): before a deploy, checks that the commit came through the gates. decideAudit
// and mergedPull are pure; readAuditFacts reads the facts of one commit with a GitHub client; runAudit decides one
// commit and, when the audit fails, flags the work item with the CI token, as the contract effect flag-needs-you does;
// auditRange decides every new commit of a branch for the deployer, which writes nothing to Jira (release-workflow
// spec 2.3). scripts/audit.mjs only builds the clients.
import { extractKeys, parseBranch } from '../tracker/conventions.mjs';
import { adfText, readChecks } from '../tracker/facts.mjs';
import { raiseFlag } from '../tracker/sync.mjs';
import { touchedPaths } from './diff-paths.mjs';
import { docsPullRequest, readDocsFacts } from './docs-pr.mjs';
import { approved, botLogin, docsUnmet, docsVerdict, isBackMerge, notesPaths, notesVersion, protectedPaths, releaseTags, truncated, unmetConditions } from './merge-gate.mjs';

// Who may merge a PR that needs no approval of yours, a merge back or the release report: merge-gate, with ao-merge
// (Pilot 3, spec 2.9), or with ao-dev only in a project that has no ao-merge yet; or you. In a project with ao-merge, a
// merge by ao-dev, the App of the agents, fails (review round 2 of shop PR #13).
const mergers = (apps, approvers) => [botLogin(apps.merge ?? apps.dev), ...approvers];

// The merged PR whose merge commit is `sha`, into `branch`; for a release branch also into develop, since a new
// release branch is cut from a commit of develop. A PR that only contains the commit is not its merge.
export function mergedPull(pulls, sha, branch) {
  const bases = branch.startsWith('release/') ? [branch, 'develop'] : [branch];
  return pulls.find((pr) => pr.merged_at && pr.merge_commit_sha === sha && bases.includes(pr.base.ref));
}

// facts: the commit `sha` and its `message`, the `branch` it is deployed from, `pull` (GET /pulls/{n} of the PR
// mergedPull found, or null), that PR's `files`, `reviews` and the `checks` of its head commit, the `gates`, the slugs
// of the `apps` (dev, review, and merge when the project has it), your logins (`approvers`), and for a docs PR its `docs` facts as merge-gate
// reads them. Returns { ok, pr, problems, keys }: keys are the work items to flag, from the PR title, or from the commit
// header when there is no PR. A docs PR passes on the terms merge-gate merged it on (dev-workflow spec 2.4). `tags`, for a
// merge back: the release tags of the repository, [{ name, sha }], as releaseTags reads them, and `brought`, the audit of
// the commits it brought from main, as auditBroughtBack gives it. A High you accepted counts on the day of the merge
// (Pilot 3, spec 2.9 part 5).
export function decideAudit({ sha, branch, message, pull, files = [], reviews = [], checks, gates, apps, approvers, docs, space, tags = [], brought }) {
  const short = sha.slice(0, 7);
  // Every commit comes through a PR. The release report of /ao-ship did not, before Pilot 3, spec 2.9: whoever held the
  // token of ao-dev, an agent included, could change the release notes that way.
  if (!pull) return result(null, [`${short} on ${branch} is not the merge of a PR into ${branch}: it was pushed without one`], extractKeys(message.split('\n', 1)[0]));
  const keys = extractKeys(pull.title ?? '');
  if (mergedPull([pull], sha, branch) !== pull) return result(pull.number, [`PR #${pull.number} was merged into ${pull.base.ref}, not ${branch}`], keys);

  const problems = [];
  let missing;
  const merger = pull.merged_by?.login;
  const at = `on head ${pull.head.sha.slice(0, 7)}`;
  const notes = notesVersion(pull);
  if (isBackMerge(pull)) {
    // Every commit of main passed gate ③ or gate ⑤ there: no review and no approval (release-workflow spec 2.7), once
    // its head is a version you shipped, a commit a release tag names (Pilot 3, spec 2.9). merge-gate merges it only
    // without conflicts, so the merge commit adds nothing of its own.
    // Every commit it brought on the first-parent line of main passed audit too (review round 3 of shop PR #13).
    const failed = brought?.find(({ ok }) => !ok);
    missing = [
      ...(checks.green ? [] : [`CI green ${at}`]),
      ...((tags ?? []).some((tag) => tag.sha === pull.head.sha) ? [] : [`a release tag vX.Y.Z ${at}`]),
      ...(brought === undefined ? ['an audit of the commits main brings back'] : failed ? [`${failed.sha.slice(0, 7)} on main passing audit (${failed.problems.join('; ')})`] : []),
    ];
    if (!mergers(apps, approvers).includes(merger)) {
      problems.push(`PR #${pull.number} merges main back into ${pull.base.ref}, which merge-gate or you merge, but ${merger} merged it`);
    }
  } else if (notes) {
    // The release report (Pilot 3, spec 2.9), on the terms merge-gate merges it on: ao-dev opened it, it changes only the
    // report and the changelog of its version, a file moved away by its old path too, and CI passed.
    missing = checks.green ? [] : [`CI green ${at}`];
    const allowed = notesPaths(notes);
    const beyond = touchedPaths(files).filter((path) => !allowed.includes(path));
    if (beyond.length > 0) problems.push(`PR #${pull.number} is the report of v${notes}, which may only change ${allowed.join(' and ')}, but it changes ${beyond.join(', ')}`);
    if (pull.user?.login !== botLogin(apps.dev)) problems.push(`PR #${pull.number} is the report of v${notes}, which ao-dev opens, but ${pull.user?.login} opened it`);
    if (!mergers(apps, approvers).includes(merger)) problems.push(`PR #${pull.number} is the report of v${notes}, which merge-gate or you merge, but ${merger} merged it`);
  } else if (parseBranch(pull.head.ref)?.kind === 'release') {
    // Every item of a release passed review on its own PR: CI and your approval are enough.
    missing = [
      ...(checks.green ? [] : [`CI green ${at}`]),
      ...(approved({ pr: pull, reviews, approvers, authorApproves: true }) ? [] : [`approval ${at}`]),
    ];
  } else {
    const verdict = docsVerdict({ pr: pull, files, gates, apps, docs, space });
    if (verdict?.docs) missing = docsUnmet({ pr: pull, checks, reviews, verdict });
    else {
      missing = unmetConditions({ pr: pull, checks, reviews, gates, apps, approvers, authorApproves: true, on: pull.merged_at?.slice(0, 10) });
      if (verdict && missing.length > 0) missing[missing.length - 1] += ` (${verdict.reason})`;
    }
    const paths = protectedPaths(files, gates);
    if (paths.length > 0 && !approvers.includes(merger)) problems.push(`PR #${pull.number} changes ${paths.join(', ')}, which only you merge, but ${merger} merged it`);
  }
  // GitHub lists at most 3,000 files of a PR: past that, its paths were never all checked (review round 3 of shop PR #13).
  if (!isBackMerge(pull) && parseBranch(pull.head.ref)?.kind !== 'release' && truncated(pull, files)) {
    problems.push(`PR #${pull.number} changes ${pull.changed_files} files, of which GitHub listed ${files.length}: check its paths by hand`);
  }
  if (missing.length > 0) problems.unshift(`PR #${pull.number} was merged without: ${missing.join('; ')}`);
  return result(pull.number, problems, keys);
}

const result = (pr, problems, keys) => ({ ok: problems.length === 0, pr, problems, keys });

// Reads the facts of commit `sha` on `branch`, decides, and prints the outcome. When the audit fails, every work item
// of the project space it names is flagged, with a comment that says why, once per commit and branch. dryRun flags
// nothing. `docs` ({ jira, passage }, a reading Jira client) reads the facts of a docs PR. Returns the decision and the
// keys flagged.
export async function runAudit({ github, jira, docs, mapping, space, sha, branch, gates, apps, approvers, dryRun = false, log = console.log }) {
  const { facts, docsKey } = await readAuditFacts({ github, docs, sha, branch, gates, apps, approvers, space });
  // facts.sha, the full hash, takes the place of a short one.
  const decision = decideAudit({ sha, branch, ...facts, gates, apps, approvers, space });
  const short = facts.sha.slice(0, 7);
  if (decision.ok) {
    log(`audit passed: ${short} on ${branch} is the merge of PR #${decision.pr}${docsKey ? `, the docs PR of ${docsKey}` : ''}, which met every gate`);
    return { ...decision, flagged: [] };
  }
  log(`audit failed: ${short} on ${branch}`);
  for (const problem of decision.problems) log(`- ${problem}`);

  const keys = space ? decision.keys.filter((key) => key.startsWith(`${space}-`)) : [];
  if (keys.length === 0) {
    log(space ? `No work item of ${space} to flag` : 'No project space (AO_JIRA_SPACE) to flag work items in');
    return { ...decision, flagged: [] };
  }
  const marker = `audit: ${short} on ${branch} `;
  const text = `${marker}was not deployed. ${decision.problems.join('. ')}. It is flagged with the label ${mapping.needs_you_label} and waits for you.`;
  for (const key of keys) {
    if (dryRun) {
      log(`Would flag ${key}`);
      continue;
    }
    await raiseFlag(key, { jira, mapping });
    // A run again for the same commit, like a re-run of the deploy, does not repeat the comment.
    const comments = await jira.getAll(`/rest/api/3/issue/${encodeURIComponent(key)}/comment`, {}, 'comments');
    if (!comments.some(({ body }) => adfText(body).startsWith(marker))) await jira.comment(key, text);
    log(`Flagged ${key}`);
  }
  return { ...decision, flagged: dryRun ? [] : keys };
}

// The facts decideAudit needs for commit `sha` on `branch`, read with a GitHub client, and the Epic key when the commit
// is the merge of a docs PR. `docs` ({ jira, passage }, a reading Jira client) reads the facts of a docs PR. GitHub
// finds a commit by a short hash too, and the facts carry its full hash: a PR's merge commit is matched by the full one,
// so a short hash read as a commit pushed without a PR (Pilot 2, T10).
export async function readAuditFacts({ github, docs, sha, branch, gates, apps, approvers = [], space }) {
  const found = await github.get(`/commits/${sha}`);
  const full = found.sha ?? sha;
  const parents = (found.parents ?? []).map((parent) => parent.sha);
  const listed = mergedPull(await github.getAll(`/commits/${full}/pulls`), full, branch);
  if (!listed) return { facts: { sha: full, message: found.commit.message, pull: null, parents }, docsKey: null };
  // Only the PR itself says who merged it.
  const pull = await github.get(`/pulls/${listed.number}`);
  const files = await github.getAll(`/pulls/${pull.number}/files`);
  const docsKey = docsPullRequest({ pr: pull, files, gates, apps, space });
  const facts = {
    sha: full,
    message: found.commit.message,
    pull,
    files,
    reviews: await github.getAll(`/pulls/${pull.number}/reviews`),
    checks: await readChecks(github, pull.head.sha),
    docs: docsKey && docs ? { ...(await readDocsFacts({ github, jira: docs.jira, key: docsKey, branch: pull.head.ref })), passage: docs.passage } : undefined,
    parents,
    // A merge back passes once the head of main it merged was a version you shipped (Pilot 3, spec 2.9), and every
    // commit it brought from main passed audit (review round 3 of shop PR #13).
    ...(isBackMerge(pull) && { tags: await releaseTags(github), brought: await auditBroughtBack({ github, docs, pr: pull, gates, apps, approvers, space }) }),
  };
  return { facts, docsKey };
}

const FULL_SHA = /^[0-9a-f]{40}$/;
const fullSha = (value) => {
  if (!FULL_SHA.test(value)) throw new Error(`${JSON.stringify(value)} is not a full commit hash`);
  return value;
};

// The --sha of audit.mjs: a commit hash of 7 to 40 hex digits, in lower case. GitHub would also take a branch or a tag
// name, and audit the commit it points to now.
export function commitArgument(value) {
  if (typeof value !== 'string' || !/^[0-9a-f]{7,40}$/i.test(value)) throw new Error(`--sha takes a commit hash of 7 to 40 hex digits, not ${JSON.stringify(value)}`);
  return value.toLowerCase();
}

// Audits every first-parent commit of `branch` after `since` up to `head`, oldest first, and stops at the first that
// fails (release-workflow spec 2.3 step 2): a commit pushed without a PR cannot hide under a valid one. When the
// history was rewritten, so that `since` is no longer under `head`, it starts again from the newest commit both share.
// `git(args)` runs git in the deployer's mirror and resolves to its output; it only ever gets full commit hashes, so no
// value can pass for an option. Returns { base, rewritten, audits }, each audit { sha, ok, pr, problems, keys, pull }, where
// pull is { number, head } of the PR the commit merged, or null.
export async function auditRange({ git, github, docs, since, head, branch, gates, apps, approvers, space }) {
  fullSha(since);
  fullSha(head);
  const base = fullSha((await git(['merge-base', since, head])).trim());
  const shas = (await git(['rev-list', '--first-parent', '--reverse', `${base}..${head}`])).split('\n').filter(Boolean).map(fullSha);
  const audits = [];
  for (const sha of shas) {
    const { facts } = await readAuditFacts({ github, docs, sha, branch, gates, apps, approvers, space });
    const decision = decideAudit({ sha, branch, ...facts, gates, apps, approvers, space });
    audits.push({ sha, ...decision, pull: facts.pull ? { number: facts.pull.number, head: facts.pull.head.ref } : null });
    if (!decision.ok) break;
  }
  return { base, rewritten: base !== since, audits };
}

// GitHub lists at most 250 commits of a PR.
const PR_COMMITS_LISTED = 250;

// The commits a merge back brings from main on main's first-parent line, each audited as a deploy of main would audit it
// (review round 3 of shop PR #13): newest first, from the head of main, stopping at the first that fails or at the first
// commit develop already has. GitHub lists as a PR's commits those of its head that its base lacks, so a commit main
// had before the last merge back is not among them. A merge back of 250 commits or more fails rather than be checked
// in part. `pr` is the merge back ({ number, head: { sha } }). Returns [{ sha, ok, problems }].
export async function auditBroughtBack({ github, docs, pr, gates, apps, approvers, space }) {
  const commits = await github.getAll(`/pulls/${pr.number}/commits`);
  if (commits.length >= PR_COMMITS_LISTED) {
    return [{ sha: pr.head.sha, ok: false, problems: [`the merge back brings ${PR_COMMITS_LISTED} commits or more, more than GitHub lists: check them by hand`] }];
  }
  const brought = new Set(commits.map((commit) => commit.sha));
  const audits = [];
  let sha = pr.head.sha;
  while (sha && brought.delete(sha)) {
    const { facts } = await readAuditFacts({ github, docs, sha, branch: 'main', gates, apps, approvers, space });
    const decision = decideAudit({ sha, branch: 'main', ...facts, gates, apps, approvers, space });
    audits.push({ sha, ok: decision.ok, problems: decision.problems });
    if (!decision.ok) break;
    sha = facts.parents[0];
  }
  return audits;
}
