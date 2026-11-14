// The rulesets gh:protect applies when a repository supports rulesets (quality-gates spec section 2.8): a public
// repository, or a plan from Pro up. Elsewhere merge-gate and audit enforce the gates, and the repository is left as
// it is (soft mode).
//
// Three rulesets since Pilot 3 (Phiên 30 · Lượt 9). One ruleset that nobody bypassed blocked every step the kit makes
// with the ao-dev App and no approval on GitHub: the release report that /ao-ship commits on release/*, the merge of an
// Epic's docs PR after gate ② (approved on Jira), the merge of main back into develop. Now:
// - ao-protected: the protected branches of quality/gates.yaml; no deletion, no force push; nobody bypasses it.
// - ao-protected-merge: the other protected branches (develop, main); a PR with one approval, which a new push
//   dismisses, and every job of CI green. The ao-dev App bypasses it only to merge a PR, which merge-gate does once its
//   own gates are met; nobody pushes to those branches.
// - ao-protected-release: the same rules on release/*, which the ao-dev App bypasses always, for the release report;
//   audit lets a commit of ao-dev there change only docs/releases/vX.Y.Z.md and CHANGELOG.md.
// So the ao-dev App is held by merge-gate and audit, as in soft mode, and everyone else by GitHub.
export const RULESET = 'ao-protected';
export const MERGE_RULESET = 'ao-protected-merge';
export const RELEASE_RULESET = 'ao-protected-release';
const SOFT_MODE = 'soft mode: merge-gate and audit enforce the gates';
const isRelease = (branch) => branch.startsWith('release/');
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

// The three payloads, in the order they are written: the two rulesets of PRs first, then ao-protected, which loses
// those rules, so a repository that had the single ruleset is never less protected in between.
export function rulesetPayloads(gates, { devAppId } = {}) {
  if (!Number.isInteger(devAppId) || devAppId <= 0) throw new Error('the id of the ao-dev App is needed: github.apps.dev_id of project.yaml');
  const app = (mode) => [{ actor_id: devAppId, actor_type: 'Integration', bypass_mode: mode }];
  const branches = gates.protected_branches;
  const base = { target: 'branch', enforcement: 'active' };
  return [
    { name: MERGE_RULESET, ...base, bypass_actors: app('pull_request'), conditions: refs(branches.filter((branch) => !isRelease(branch))), rules: reviewRules(gates) },
    { name: RELEASE_RULESET, ...base, bypass_actors: app('always'), conditions: refs(branches.filter(isRelease)), rules: reviewRules(gates) },
    { name: RULESET, ...base, bypass_actors: [], conditions: refs(branches), rules: [{ type: 'deletion' }, { type: 'non_fast_forward' }] },
  ];
}

// Creates each ruleset, or updates the one with its name, so a second run makes no copy. A repository without
// rulesets answers the list with 403: soft mode, nothing sent.
export async function applyRulesets(github, gates, { devAppId } = {}, log = console.log) {
  const payloads = rulesetPayloads(gates, { devAppId });
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
  return { mode: 'applied', ids };
}
