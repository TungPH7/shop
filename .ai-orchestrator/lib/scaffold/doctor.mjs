// ao-kit doctor (project-scaffold spec 2.5): what a project still lacks, row by row, each with what to do. Pure: ao-kit
// gathers the facts (scripts/ao-kit.mjs) and this decides. A secret is judged by whether it is there and its shape,
// never printed. The VPS row is a question: doctor does not reach the VPS, so it prints the lines deployer.yaml needs.
// facts: { config, projectProblems, nodeVersion, versions: { gh, claude, git, pnpm }, pnpmWanted (the version
// packageManager names, or null), env, files (the paths that exist),
// kitDrift, renderCheck, hooksPath, gitignoreMissing, github: { defaultBranch, environments, secrets, envSecrets,
// workflows (how many GitHub knows), ciRuns (on develop), public, interactionLimit ({ expires_at } or {}) }, apps: { dev,
// review }, jiraCheck, claude: { trusted, mcp }, now (an ISO time), java ([{ app, want, jdk }] for each Java app, jdk
// being findJdk's answer or null), docker ({ running }, read when there is a Java app) }
import { jdkMissing } from '../quality/maven.mjs';
import { managerOf } from '../quality/package-manager.mjs';
import { basicAuthEnv } from '../workflow/qa.mjs';
import { codeownersText } from './install.mjs';

const MIN_GH = [2, 102, 0];
const ENVIRONMENTS = ['development', 'staging', 'production', 'merge-gate'];
const MCP = ['atlassian', 'chrome-devtools'];
const newer = (version, min) => {
  const parts = (version ?? '').match(/(\d+)\.(\d+)\.(\d+)/)?.slice(1).map(Number);
  if (!parts) return false;
  for (let i = 0; i < 3; i++) if (parts[i] !== min[i]) return parts[i] > min[i];
  return true;
};
const shapeOk = (value) => typeof value === 'string' && value.length >= 8 && !/\s/.test(value);

export function doctor(facts) {
  const { config, env } = facts;
  const repo = config?.github?.repo ?? 'the repo';
  const rows = [];
  const row = (group, name, ok, fix) => rows.push({ group, name, ok, fix: ok === true ? '' : fix });

  row('Machine', 'Node 24', Number(facts.nodeVersion.split('.')[0]) >= 24, 'Install Node.js 24 from nodejs.org, then open a new terminal');
  row('Machine', 'GitHub CLI 2.102.0 or later', newer(facts.versions.gh, MIN_GH), 'Install or update gh: winget upgrade GitHub.cli, then gh auth login');
  row('Machine', 'Claude Code', Boolean(facts.versions.claude), 'Install Claude Code (docs/getting-started.md), then run claude once and sign in');
  row('Machine', 'Git', Boolean(facts.versions.git), 'Install Git for Windows, which brings Git Bash');
  // project-scaffold part 2, spec 2.1: the pnpm that runs in the project folder is the one packageManager names.
  const manager = config ? managerOf(config) : 'npm';
  if (manager === 'pnpm') {
    const wanted = facts.pnpmWanted;
    row('Machine', `pnpm ${wanted ?? '(packageManager of package.json)'}`, Boolean(wanted) && facts.versions.pnpm === wanted, wanted ? `The project runs pnpm ${facts.versions.pnpm ?? 'that is not installed'}: npm install -g pnpm@${wanted}, or corepack enable, which takes the version of packageManager` : 'Name the pnpm version in packageManager of package.json, such as "pnpm@11.8.0"');
  }
  // project-scaffold part 3, spec 2.2: a Java app needs the JDK of its pom.xml, which mvnw.mjs finds, and Docker for the
  // Testcontainers of its tests and the database /ao-preview starts.
  const java = facts.java ?? [];
  for (const { app, want, jdk } of java) row('Machine', `JDK ${want} for ${app}`, Boolean(jdk), jdkMissing(want));
  if (java.length > 0) row('Machine', 'Docker is running', facts.docker?.running === true, 'Start Docker Desktop, then run doctor again: the Testcontainers of the Java tests and the database of /ao-preview need it');
  // Keys that must not stay where agents run (Pilot 3, spec 2.9): an agent runs as your Windows user and reads what you
  // read. The key of ao-merge lives only in the merge-gate environment; the age identity, in your password manager.
  // Facts doctor could not read make a question, not a pass (review round 2 of shop PR #13).
  const stray = facts.strayKeys;
  if (!stray) rows.push({ group: 'Machine', name: 'no key of ao-merge and no age identity on this machine? doctor could not look', ok: null, fix: 'Look in ao-keys and in %USERPROFILE%\\.ao: no *-ao-merge.pem and no *.agekey should be there (docs/github-apps-setup.md section 8, docs/vps-setup.md section 16)' });
  else {
    row('Machine', 'no key of ao-merge on this machine', stray.merge.length === 0, `Delete ${stray.merge.join(', ')}: GitHub holds the key of ao-merge in the merge-gate environment, and no machine an agent uses should`);
    row('Machine', 'no age identity of the backups on this machine', stray.age.length === 0, `Keep the identity in your password manager, then delete ${stray.age.join(', ')}; to restore, paste it into ao-backup-pull.mjs decrypt --identity - (docs/vps-setup.md section 16)`);
  }
  // The backup copies this machine pulls (Pilot 3, spec 2.4): a row only on a machine set up to pull them.
  if (facts.backupCopies?.broken) {
    row('Machine', `backup copies of ${config?.name} on this machine are at most 36 h old`, false, `${facts.backupCopies.broken}: run node <kit>/scripts/ao-backup-pull.mjs install --host <ssh host> --dest <folder> again, which writes it (docs/vps-setup.md section 16)`);
  } else if (facts.backupCopies) {
    const mine = facts.backupCopies.filter(({ project }) => project === config?.name);
    const old = mine.filter(({ hours }) => hours > 36);
    const pull = 'run node <kit>/scripts/ao-backup-pull.mjs pull --host <ssh host> --dest <folder>, and see docs/vps-setup.md section 16';
    row('Machine', `backup copies of ${config?.name} on this machine are at most 36 h old`, mine.length > 0 && old.length === 0, mine.length === 0 ? `No copy of ${config?.name} on this machine yet: ${pull}` : `Older than 36 h: ${old.map(({ env, hours }) => `${env}: ${hours} h`).join(', ')}. The machine was off, or the pull or the backup failed: ${pull}`);
  }
  row('Machine', 'ATLASSIAN_AGENT_TOKEN is set', shapeOk(env.ATLASSIAN_AGENT_TOKEN), 'Set the API token of the agents\' Jira account as the user variable ATLASSIAN_AGENT_TOKEN (docs/getting-started.md)');
  row('Machine', 'JIRA_CI_TOKEN is set', shapeOk(env.JIRA_CI_TOKEN), 'Set the API token of the CI Jira account as the user variable JIRA_CI_TOKEN: ao-kit setup github and the QA evidence use it');
  for (const kind of ['DEV', 'REVIEW']) {
    const name = `AO_${kind}_APP_KEY_FILE`;
    row('Machine', `${name} names a key file`, Boolean(env[name]) && facts.files.has(env[name]), `Set ${name} to the path of the private key of ao-${kind.toLowerCase()} on this machine (docs/github-apps-setup.md)`);
  }
  let auth = false;
  try {
    basicAuthEnv(env.AO_ENV_AUTH);
    auth = true;
  } catch {
    auth = false;
  }
  row('Machine', 'AO_ENV_AUTH is user:password', auth, 'Set AO_ENV_AUTH to the basic auth of Development and Staging, user:password, with no double quote, backslash or line break (docs/vps-setup.md section 11)');

  row('Repo', 'project.yaml is valid and agrees with the project', facts.projectProblems.length === 0, `Fix .ai-orchestrator/project.yaml, then ao-kit check: ${facts.projectProblems.slice(0, 3).join('; ')}`);
  row('Repo', 'the kit files are those of this clone', facts.kitDrift.length === 0, `${facts.kitDrift.length} kit files differ: ao-kit sync <dir> --key <KEY of a Task>, then its PR`);
  row('Repo', 'settings.json and the agents are rendered from project.yaml', facts.renderCheck.status === 0, `ao-kit render <dir>, then commit: ${facts.renderCheck.text.split('\n')[0]}`);
  row('Repo', 'git hooks are installed', facts.hooksPath === '.githooks', `${manager} install in the project: its prepare script runs .ai-orchestrator/scripts/install-hooks.mjs`);
  row('Repo', '.gitignore has the lines of the kit', facts.gitignoreMissing.length === 0, `ao-kit sync, or add them by hand: ${facts.gitignoreMissing.join(', ')}`);
  // The rulesets count only a code owner's approval (Pilot 3, spec 2.9).
  const owners = config?.github?.approvers?.length ? codeownersText(config.github.approvers) : null;
  row('Repo', '.github/CODEOWNERS makes your logins the owners of every file', owners !== null && facts.codeowners === owners, `ao-kit sync <dir> --key <KEY of a Task> writes it from github.approvers of project.yaml; merge it in its PR. Without it, an App with write access could approve a PR in your place`);

  const gh = facts.github;
  row('GitHub', 'default branch develop', gh.defaultBranch === 'develop', 'ao-kit setup github <dir>, once develop is on GitHub');
  row('GitHub', `environments ${ENVIRONMENTS.join(', ')}`, ENVIRONMENTS.every((name) => gh.environments.includes(name)), 'ao-kit setup github <dir>');
  // merge-gate merges with ao-merge, the only App the rulesets let merge without your approval (Pilot 3, spec 2.9).
  if (config?.github?.apps?.merge) {
    row('GitHub', 'secrets JIRA_CI_TOKEN, and AO_MERGE_APP_KEY of merge-gate', gh.secrets.includes('JIRA_CI_TOKEN') && gh.envSecrets.includes('AO_MERGE_APP_KEY'), 'ao-kit setup github <dir> --merge-app-key-file <the key of ao-merge>, then delete the key file');
  } else {
    row('GitHub', 'the ao-merge App, the only one the rulesets let merge without your approval', false, 'node <kit>/scripts/github-app-create.mjs --owner <you> --repo <repo> --apps merge (docs/github-apps-setup.md); write its slug and id as github.apps.merge and merge_id in project.yaml; then ao-kit setup github <dir> --merge-app-key-file <the key>, and delete the key file');
  }
  for (const kind of ['dev', 'review']) {
    const app = facts.apps[kind];
    row('GitHub', `ao-${kind} installed on ${repo}`, app.ok, `${app.reason ?? 'no token'}: install the App on the repo (docs/getting-started.md)`);
  }
  // Only a token of the App itself lists where it is installed, and its key lives on the VPS only, so this is a
  // question (project-scaffold part 3, spec 2.6; found at T24 of part 2).
  rows.push({ group: 'GitHub', name: `ao-deploy installed on ${repo}? GitHub does not let doctor read it`, ok: null, fix: 'The deployer on the VPS reads the repo with it, and stops with "App … is not installed" without it. On GitHub: your picture → Settings → Applications → Installed GitHub Apps → Configure next to the App ao-deploy → Repository access → Select repositories → this repo → Save' });
  // The first push to an empty repo may start nothing: no run though the workflows were active (Pilot 1, T7), or
  // Actions off on the repo though the API says enabled (T16).
  // A public repo keeps an interaction limit of six months (SPEC-project-scaffold-2.md, section 9, question 1).
  if (gh.public) {
    const expires = gh.interactionLimit?.expires_at ? Date.parse(gh.interactionLimit.expires_at) : null;
    const days = expires === null ? null : Math.floor((expires - Date.parse(facts.now)) / 86400000);
    row('GitHub', 'a public repo: only collaborators open issues and PRs, for 30 days more at least', days !== null && days >= 30, `${days === null ? 'No interaction limit runs' : `The interaction limit ends in ${Math.max(days, 0)} days`}: ao-kit setup github <dir> sets it again for six months`);
  }
  row('GitHub', 'GitHub knows the workflows of the repo', gh.workflows > 0, 'Open the Actions tab of the repo on GitHub: if it says "Workflows aren\'t being run on this repository", click Enable Actions on this repository');
  row('GitHub', 'CI has run on develop', gh.ciRuns > 0, `gh workflow run CI --repo ${repo} --ref develop, then wait for it to pass: the first push to an empty repo may start no workflow`);

  row('Jira', 'jira:check finds no difference', facts.jiraCheck.status === 0, `ao-kit setup jira <dir>, then the board columns by hand: ${facts.jiraCheck.text.split('\n').at(-1)}`);

  row('Claude Code', 'folder trusted', facts.claude.trusted === true, 'Open claude in the project folder once and answer that you trust it: until then Claude Code skips the allow rules of the project');
  row('Claude Code', `MCP servers ${MCP.join(', ')} allowed`, MCP.every((name) => facts.claude.mcp.includes(name)), 'In claude, run /mcp and allow both servers; /mcp must show them connected');

  const name = config?.name ?? '<name>';
  // One public app: one host for each environment, as before. Two or more: each app with its own (project-scaffold part
  // 2, spec 2.4). The hosts of project.yaml when it names them, else a guess to fill in.
  const guess = (prefix, environment) => `${prefix}${environment === 'production' ? '' : `-${environment === 'development' ? 'dev' : environment}`}.<your domain>`;
  const envLines = (indent, app, prefix) => ['development', 'staging', 'production'].map((environment) => `${indent}${environment}: ${app?.hosts?.[environment] ?? guess(prefix, environment)}`).join('\n');
  const open = Object.entries(config?.apps ?? {}).filter(([, app]) => app.public);
  const hosts = open.length > 1 ? open.map(([app, spec], i) => `      ${app}:\n${envLines('        ', spec, i === 0 ? name : `${name}-${app}`)}`).join('\n') : envLines('      ', open[0]?.[1], name);
  rows.push({ group: 'VPS', name: 'is the project in /etc/ao/deployer.yaml? doctor does not reach the VPS', ok: null, fix: `Under projects: of /etc/ao/deployer.yaml, as docs/vps-setup.md says:\n  - name: ${name}\n    repo: ${repo}\n    space: ${config?.jira?.space ?? '<KEY>'}\n    hosts:\n${hosts}` });
  return rows;
}

// The printout: ✔ for a row that passes, ✘ with what to do, ? for a question; then how many rows to fix.
export function formatDoctor(rows) {
  const lines = rows.map(({ group, name, ok, fix }) => {
    const mark = ok === true ? '✔' : ok === false ? '✘' : '?';
    return `${mark} ${group}: ${name}${ok === true ? '' : `\n${fix.split('\n').map((line) => `    ${line}`).join('\n')}`}`;
  });
  const bad = rows.filter(({ ok }) => ok === false).length;
  lines.push('', bad === 0 ? 'Every row passes.' : `${bad} row${bad === 1 ? '' : 's'} to fix.`);
  return lines.join('\n');
}
