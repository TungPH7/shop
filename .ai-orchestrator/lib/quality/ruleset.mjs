// The rulesets gh:protect applies when a repository supports rulesets (quality-gates spec section 2.8): a public
// repository, or a plan from Pro up. Elsewhere merge-gate and audit enforce the gates, and the repository is left as
// it is (soft mode).
//
// Five rulesets since the review of shop PR #13 (Pilot 3, spec 2.9). One ruleset that nobody bypassed blocked every step
// the kit makes with no approval on GitHub: the merge of an Epic's docs PR after gate ② (approved on Jira), of the
// release report into a release branch, and of main back into develop. Every agent with git: write holds a token of
// ao-dev, the key of ao-review lies on the same machine, and gh-guard stops mistakes, not an agent set on getting round
// it. Round 1 of the review: the bypass of Phiên 30 · Lượt 9 went to ao-dev, so an agent could merge a PR nobody
// approved. Round 2: one App could approve a PR the other opened, and an agent could cut release/v9.9.9 or a v* tag at
// a commit nobody reviewed. Now:
// - ao-protected-merge: develop and release/*; a PR with one approval of a code owner (.github/CODEOWNERS names your
//   logins), which a new push dismisses, and every job of CI green. Only the ao-merge App bypasses it, and only to merge
//   a PR, which merge-gate does once its own gates are met. Its key lives only in the merge-gate environment.
// - ao-protected-main: main; the same rules, and nobody bypasses them: every PR into main is a release or a hotfix you
//   approved.
// - ao-release-branches: only an admin of the repository, you, makes a release/* branch: /ao-release cuts it with your
//   gh login.
// - ao-release-tags: only ao-merge (the tag of a release) and you (the tag of a hotfix) make, move or delete a v* tag,
//   which a merge back trusts.
// - ao-protected: the protected branches of quality/gates.yaml; no deletion, no force push; nobody bypasses it.
// So merge-gate and audit hold ao-merge, as in soft mode, and GitHub holds everyone else, the agents included.
export const RULESET = 'ao-protected';
export const MERGE_RULESET = 'ao-protected-merge';
export const MAIN_RULESET = 'ao-protected-main';
export const RELEASE_BRANCHES_RULESET = 'ao-release-branches';
export const RELEASE_TAGS_RULESET = 'ao-release-tags';
// The ruleset of release/* from Pilot 3, T9, which let ao-dev push there always: applyRulesets deletes it.
export const OLD_RELEASE_RULESET = 'ao-protected-release';
// The admin role of the repository. Checked live on TungPH7/test (Phiên 31 · Lượt 5): with it, your gh login made a
// release branch and a tag that the same ruleset with no bypass refused.
const ADMIN = { actor_id: 5, actor_type: 'RepositoryRole', bypass_mode: 'always' };
const SOFT_MODE = 'soft mode: merge-gate and audit enforce the gates';
const refs = (branches) => ({ ref_name: { include: branches.map((branch) => `refs/heads/${branch}`), exclude: [] } });

function reviewRules(gates) {
  return [
    {
      type: 'pull_request',
      parameters: {
        required_approving_review_count: 1,
        dismiss_stale_reviews_on_push: true,
        // Only a code owner's approval counts, so an App with write access approves nothing in your place.
        require_code_owner_review: true,
        // You push the PRs the main session makes and approve them; a new push dismisses an approval anyway.
        require_last_push_approval: false,
        required_review_thread_resolution: false,
      },
    },
    {
      type: 'required_status_checks',
      parameters: {
        required_status_checks: gates.checks.map((context) => ({ context })),
        strict_required_status_checks_policy: false,
        // A new release branch is pushed before any check has run on it.
        do_not_enforce_on_create: true,
      },
    },
  ];
}

// The five payloads, in the order they are written: the rulesets of PRs, release branches and tags first, then
// ao-protected, which loses the rules of PRs, so a repository that had the single ruleset is never less protected in
// between.
export function rulesetPayloads(gates, { mergeAppId } = {}) {
  if (!Number.isInteger(mergeAppId) || mergeAppId <= 0) throw new Error('the id of the ao-merge App is needed: github.apps.merge_id of project.yaml');
  const mergeApp = (mode) => ({ actor_id: mergeAppId, actor_type: 'Integration', bypass_mode: mode });
  const branches = gates.protected_branches;
  const releases = branches.filter((branch) => branch.startsWith('release/'));
  const base = { target: 'branch', enforcement: 'active' };
  return [
    { name: MERGE_RULESET, ...base, bypass_actors: [mergeApp('pull_request')], conditions: refs(branches.filter((branch) => branch !== 'main')), rules: reviewRules(gates) },
    { name: MAIN_RULESET, ...base, bypass_actors: [], conditions: refs(['main']), rules: reviewRules(gates) },
    { name: RELEASE_BRANCHES_RULESET, ...base, bypass_actors: [ADMIN], conditions: refs(releases), rules: [{ type: 'creation' }] },
    { name: RELEASE_TAGS_RULESET, target: 'tag', enforcement: 'active', bypass_actors: [mergeApp('always'), ADMIN], conditions: { ref_name: { include: ['refs/tags/v*'], exclude: [] } }, rules: [{ type: 'creation' }, { type: 'update' }, { type: 'deletion' }] },
    { name: RULESET, ...base, bypass_actors: [], conditions: refs(branches), rules: [{ type: 'deletion' }, { type: 'non_fast_forward' }] },
  ];
}

// Creates each ruleset, or updates the one with its name, so a second run makes no copy, then deletes the old ruleset of
// release/*. A repository without rulesets answers the list with 403: soft mode, nothing sent.
export async function applyRulesets(github, gates, { mergeAppId } = {}, log = console.log) {
  const payloads = rulesetPayloads(gates, { mergeAppId });
  let rulesets;
  try {
    rulesets = await github.getAll('/rulesets');
  } catch (error) {
    if (error.status !== 403) throw error;
    log(SOFT_MODE);
    return { mode: 'soft' };
  }
  const ids = {};
  for (const payload of payloads) {
    const found = rulesets.find(({ name }) => name === payload.name);
    if (found) {
      await github.request('PUT', `/rulesets/${found.id}`, {}, payload);
      log(`updated ruleset ${payload.name} (id ${found.id})`);
      ids[payload.name] = found.id;
    } else {
      const { id } = await github.request('POST', '/rulesets', {}, payload);
      log(`created ruleset ${payload.name} (id ${id})`);
      ids[payload.name] = id;
    }
  }
  const old = rulesets.find(({ name }) => name === OLD_RELEASE_RULESET);
  if (old) {
    await github.request('DELETE', `/rulesets/${old.id}`);
    log(`deleted ruleset ${OLD_RELEASE_RULESET} (id ${old.id}): ${MERGE_RULESET} holds release/* now`);
  }
  return { mode: 'applied', ids };
}
