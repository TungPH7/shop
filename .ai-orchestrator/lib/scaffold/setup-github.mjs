// ao-kit setup github (project-scaffold spec 2.4; plan, decision 8): what the GitHub side of a project needs, set with
// your gh login. Each step reads first and writes only what is missing, so a second run changes nothing. Secrets go to
// gh through stdin, never as an argument; nothing is printed of them. What the API cannot do, such as installing the
// Apps (403 with a gh token, Pilot 1), comes back as steps for you.
//   gh(args, { input })   gh with no shell: { status, stdout, stderr }
//   run(argv)             node for gh-protect.mjs
//   secret(name)          a variable of your environment or of your Windows user, or null
//   readFile(path)        the text of a file
import { join } from 'node:path';

const ENVIRONMENTS = ['development', 'staging', 'production'];
// The environments that hold secrets, each with the branches and tags that may use it, as type:name.
const GUARDED = {
  'merge-gate': ['branch:develop'],
  'jira-sync': ['branch:develop', 'branch:main', 'branch:release/*', 'tag:v*'],
};
const json = (result) => {
  try {
    return JSON.parse(result.stdout || 'null');
  } catch {
    return null;
  }
};

export function setupGithub({ kitDir, repo, mergeAppId, mergeAppKeyFile, secret, readFile, gh, run }) {
  const notes = [];
  const done = [];
  const left = [];
  const write = (label, args, options) => {
    const result = gh(args, options);
    if (result.status !== 0) left.push(`${label} failed: ${(result.stderr || result.stdout).trim().slice(0, 300)}`);
    else notes.push(`Set ${label}`);
    return result.status === 0;
  };

  const info = json(gh(['api', `repos/${repo}`]));
  if (!info) return { ok: false, notes: [`gh cannot read ${repo}: check the name, and that gh is logged in as you (gh auth status)`] };
  const develop = gh(['api', `repos/${repo}/branches/develop`]).status === 0;
  if (info.default_branch === 'develop') done.push('default branch develop');
  else if (!develop) left.push('develop is not on GitHub yet: push it, then run ao-kit setup github again, so it becomes the default branch');
  else write('the default branch to develop, so merge-gate and jira-sync run the workflows of develop', ['api', '-X', 'PATCH', `repos/${repo}`, '-f', 'default_branch=develop']);
  if (info.delete_branch_on_merge) done.push('branch deletion');
  else write('the deletion of a branch once its PR is merged', ['api', '-X', 'PATCH', `repos/${repo}`, '-F', 'delete_branch_on_merge=true']);

  const alerts = gh(['api', `repos/${repo}/vulnerability-alerts`]).status === 0;
  const autofix = json(gh(['api', `repos/${repo}/automated-security-fixes`]))?.enabled === true;
  if (alerts && autofix) done.push('Dependabot security updates');
  else {
    if (!alerts) write('Dependabot alerts', ['api', '-X', 'PUT', `repos/${repo}/vulnerability-alerts`]);
    if (!autofix) write('Dependabot security updates', ['api', '-X', 'PUT', `repos/${repo}/automated-security-fixes`]);
  }

  // A public repo (SPEC-project-scaffold-2.md, section 9, question 1), as the three repos made public on 2026-11-13: only
  // collaborators open issues and PRs and comment, for six months, and the workflows of a PR from a fork wait for your
  // approval. The limit is set again on every run, so a second run renews it.
  if (info.private === false) {
    const limit = gh(['api', '-X', 'PUT', `repos/${repo}/interaction-limits`, '--input', '-'], { input: JSON.stringify({ limit: 'collaborators_only', expiry: 'six_months' }) });
    if (limit.status !== 0) left.push(`the interaction limit failed: ${(limit.stderr || limit.stdout).trim().slice(0, 300)}`);
    else notes.push(`Set the interaction limit of a public repo: collaborators only, until ${json(limit)?.expires_at ?? 'six months from now'}. Run ao-kit setup github again before then to renew it`);
    if (json(gh(['api', `repos/${repo}/actions/permissions/fork-pr-contributor-approval`]))?.approval_policy === 'all_external_contributors') done.push('approval of the workflows of every PR from a fork');
    else write('the approval of the workflows of every PR from a fork', ['api', '-X', 'PUT', `repos/${repo}/actions/permissions/fork-pr-contributor-approval`, '-f', 'approval_policy=all_external_contributors']);
  } else notes.push(`${repo} is private: it needs no interaction limit and no approval of the workflows of forks`);

  // merge-gate reads the key of ao-merge from its environment, which only develop may use (docs/quality-gates.md).
  // jira-sync, merge-gate and audit read JIRA_CI_TOKEN from theirs, never from the repository: every workflow of a PR
  // from a branch of the repo can read a repository secret, and an agent's branch could take it (review of shop PR
  // #21). jira-sync runs on develop, main and release/* (workflow_run runs on the default branch, deployments come from
  // those), and audit for a v* tag a deploy workflow may run on.
  const envs = new Set((json(gh(['api', `repos/${repo}/environments`]))?.environments ?? []).map(({ name }) => name));
  const missingEnvs = [...ENVIRONMENTS, ...Object.keys(GUARDED)].filter((name) => !envs.has(name));
  if (missingEnvs.length === 0) done.push('environments');
  for (const name of missingEnvs) {
    if (name in GUARDED) write(`the environment ${name}, for the branches it names only`, ['api', '-X', 'PUT', `repos/${repo}/environments/${name}`, '--input', '-'], { input: JSON.stringify({ deployment_branch_policy: { protected_branches: false, custom_branch_policies: true } }) });
    else write(`the environment ${name}`, ['api', '-X', 'PUT', `repos/${repo}/environments/${name}`]);
  }
  for (const [name, rules] of Object.entries(GUARDED)) {
    const have = new Set((json(gh(['api', `repos/${repo}/environments/${name}/deployment-branch-policies`]))?.branch_policies ?? []).map(({ name: ref, type = 'branch' }) => `${type}:${ref}`));
    const lacking = rules.filter((rule) => !have.has(rule));
    if (lacking.length === 0) done.push(`the branch rules of ${name}`);
    for (const rule of lacking) {
      const [type, ref] = rule.split(':');
      write(`the ${type} rule of ${name}: ${ref}`, ['api', '-X', 'POST', `repos/${repo}/environments/${name}/deployment-branch-policies`, '-f', `name=${ref}`, '-f', `type=${type}`]);
    }
  }

  const held = (env) => new Set((json(gh(['secret', 'list', '--env', env, '--repo', repo, '--json', 'name'])) ?? []).map(({ name }) => name));
  const envSecrets = Object.fromEntries(Object.keys(GUARDED).map((env) => [env, held(env)]));
  const tokenless = ['jira-sync', 'merge-gate'].filter((env) => !envSecrets[env].has('JIRA_CI_TOKEN'));
  if (tokenless.length === 0) done.push('JIRA_CI_TOKEN');
  else {
    const token = secret('JIRA_CI_TOKEN');
    if (!token) left.push('JIRA_CI_TOKEN is not set on this machine: set it as a user variable (docs/getting-started.md), then run ao-kit setup github again');
    else for (const env of tokenless) write(`the secret JIRA_CI_TOKEN of ${env}, from your variable`, ['secret', 'set', 'JIRA_CI_TOKEN', '--env', env, '--repo', repo], { input: token });
  }
  // A repo set up before keeps its repository secret: setup deletes nothing, so it says how.
  const repoSecrets = new Set((json(gh(['secret', 'list', '--repo', repo, '--json', 'name'])) ?? []).map(({ name }) => name));
  if (repoSecrets.has('JIRA_CI_TOKEN')) {
    left.push(
      `Delete the repository secret JIRA_CI_TOKEN: gh secret delete JIRA_CI_TOKEN --repo ${repo}; or on GitHub, the repo → Settings → Secrets and variables → Actions → tab Secrets → under Repository secrets, the bin icon beside JIRA_CI_TOKEN → Yes, remove this secret. The environments jira-sync and merge-gate hold it now, and every workflow of a PR from a branch of the repo can read a repository secret`,
    );
  }
  // The key of ao-merge lives only here (Pilot 3, spec 2.9): an agent holds the key of ao-dev on your machine, so the
  // App the rulesets let merge without your approval is another one, whose key no machine keeps.
  if (envSecrets['merge-gate'].has('AO_MERGE_APP_KEY')) done.push('AO_MERGE_APP_KEY');
  else if (!mergeAppKeyFile) left.push('AO_MERGE_APP_KEY: give the private key of ao-merge with --merge-app-key-file <path> (docs/github-apps-setup.md, section 2), then run ao-kit setup github again');
  else if (write('the secret AO_MERGE_APP_KEY of merge-gate, from the key file', ['secret', 'set', 'AO_MERGE_APP_KEY', '--env', 'merge-gate', '--repo', repo], { input: readFile(mergeAppKeyFile) })) notes.push(`Delete ${mergeAppKeyFile} now: GitHub holds the key of ao-merge, and no machine an agent uses should`);

  // Only ao-merge bypasses the ruleset of PRs (lib/quality/ruleset.mjs), so gh-protect needs its id.
  let ruleset = { status: 1 };
  if (!mergeAppId) left.push('github.apps.merge and merge_id are not in project.yaml: create the ao-merge App with node <kit>/scripts/github-app-create.mjs --apps merge (docs/github-apps-setup.md), write its slug and id there, then run ao-kit setup github again. No ruleset is applied before');
  else {
    ruleset = run(['node', join(kitDir, 'scripts', 'gh-protect.mjs').replaceAll('\\', '/'), '--repo', repo, '--merge-app-id', String(mergeAppId)]);
    notes.push(`gh:protect: ${`${ruleset.stdout ?? ''}${ruleset.stderr ?? ''}`.trim().split('\n').at(-1) || `exit ${ruleset.status}`}`);
  }
  if (done.length > 0) notes.push(`Already set: ${done.join(', ')}`);
  notes.push(...left);
  notes.push(
    `By hand: add ${repo} to the three GitHub Apps (ao-dev, ao-review, ao-merge): on GitHub, Settings → Applications → Installed GitHub Apps → Configure beside each App → Repository access → choose the repo → Save (docs/github-apps-setup.md section 3)`,
    `By hand: connect GitHub for Atlassian to ${repo} (docs/jira-setup.md section 11)`,
  );
  return { ok: left.length === 0 && ruleset.status === 0, notes };
}
