// The rulesets gh:protect applies when a repository supports rulesets (quality-gates spec section 2.8): a public
// repository, or a plan from Pro up. Elsewhere merge-gate and audit enforce the gates, and the repository is left as
// it is (soft mode).
//
// Two rulesets since the review of shop PR #13 (Pilot 3, spec 2.9). One ruleset that nobody bypassed blocked every step
// the kit makes with no approval on GitHub: the merge of an Epic's docs PR after gate ② (approved on Jira), of the
// release report into a release branch, and of main back into develop. The bypass of Phiên 30 · Lượt 9 went to the
// ao-dev App, which is also the App of every agent with git: write, so an agent could merge a PR nobody approved. Now:
// - ao-protected: the protected branches of quality/gates.yaml; no deletion, no force push; nobody bypasses it.
// - ao-protected-merge: the same branches; a PR with one approval, which a new push dismisses, and every job of CI
//   green. Only the ao-merge App bypasses it, and only to merge a PR, which merge-gate does once its own gates are met.
//   The key of ao-merge lives only in the merge-gate environment of the repository, never on a machine an agent uses.
// So merge-gate and audit hold ao-merge, as in soft mode, and GitHub holds everyone else, the agents included.
export const RULESET = 'ao-protected';
export const MERGE_RULESET = 'ao-protected-merge';
// The ruleset of release/* from Pilot 3, T9, which let ao-dev push there always: applyRulesets deletes it.
export const OLD_RELEASE_RULESET = 'ao-protected-release';
const SOFT_MODE = 'soft mode: merge-gate and audit enforce the gates';
const refs = (branches) => ({ ref_name: { include: branches.map((branch) => `refs/heads/${branch}`), exclude: [] } });

function reviewRules(gates) {
  return [
    {
      type: 'pull_request',
      parameters: {
        required_approving_review_count: 1,
        dismiss_stale_reviews_on_push: true,
        require_code_owner_review: false,
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

// The two payloads, in the order they are written: the ruleset of PRs first, then ao-protected, which loses those rules,
// so a repository that had the single ruleset is never less protected in between.
export function rulesetPayloads(gates, { mergeAppId } = {}) {
  if (!Number.isInteger(mergeAppId) || mergeAppId <= 0) throw new Error('the id of the ao-merge App is needed: github.apps.merge_id of project.yaml');
  const branches = refs(gates.protected_branches);
  const base = { target: 'branch', enforcement: 'active' };
  return [
    { name: MERGE_RULESET, ...base, bypass_actors: [{ actor_id: mergeAppId, actor_type: 'Integration', bypass_mode: 'pull_request' }], conditions: branches, rules: reviewRules(gates) },
    { name: RULESET, ...base, bypass_actors: [], conditions: branches, rules: [{ type: 'deletion' }, { type: 'non_fast_forward' }] },
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
