// The step behind the /ao-* commands (dev-workflow spec 2.1, 2.2): gathers the facts of a command from Jira, GitHub and
// .ai/, decides, and prints GO with the runs or STOP with the reason. With --go it then makes the runs, one agent at a
// time, and writes .ai/runs/<KEY>/state.json, a stream-json log per run, and last.md. It never moves a Jira item,
// approves or merges a PR; the second /ao-plan only asks GitHub to run jira-sync, with your gh login.
// Usage: node .ai-orchestrator/scripts/ao-step.mjs <status|spec|plan|request|build|review|fix|...> [<KEY>|<PR>] [--go]
//        [--answers <file>] [--note <file>] [--retest]
// It exits 0 on GO and on STOP, and 1 only when it cannot run: a token missing, Jira or GitHub not answering.
// Jira is read with ATLASSIAN_AGENT_TOKEN, GitHub with a read-only token of the ao-review App. Run it from the project
// root; the kit is in AO_KIT_DIR when set.
import { spawn, spawnSync } from 'node:child_process';
import { appendFileSync, closeSync, copyFileSync, cpSync, existsSync, mkdirSync, openSync, readdirSync, readFileSync, realpathSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { freemem, tmpdir } from 'node:os';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { parse } from 'yaml';
import { CLEARED_ENV, READ_PERMISSIONS } from '../lib/agents/launch.mjs';
import { mergeLocal, readRoster } from '../lib/agents/roster.mjs';
import { readContract } from '../lib/contract.mjs';
import { projectSettings, setting } from '../lib/project-settings.mjs';
import { touchedPaths, unquotePath } from '../lib/quality/diff-paths.mjs';
import { readProjectYaml } from '../lib/quality/approved-file.mjs';
import { epicOfDocsBranch, readGates } from '../lib/quality/gates.mjs';
import { withProjectPaths } from '../lib/quality/review-tiers.mjs';
import { matchesGlob } from '../lib/quality/glob.mjs';
import { DOCKER_INFO, dockerAnswered } from '../lib/quality/maven.mjs';
import { markReadyForReview, READY_PERMISSIONS } from '../lib/quality/pr-ready.mjs';
import { appCredentials, botIdentity, githubRepoOf, installationToken, userSecret } from '../lib/quality/github-app.mjs';
import { npmCli } from '../lib/quality/npm.mjs';
import { installArgs, managerFromLockfile, pnpmCli, runManager } from '../lib/quality/package-manager.mjs';
import { attachEvidence } from '../lib/tracker/attachments.mjs';
import { createGitHubClient, readGitHubToken } from '../lib/tracker/github-client.mjs';
import { markdownToAdf } from '../lib/tracker/adf.mjs';
import { findingsComment, findingsTask, recordedLine } from '../lib/workflow/findings.mjs';
import { waiverBody } from '../lib/quality/waivers.mjs';
import { bearerAuth, createJiraClient } from '../lib/tracker/jira-client.mjs';
import { readMapping } from '../lib/tracker/mapping.mjs';
import { startAgentProcess, killTree, stopProcessesUnder } from '../lib/workflow/agent-process.mjs';
import { answers, portBusy, previewRunner } from '../lib/workflow/preview-run.mjs';
import { withLoggedSession } from '../lib/workflow/runs.mjs';
import { gatherFacts, readRunning } from '../lib/workflow/facts.mjs';
import { basicAuthEnv, qaFollowUp } from '../lib/workflow/qa.mjs';
import { releaseCutChanges } from '../lib/release/release-cut.mjs';
import { changelogWith, notesPullRequest, onReleaseHead, waitForMerge } from '../lib/release/release-pr.mjs';
import { requestDeploy } from '../lib/release/deploy-request.mjs';
import { adfText, buildReviewPack, filesToQuote } from '../lib/workflow/review-pack.mjs';
import { postKitCopyReports, readKitCopy, renderedReason } from '../lib/workflow/kit-copy.mjs';
import { removeInstructions } from '../lib/workflow/review-tree.mjs';
import { agentCommand, formatDecision, runGo } from '../lib/workflow/runner.mjs';
import { CHANGES, appRolesOf, decideStep, dockerGate, seoMarkText } from '../lib/workflow/steps.mjs';
import { restoreWip, saveWip } from '../lib/workflow/wip.mjs';
import { copyRunFiles, laneKeeper, removeNodeModules, runsSettings } from '../lib/workflow/lanes.mjs';
import { installLane, pullsOfBranch, qaWatcher, runPlacer } from '../lib/workflow/lane-runs.mjs';
import { checkoutBranch, laneDir } from '../lib/workflow/places.mjs';
import { admitAgent, claimRole, claimsRole, jiraWipStop, liveLocks, releaseAgent, takeLock as takeRunLock } from '../lib/workflow/locks.mjs';
import { wipHolders } from '../lib/tracker/facts.mjs';
import { runsAtOnce } from '../lib/workflow/ports.mjs';
import { hookKitDrift, hookKitNote } from '../lib/workflow/hook-kit.mjs';
import { planRound, runDispatcher, scopeOf } from '../lib/workflow/dispatch.mjs';
import { DISPATCHER_FILE, dispatcherEffects, spentSince } from '../lib/workflow/run-command.mjs';
import { seoChange } from '../lib/workflow/seo-commit.mjs';
import { QA_CONTEXT, qaSignal } from '../lib/workflow/qa-signal.mjs';

const COMMANDS = ['status', 'intake', 'preview', 'spec', 'plan', 'request', 'build', 'review', 'fix', 'qa', 'release', 'ship', 'rollback'];
const USAGE = 'usage: node .ai-orchestrator/scripts/ao-step.mjs <status|intake|preview|spec|plan|request|build|review|fix|qa|release|ship|rollback> [<KEY>|<PR>|<vX.Y.0> <sha>|<vX.Y.Z>|<environment> [<sha>]] [--go] [--answers <file>] [--note <file>] [--change <word>] [--stop] [--retest]; or run <EPIC>|<KEY>… [--go] [--budget <USD>], or run --stop';
// --json (the dry run of the dispatcher /ao-run, C2 spec 5.2) prints the decision as one line of JSON and nothing else;
// --result <file>, with --go (its real run), writes the last decision there.
export function decisionJson(decision) {
  const runs = (decision.runs ?? []).map(({ role, purpose, action, qa }) => ({ role: role ?? null, purpose: purpose ?? null, action: action ?? null, ...(qa?.environment && { qa: { environment: qa.environment } }) }));
  return JSON.stringify({ go: Boolean(decision.go), reason: decision.reason ?? null, next: decision.next ?? null, waits: decision.waits ?? null, then: decision.then ?? null, runs });
}
const ENVIRONMENTS = ['development', 'staging', 'production'];
// The commands that read deployments with your gh login (release-workflow T12).
const RELEASE_COMMANDS = ['qa', 'release', 'ship', 'rollback', 'status'];
const kitDir = resolve(process.env.AO_KIT_DIR ?? fileURLToPath(new URL('..', import.meta.url)));
const projectDir = process.cwd();
const runsDir = join(projectDir, '.ai', 'runs');
// The mark of a comment of seo that --seo-ok takes, as the check prints it: its id and hash, or none (review of shop PR #81).
const SEO_MARK = /^(?:\d+|none):(?:[0-9a-f]{16}|none)$/;
// The locks of the commands that run agents, one file each (parallel-runs spec 5.1).
const activeDir = join(runsDir, 'active');
const lockFs = { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync };
// The commands that stop a preview before they run: every one that may run an agent or switch the folder. /ao-ship runs
// devops in the project folder with no checkout of its own (review of ao-sample PR #21), so the release commands too.
const PREVIEW_STOPS = ['spec', 'plan', 'request', 'build', 'review', 'fix', 'qa', 'release', 'ship', 'rollback'];
// maxBuffer: the full text of a file or a diff may pass the 1 MiB default, which ends git with ENOBUFS and no output.
const git = (...args) => spawnSync('git', args, { cwd: projectDir, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
// git in another folder: a lane of an item (parallel-runs spec 4).
const gitIn = (dir) => (...args) => spawnSync('git', args, { cwd: dir, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
// /ao-preview on this machine (human-loop spec 4.3): its files, the facts it reads, starting and stopping the apps.
const preview = previewRunner({
  projectDir,
  git,
  checkout: (spec) => prepareCheckout(spec),
  runPackages: runManager,
  spawn,
  fs: { existsSync, readFileSync, writeFileSync, rmSync, mkdirSync, openSync },
  portBusy,
  answers,
  killTree: (pid) => killTree(pid, { spawnSync, kill: (target, signal) => process.kill(target, signal) }),
  sleep: (ms) => new Promise((done) => setTimeout(done, ms)),
  env: process.env,
  execPath: process.execPath,
  cliOf: (tool) => (tool === 'pnpm' ? pnpmCli() : npmCli()),
  cleared: CLEARED_ENV,
  // The lock of this very process, taken for --go, is not another run; in a lane, only a run on the item counts.
  agentRunning: (key) => liveLocks(activeDir, { fs: lockFs, alive }).find((lock) => lock.pid !== process.pid && lock.command !== 'preview' && (key === undefined || lock.key === key)) ?? null,
  // A preview in a lane holds its item while its first app runs (C2 spec section 8): the lock dies with that app.
  gitAt: gitIn,
  hold: ({ pid, key }) => {
    mkdirSync(activeDir, { recursive: true });
    writeFileSync(join(activeDir, `${key}+preview.json`), `${JSON.stringify({ pid, command: 'preview', arg: key, key, agent: false, slot: -1, startedAt: new Date().toISOString() }, null, 2)}\n`);
  },
  drop: (key) => rmSync(join(activeDir, `${key}+preview.json`), { force: true }),
});
const previewActive = preview.paths.active;

// The argument of a command, checked before it reaches anything: a key of the project space, or a PR number. The
// skill passes only this word, which Claude Code puts in the shell line as it is (T1).
export function checkArgument(command, arg, space, extra) {
  if (!COMMANDS.includes(command)) return `unknown command ${command ?? '(none)'}; ${USAGE}`;
  if (command === 'ship') return /^v\d{1,4}\.\d{1,4}\.\d{1,4}$/.test(arg ?? '') && extra === undefined ? null : `/ao-ship takes a release such as v0.1.0, not ${[arg, extra].filter(Boolean).join(' ') || 'nothing'}`;
  if (command === 'rollback') {
    const ok = ENVIRONMENTS.includes(arg) && (extra === undefined || /^[0-9a-f]{7,40}$/.test(extra));
    return ok ? null : `/ao-rollback takes an environment (${ENVIRONMENTS.join(', ')}) and maybe a commit, not ${[arg, extra].filter(Boolean).join(' ') || 'nothing'}`;
  }
  if (command === 'release') {
    const ok = (arg === undefined && extra === undefined) || (/^v\d{1,4}\.\d{1,4}\.\d{1,4}$/.test(arg ?? '') && /^[0-9a-f]{7,40}$/.test(extra ?? ''));
    return ok ? null : `/ao-release takes nothing, or a release such as v0.1.0 and the cut point it printed, not ${[arg, extra].filter(Boolean).join(' ') || 'that'}`;
  }
  // The description goes in the chat, never on the check line (human-loop spec 3.1).
  if (command === 'intake') return arg === undefined && extra === undefined ? null : '/ao-intake takes no argument on its check line: your description stays in the chat';
  if (extra !== undefined) return `/ao-${command} takes one argument`;
  if (['review', 'fix'].includes(command)) return /^\d{1,7}$/.test(arg ?? '') ? null : `/ao-${command} takes a PR number, not ${arg ?? 'nothing'}`;
  if (command === 'status' && arg === undefined) return null;
  if (!/^[A-Z][A-Z0-9]*-\d{1,7}$/.test(arg ?? '')) return `/ao-${command} takes a Jira key such as ${space ?? 'DEMO'}-12, not ${arg ?? 'nothing'}`;
  if (space && !arg.startsWith(`${space}-`)) return `${arg} is not in the space ${space} of this project`;
  return null;
}

// What a command does first when a preview runs (human-loop spec 4.3): 'stop' it, go back to develop and run again from
// there; 'refuse' when this is that second run and the preview is still on record, so it never loops; null otherwise.
// Only /ao-status, /ao-intake and /ao-preview leave a preview alone.
export function previewFirst(command, running, stoppedAlready) {
  if (!PREVIEW_STOPS.includes(command) || !running) return null;
  return stoppedAlready ? 'refuse' : 'stop';
}

// --change: what your request changes, as you answered the main session (human-loop spec 4.5, 5.1). One word of a
// fixed list, so nothing you wrote reaches the command line; it goes with --note only.
export function checkChange(command, change, hasNote) {
  if (change === undefined) return null;
  const allowed = { fix: CHANGES, qa: ['none', 'ac'] }[command];
  if (!allowed) return '--change goes with /ao-fix and /ao-qa only';
  if (!allowed.includes(change)) return `--change takes ${allowed.join(', ')}, not ${change}`;
  return hasNote ? null : '--change goes with --note: it says what your request changes';
}

// ao-step, the kit and the instructions of the agents are read from the checkout, so a review or a fix starts only on a
// protected branch: on the branch of a PR it would run that PR's code (second review of ao-sample PR #13). This
// catches a slip; what keeps the checkout there is homeBranch below, run by the code the command started with.
const isProtected = (branch, protectedBranches) => protectedBranches.some((pattern) => matchesGlob(pattern, branch));
export function checkoutStop(command, branch, protectedBranches) {
  if (!['review', 'fix'].includes(command) || isProtected(branch, protectedBranches)) return null;
  // ao-step puts aside only what a run left while ao-step still ran; after a killed shell it cannot tell whose the work
  // is, so you put it aside (live-run-fixes spec 2.1).
  return `the checkout is on ${branch || 'a detached HEAD'}, not a protected branch (${protectedBranches.join(', ')}): ao-step, the kit and the instructions of the agents would come from it. Switch it to the base of the PR (git switch develop), then run /ao-${command} again. If git refuses to switch because a run stopped with its shell and left work not committed, put that work aside first with git stash push --include-untracked -m "<what it is>", and apply it again by its SHA once the run goes on`;
}

// The branch the checkout goes back to when a command ends: the base of the item's open PR, so the next /ao-review or
// /ao-fix starts on approved code. A build whose PR is not open yet stays on its branch, where the next run goes on.
export function homeBranch(command, facts, protectedBranches) {
  const pr = facts?.pr;
  if (!['build', 'review', 'fix'].includes(command) || pr?.state !== 'open') return null;
  return isProtected(pr.base, protectedBranches) ? pr.base : null;
}

// A token or password of yours: your Windows user variable first, so a changed secret is used at once (Pilot 3, T2).
const secret = (name) => userSecret(name);

// The file of --note or --answers, which the skills write in .ai/runs/<KEY>/. Its text goes to the agent as the human's
// words, so a file anywhere else is refused.
export function runsFile(projectDir, file) {
  const path = resolve(projectDir, file);
  const inside = relative(join(projectDir, '.ai', 'runs'), path);
  if (inside === '' || inside.startsWith('..') || resolve(inside) === inside) throw new Error(`--note, --answers and --light-report read only a file in .ai/runs/, not ${file}`);
  return path;
}


async function main() {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: { go: { type: 'boolean', default: false }, answers: { type: 'string' }, note: { type: 'string' }, change: { type: 'string' }, stop: { type: 'boolean', default: false }, retest: { type: 'boolean', default: false }, 'light-report': { type: 'string' }, full: { type: 'boolean', default: false }, 'seo-ok': { type: 'string' }, json: { type: 'boolean', default: false }, result: { type: 'string' }, budget: { type: 'string' } } });
  const [command, arg, extra] = positionals;
  if (command === 'run') {
    await runCommand(positionals.slice(1), values);
    return;
  }
  const settings = projectSettings(projectDir);
  const space = setting('AO_JIRA_SPACE', settings);
  // The last decision of a run the dispatcher started (--result), and a STOP before any decision, in the shape --json
  // prints.
  const writeResult = (decision) => {
    if (!values.result) return;
    const file = runsFile(projectDir, values.result);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, `${decisionJson(decision)}\n`);
  };
  const early = (reason, waits = 'fix') => {
    const decision = { go: false, reason, next: null, waits };
    if (values.json) console.log(decisionJson(decision));
    else console.log(`STOP: ${reason}`);
    writeResult(decision);
  };
  const wrong = checkArgument(command, arg, space, extra) ?? checkChange(command, values.change, Boolean(values.note)) ?? (values.stop && command !== 'preview' ? '--stop goes with /ao-preview and /ao-run only' : null) ?? (values['light-report'] && command !== 'qa' ? '--light-report goes with /ao-qa only' : null) ?? (values.full && command !== 'review' ? '--full goes with /ao-review only' : null) ?? (values['seo-ok'] !== undefined && command !== 'build' ? '--seo-ok goes with /ao-build only' : null) ?? (values['seo-ok'] !== undefined && !SEO_MARK.test(values['seo-ok']) ? '--seo-ok takes the mark the check printed, such as 10612:a1b2c3d4e5f60718' : null) ?? (values.budget ? '--budget goes with /ao-run only' : null) ?? (values.result && !values.go ? '--result goes with --go' : null) ?? (values.json && values.go ? '--json is a dry run: it does not go with --go' : null);
  if (wrong) {
    early(wrong);
    return;
  }
  // A preview runs the PR's code from this folder, on its branch: a command that runs agents stops it first, puts the
  // folder back on develop, and runs again from there, so the approved kit decides (human-loop spec 4.3). The dry run of
  // the dispatcher (--json) runs no agent, and leaves your preview alone.
  // A preview in a lane leaves the project folder on develop: only a command on its item stops it, below, once the item
  // is known (C2 spec section 8).
  const previewRecord = readJson(previewActive);
  const first = values.json || previewRecord?.lane ? null : previewFirst(command, existsSync(previewActive), Boolean(process.env.AO_PREVIEW_STOPPED));
  if (first === 'refuse') {
    early(`the preview still runs after ao-step stopped it (${relative(projectDir, previewActive)}): run /ao-preview <KEY> --stop, then /ao-${command} again`, 'you');
    return;
  }
  if (first === 'stop') {
    const stopped = await preview.stop();
    console.log(stopped.notes.join('\n'));
    // Still on the PR branch: running again would run its kit (review of ao-sample PR #21).
    if (!stopped.home) {
      console.log(`STOP: the project folder is not back on develop, so /ao-${command} does not run: fix what the line above says, then /ao-preview <KEY> --stop`);
      return;
    }
    const again = spawnSync(process.execPath, [join(kitDir, 'scripts', 'ao-step.mjs'), ...process.argv.slice(2)], { cwd: projectDir, stdio: 'inherit', env: { ...process.env, AO_PREVIEW_STOPPED: '1' } });
    process.exitCode = again.status ?? 1;
    return;
  }
  if (!space) throw new Error('AO_JIRA_SPACE is not set in .claude/settings.json');
  const apps = { dev: setting('AO_DEV_APP', settings), review: setting('AO_REVIEW_APP', settings) };
  if (!apps.dev || !apps.review) throw new Error('AO_DEV_APP and AO_REVIEW_APP are not set in .claude/settings.json');
  const approvers = (setting('AO_APPROVERS', settings) ?? '').split(',').map((login) => login.trim()).filter(Boolean);

  const contract = readContract(join(kitDir, 'contract'));
  const mapping = readMapping(join(kitDir, 'tracker'));
  // The project's own paths of a review tier, from its project.yaml (review of shop PR #79).
  const gates = withProjectPaths(readGates(join(kitDir, 'quality')), readProjectYaml(projectDir));
  const onBranch = () => git('branch', '--show-current').stdout?.trim() ?? '';
  const wrongCheckout = checkoutStop(command, onBranch(), gates.protected_branches);
  if (wrongCheckout) {
    early(wrongCheckout);
    return;
  }
  const localFile = join(kitDir, 'roster.local.yaml');
  const local = existsSync(localFile) ? parse(readFileSync(localFile, 'utf8')) : undefined;
  const { roster, errors } = mergeLocal(readRoster(join(kitDir, 'agents')), local, { skillExists: (name) => existsSync(join(projectDir, '.claude', 'skills', name, 'SKILL.md')) });
  if (errors.length > 0) throw new Error(errors.join('\n'));

  const jiraToken = secret('ATLASSIAN_AGENT_TOKEN');
  if (!jiraToken) throw new Error('ATLASSIAN_AGENT_TOKEN is not set');
  const jira = createJiraClient({ cloudId: mapping.cloud_id, authorization: bearerAuth(jiraToken) });
  const repo = githubRepoOf(git('remote', 'get-url', 'origin').stdout?.trim() ?? '');
  const appEnv = { ...process.env, AO_REVIEW_APP: apps.review, AO_REVIEW_APP_ID: setting('AO_REVIEW_APP_ID', settings) };
  const { token } = await installationToken({ ...appCredentials('review', { env: appEnv }), repo, permissions: READ_PERMISSIONS });
  const github = createGitHubClient({ repo, token });
  // The lanes of the project (parallel-runs spec 4): off unless project.yaml turns runs.worktrees on.
  const projectYaml = join(projectDir, '.ai-orchestrator', 'project.yaml');
  const runs = runsSettings(existsSync(projectYaml) ? parse(readFileSync(projectYaml, 'utf8')) : {});
  // A lane installs with none of your secrets in its environment (spec 4.2).
  const installEnv = () => {
    const env = { ...process.env };
    for (const name of CLEARED_ENV) delete env[name];
    return env;
  };
  const keeper = laneKeeper({
    projectDir,
    gitIn,
    install: async (dir) => installLane(dir, { env: installEnv(), exists: existsSync, manager: managerFromLockfile, args: installArgs, run: runManager }),
    fs: { existsSync, mkdirSync, copyFileSync, cpSync, readdirSync, rmSync, statSync, writeFileSync },
    pullsOf: (branch) => pullsOfBranch(github, repo, branch),
    isProtected: (branch) => isProtected(branch, gates.protected_branches),
    settings: runs,
    // A lane another command runs on is not pruned (review round 2 of shop PR #21).
    busy: (k) => liveLocks(activeDir, { fs: lockFs, alive }).some((lock) => lock.key === k && lock.pid !== process.pid),
  });
  const files = {
    ledger: (key) => keeper.ledgerExists(key),
    runState: readRunState,
    runStates: () => (existsSync(runsDir) ? readdirSync(runsDir).map(readRunState).filter(Boolean) : []),
    // The docs branch of an Epic on this checkout, where stage spec commits before it pushes.
    branch: (name) => git('rev-parse', '--verify', '--quiet', `refs/heads/${name}`).status === 0,
    file: (branch, path) => {
      const shown = git('show', `refs/heads/${branch}:${path}`);
      return shown.status === 0 ? shown.stdout : null;
    },
    // A file the agents of a release command wrote in .ai/runs/<release>/ (release-workflow T15).
    runFile: (k, name) => readRunFile(k, name),
  };
  // The release commands read deployments with your gh login: the read token of ao-review may not (release-workflow T12).
  const userToken = RELEASE_COMMANDS.includes(command) ? readGitHubToken() : null;
  const deploys = userToken ? createGitHubClient({ repo, token: userToken }) : undefined;
  // A kit copy is compared with a head of another project, which your gh login reads (kit-copy-review spec 2.5).
  const peers = (setting('AO_KIT_PEERS', settings) ?? '').split(',').map((name) => name.trim()).filter(Boolean);
  const kitCopy = (pr) => readKitCopy({ pr, github, peer: (name) => createGitHubClient({ repo: name, token: readGitHubToken() }), peers, gates, apps, approvers, render: (sha, paths) => renderCheck(pr.number, sha, paths) });
  const gatherAll = () => gatherFacts({ command, arg, extra, jira, github, deploys, history: developHistory, local: files, contract, mapping, roster, gates, apps, approvers, space, kitCopy, agentsPerRole: runs.agentsPerRole });
  // /ao-preview also reads this machine: project.yaml, the preview that runs, the folder and the ports (spec 4.3).
  const gather = async () => {
    const gathered = await gatherAll();
    // With lanes on, the dev agents write the preview of an item in its lane (review of shop PR #21).
    const itemKey = gathered.item?.key;
    const facts = runs.worktrees && itemKey ? { ...gathered, previewDir: `${join(laneDir(projectDir, itemKey), '.ai', 'runs', itemKey, 'preview').replaceAll('\\', '/')}/` } : gathered;
    if (command === 'status') return { ...facts, previewRunning: readJson(previewActive) };
    // With lanes on, the preview runs from the lane of the item (C2 spec section 8).
    const lane = runs.worktrees && itemKey ? { key: itemKey, dir: existsSync(laneDir(projectDir, itemKey)) ? laneDir(projectDir, itemKey) : null } : null;
    return command === 'preview' ? { ...facts, preview: await preview.facts(values.stop, facts.pr, lane) } : facts;
  };
  const read = (file) => readFileSync(runsFile(projectDir, file), 'utf8');
  // The dev agent of each app by its profile: /ao-fix gives a blocking finding to the side of its app (kit followups,
  // batch 2; PR #62 of shop, Pilot 3).
  const projectApps = existsSync(projectYaml) ? (parse(readFileSync(projectYaml, 'utf8'))?.apps ?? {}) : {};
  const appRoles = appRolesOf(projectApps);
  // The apps whose screens seo writes the SEO of (C1 spec 6.1).
  const seoApps = Object.entries(projectApps).filter(([, app]) => app?.seo === true).map(([name]) => name);
  // Their hosts in every environment: the addresses seo's text may name besides schema.org (second review of shop PR #79).
  const seoHosts = seoApps.flatMap((name) => Object.values(projectApps[name]?.hosts ?? {})).filter((host) => typeof host === 'string');
  const options = { roster, contract, gates, mapping, appRoles, seoApps, seoHosts, ...(values['seo-ok'] !== undefined && { seoOk: values['seo-ok'] }), ...(values.answers && { answers: read(values.answers) }), ...(values.note && { note: read(values.note) }), ...(values.change && { change: values.change }), ...(values.retest && { retest: true }), ...(values['light-report'] && { lightReport: read(values['light-report']) }), ...(values.full && { full: true }) };

  const facts = await gather();
  // Your seo-ok holds the comment of seo that is newest now (review of shop PR #80): kept for the later dev runs of the
  // item, which wait for you again once seo writes or changes one. A dry run keeps nothing.
  // It names the mark the check printed, and keeps nothing when the comment changed since (review of shop PR #81).
  if (values['seo-ok'] !== undefined && facts.item?.seo && values['seo-ok'] === seoMarkText(facts.item.seoMark)) {
    const mark = facts.item.seoMark ?? { id: null, hash: null };
    if (values.go) {
      mkdirSync(join(runsDir, facts.item.key), { recursive: true });
      writeFileSync(join(runsDir, facts.item.key, 'seo-ok.json'), `${JSON.stringify({ ...mark, at: new Date().toISOString() }, null, 2)}\n`);
    }
    facts.seoApproved = mark;
  }
  // A command that runs on the item of a preview in a lane stops it first, with --go: an agent may change its code. A
  // command of another item leaves it alone (C2 spec section 8).
  if (previewRecord?.lane && PREVIEW_STOPS.includes(command) && previewRecord.key === facts.item?.key) {
    if (values.go && !values.json) console.log((await preview.stop()).notes.join('\n'));
    else if (!values.json) console.log(`The preview of ${previewRecord.key} runs from its lane: --go stops it first.`);
  }
  // The board of the dispatcher (C2 spec 5.2): the items of the space in the order of the board, and the open PRs.
  if (values.json && command === 'status') {
    console.log(JSON.stringify({ items: facts.items ?? [], pulls: facts.pulls ?? [] }));
    return;
  }
  // A Java app needs Docker for the tests be-dev and qa run (project-scaffold part 3, spec 2.2).
  const projectFile = join(projectDir, '.ai-orchestrator', 'project.yaml');
  const java = existsSync(projectFile) && Object.values(parse(readFileSync(projectFile, 'utf8'))?.apps ?? {}).some((app) => app?.profile === 'spring-boot');
  const dockerRunning = () => dockerAnswered(spawnSync('docker', DOCKER_INFO, { encoding: 'utf8', timeout: 20000 }));
  // The qa runs of other commands: the stop at gate ③ says to wait while one tests where the merge deploys.
  const qaRunning = liveLocks(activeDir, { fs: lockFs, alive }).filter((lock) => lock.command === 'qa' && lock.pid !== process.pid).map(({ key: k, environment, pid }) => ({ key: k, environment, pid }));
  // Three seconds before Docker is asked again: the command waits on nothing else meanwhile.
  const pause = () => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 3000);
  const decision = dockerGate(decideStep(command, { ...facts, qaRunning }, options), { java, dockerRunning, pause });
  if (values.json) {
    console.log(decisionJson(decision));
    return;
  }
  console.log(formatDecision(decision));
  // Agents run the hooks of the kit in AO_KIT_DIR: one that differs from the kit copy of the project is named (review round
  // 3 of shop PR #21).
  const readText = (path) => {
    try {
      return readFileSync(path, 'utf8');
    } catch {
      return null;
    }
  };
  const listFiles = (dir) => (existsSync(dir) ? readdirSync(dir, { recursive: true, withFileTypes: true }).filter((entry) => entry.isFile()).map((entry) => relative(dir, join(entry.parentPath, entry.name))) : []);
  const drift = process.env.AO_KIT_DIR ? hookKitNote(hookKitDrift({ kitDir, copyDir: join(projectDir, '.ai-orchestrator'), read: readText, list: listFiles }), kitDir) : null;
  if (drift) console.log(drift);
  if (command === 'status' && runs.worktrees) {
    const lanes = keeper.list();
    console.log(lanes.length > 0 ? `Lanes: ${lanes.map(({ key: k, branch }) => `${k} on ${branch || 'no branch yet'}`).join('; ')}` : 'Lanes: none');
  }
  if (command === 'status') {
    const live = liveLocks(activeDir, { fs: lockFs, alive });
    if (live.length > 0) console.log(`Running: ${live.map(({ command: c, key: k, slot, startedAt }) => `${c} ${k} in slot ${slot}, ${Math.round((Date.now() - Date.parse(startedAt)) / 60000)} min`).join('; ')}`);
    // merge-gate waits for it before a merge that deploys there (C2 spec section 9).
    for (const { key: k, environment } of live.filter((lock) => lock.command === 'qa' && lock.environment)) {
      console.log(`QA in progress: qa is testing ${k} on ${environment}; merge-gate waits for it to end before a merge that deploys ${environment}`);
    }
    // The dispatcher /ao-run that runs, if any (C2 spec 5.6).
    const dispatcher = readJson(join(projectDir, ...DISPATCHER_FILE));
    if (dispatcher && alive(dispatcher.pid)) console.log(`Dispatcher: /ao-run ${dispatcher.scope} since ${dispatcher.startedAt} (process ${dispatcher.pid}), ${Number(dispatcher.spentUsd ?? 0).toFixed(2)} of ${dispatcher.budgetUsd} USD; running: ${(dispatcher.running ?? []).join(', ') || 'nothing'}`);
  }
  if (!values.go) return;
  if (!decision.go) {
    writeResult(decision);
    return;
  }

  // A release command has no work item: its runs and report go under the release (.ai/runs/v0.1.0/).
  const key = facts.item?.key ?? facts.runKey;
  mkdirSync(join(runsDir, key), { recursive: true });
  // How many commands may run at once, and this one's place among them (parallel-runs spec 5.1).
  const cap = runsAtOnce(runs.lanesMax, process.env);
  const firstRun = decision.runs?.[0] ?? {};
  const taken = await takeRunLock(activeDir, { pid: process.pid, command, arg, key, role: firstRun.role, environment: firstRun.qa?.environment, startedAt: new Date().toISOString() }, { fs: lockFs, alive, cap, sleep: (ms) => new Promise((done) => setTimeout(done, ms)), agentsPerRole: runs.agentsPerRole, lanes: runs.worktrees });
  if (!taken.ok) {
    early(taken.reason, 'item');
    return;
  }
  const lock = taken.file;
  const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
  try {
    console.log('');
    if (runs.worktrees) {
      // A lane that cannot be checked now is checked at the next command; the runs go on.
      const pruned = await keeper.prune().catch((error) => [`The lanes were not checked for closed PRs: ${error.message}`]);
      for (const note of pruned) console.log(note);
    }
    // A run in a lane starts there, told so, with the ports and services of its slot; git and the work put aside go
    // there too (parallel-runs spec 4 and 5.2). lib/workflow/lane-runs.mjs has the how.
    const placed = runPlacer({
      keeper,
      command,
      cap,
      slot: taken.slot,
      runs,
      apps: projectApps,
      // An agent waits for RAM only while another command has one running (live check of shop, 2026-11-16).
      // The second agent of a review that runs at once holds a lock of its own (C2 spec section 7).
      admitAgent: async (run) => {
        const admitted = await admitAgent(activeDir, run?.agentLock ?? lock, { fs: lockFs, alive, sleep, freeBytes: freemem, minGb: runs.minFreeRamGb, onWait: (gb) => console.log(`Waiting for RAM: ${gb} GB free, ${runs.minFreeRamGb} GB needed before another agent starts`) });
        if (!admitted.ok) throw new Error(admitted.reason);
      },
      log: (line) => console.log(line),
    });
    const gitOf = async (run) => {
      const place = await keeper.placeOf(run, command);
      return place ? gitIn(place.dir) : git;
    };
    // The heartbeat of a qa run on GitHub (C2 spec section 9): ao/qa on the commit it tests, set with your gh login, so
    // merge-gate waits for its end before a merge that would deploy over it.
    const statuses = command === 'qa' && userToken ? createGitHubClient({ repo, token: userToken, write: true }) : null;
    const qaBeat = statuses
      ? qaSignal({ post: ({ sha, state, description }) => statuses.request('POST', `/statuses/${sha}`, {}, { state, context: QA_CONTEXT, description }), log: (line) => console.log(line) })
      : (run, start) => start(run);
    // A qa run stops at once when another deploy reaches its environment during the run (spec 5.1); the runner decides
    // again, and qa tests the new version, twice at most.
    const watchQa = deploys
      ? qaWatcher({ readSha: async (environment) => (await readRunning(deploys, mapping))[environment]?.sha ?? null, kill: (pid) => killTree(pid, { spawnSync, kill: (target, signal) => process.kill(target, signal) }) })
      : (run, start) => start(run);
    // Each run of build or fix takes its dev agent on the lock first: one item at a time per agent (review of shop PR #21).
    const claim = async (run) => {
      if (!claimsRole(command) || !run.role) return;
      const claimed = await claimRole(activeDir, lock, run.role, { fs: lockFs, alive, sleep, limit: runs.agentsPerRole[run.role] ?? 1, onWait: (busy) => console.log(`Waiting for ${run.role}: it is at work on ${busy.key} (process ${busy.pid}), and builds one item at a time`) });
      if (!claimed.ok) throw new Error(claimed.reason);
      // Then its WIP on Jira, read now: a build of the role that ended may have left its item In Progress, and jira-guard
      // would refuse the Start of this one (kit followups, batch 2; SHOP-31 after SHOP-58 in Pilot 3).
      if (command === 'build' && run.purpose === 'build') {
        const { keys, limit } = await wipHolders(jira, { space, actor: run.role, contract, mapping, agentsPerRole: runs.agentsPerRole });
        const wip = jiraWipStop({ role: run.role, key: run.key, story: run.story, keys, limit });
        if (wip) throw new Error(wip);
      }
    };
    const { decision: final, facts: last } = await runGo({
      command,
      arg,
      options,
      gather,
      // qa on Development or Staging gets the basic auth from AO_ENV_AUTH, as variables, never as arguments; so does
      // devops on an ops Task you put the label ao-env-auth on (envAuth; kit followups, batch 4 item 14).
      agent: async (run, { log }) => {
        await claim(run);
        try {
          const logFile = join(runsDir, key, log);
          const logSize = () => (existsSync(logFile) ? statSync(logFile).size : 0);
          return await watchQa(await placed(run.qa?.auth || run.envAuth ? { ...run, env: { ...run.env, ...basicAuthEnv(secret('AO_ENV_AUTH')) } } : run), (ready, onStart) => qaBeat(ready, (r) => startAgent(r, logFile, onStart), logSize));
        } finally {
          // Its agent no longer holds RAM for the others that wait (admitAgent).
          if (cap > 1) await releaseAgent(activeDir, run.agentLock ?? lock, { fs: lockFs, alive, sleep });
        }
      },
      // A defect you reported is checked like a QA run: its evidence goes to the item too (human-loop spec 5.1). seo has
      // no git: its change is committed here (C1 spec 6.6).
      after: (run, { tree }) => {
        if (run.role === 'seo') return afterSeo(run, gates);
        return ['qa', 'qa-defect', 'qa-ops'].includes(run.purpose) ? afterQa(run, tree, { deploys, mapping }) : [];
      },
      act: (step) => {
        if (step.action === 'release-pr') return releasePr(step, { repo, settings });
        if (step.action === 'hotfix-ship') return hotfixShip(step, { repo, settings, userToken });
        if (step.action === 'deploy-request') return deployRequest(step, { repo, userToken });
        if (step.action === 'kit-copy-reports') return kitCopyReports(step, { repo, appEnv });
        if (step.action === 'review-waiver') return reviewWaiverNote(step, { repo, appEnv });
        if (step.action === 'pr-ready') return prReady(step, { repo, settings });
        if (step.action === 'preview-start') return preview.start(step);
        if (step.action === 'preview-stop') return preview.stop().then(({ notes }) => notes);
        if (step.action === 'qa-light-start') return qaLightStart(step, { mapping });
        if (step.action === 'qa-light-report') return qaLightReport(step, { mapping });
        if (step.action === 'findings-task') return findingsTaskAction(step, { mapping, contract, space });
        return releaseCut(step, { repo, mapping, userToken });
      },
      git: (checkout, run) => keeper.checkout(checkout, run, command),
      // The work a run left uncommitted when it stopped goes aside, and comes back when it goes on (live-run-fixes 2.1).
      wip: {
        save: async (run) => saveWip({ git: await gitOf(run), run, isProtected: (branch) => isProtected(branch, gates.protected_branches) }),
        restore: async (aside, run) => restoreWip({ git: await gitOf(run), wip: aside }),
      },
      dispatch: (action) => dispatchJiraSync(action.key),
      pack: reviewPackWriter({ github, jira }),
      worktree: { add: addWorktree, remove: removeWorktree },
      // reviewer and security at once (C2 spec section 7): the second agent takes a place of its own under the cap, as
      // <KEY>+<role>, or runs after the first when there is none.
      pair: async (run) => {
        if (cap <= 1) return null;
        const second = await takeRunLock(activeDir, { pid: process.pid, command, arg, key: `${key}+${run.role}`, startedAt: new Date().toISOString() }, { fs: lockFs, alive, cap, sleep, agentsPerRole: runs.agentsPerRole });
        if (!second.ok) console.log(`${run.role} runs after the first review: ${second.reason}`);
        return second.ok ? second.file : null;
      },
      unpair: (file) => rmSync(file, { force: true }),
      store: {
        readState: readRunState,
        writeState: (k, state) => writeFileSync(join(runsDir, k, 'state.json'), `${JSON.stringify(state, null, 2)}\n`),
        writeLast: (k, text) => writeFileSync(join(runsDir, k, 'last.md'), text),
      },
      sleep: (ms) => new Promise((done) => setTimeout(done, ms)),
      log: (line) => console.log(line),
    });
    console.log(`\n${formatDecision(final)}\nReport: .ai/runs/${key}/last.md`);
    writeResult(final);
    const home = homeBranch(command, last, gates.protected_branches);
    const now = onBranch();
    if (home && now !== home) {
      const back = prepareCheckout({ branch: home, pull: true });
      console.log(back.ok ? `The checkout is back on ${home}, so the next /ao-review or /ao-fix starts from approved code.` : `The checkout stays on ${now}: ${back.reason}. Switch it to ${home} before the next /ao-review or /ao-fix.`);
    }
  } finally {
    rmSync(lock, { force: true });
  }
}

// state.json of a run folder; a run killed with its shell gets its session from its log.
function readRunState(key) {
  const log = (name) => (existsSync(join(runsDir, key, name)) ? readFileSync(join(runsDir, key, name), 'utf8').split('\n') : []);
  return withLoggedSession(readJson(join(runsDir, key, 'state.json')), log);
}

function readJson(file) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

// A file in .ai/runs/<key>/, or null. The key is a work item or a release that checkArgument let through, and the
// name one of the kit's own.
function readRunFile(key, name) {
  try {
    return readFileSync(join(runsDir, key, name), 'utf8');
  } catch {
    return null;
  }
}

function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

// One run: ao-agent.mjs with its stream-json output appended to the log as it comes; resolves with the lines.
function startAgent(run, logFile, onStart) {
  const { command, args, env } = agentCommand(run, kitDir);
  return startAgentProcess({
    // onStart gets the pid, for a watch that may stop the run (watchQa).
    spawn: (...args) => {
      const child = spawn(...args);
      onStart?.(child.pid);
      return child;
    },
    command,
    args,
    env: { ...process.env, ...env },
    cwd: run.cwd ?? projectDir,
    append: (stream, chunk) => appendFileSync(stream === 'stdout' ? logFile : `${logFile}.stderr`, chunk),
    kill: (pid) => killTree(pid, { spawnSync, kill: (target, signal) => process.kill(target, signal) }),
  });
}

// The context pack of a review run (Pilot 1, review cost, option 2): the PR, its files and diff at its head; the Epic's
// documents and the review report template at the merge base, as approved at gate ② (review of ao-sample PR #6: a dev
// agent may change docs/ in its own PR); written to .ai/reviews/<PR>-context.md. git, github and jira are parameters,
// for tests. Any failure leaves the run without a pack: the agent then fetches what it needs itself, as before.
export function reviewPackWriter({ github, jira, git: run = git, projectDir: dir = projectDir, kitDir: kit = kitDir, save = savePack(dir), log = console.log }) {
  return async (_run, facts) => {
    const { pr, item } = facts;
    try {
      const need = (...args) => {
        const result = run(...args);
        if (result.status !== 0) throw new Error(`git ${args[0]} failed: ${(result.stderr || result.error?.message || '').trim()}`);
        return result.stdout;
      };
      // The PR by its number: its branch name is the author's, and one starting with - would read as an option.
      need('fetch', '--quiet', 'origin', `refs/heads/${pr.base}`, `refs/pull/${pr.number}/head`);
      const head = pr.headSha;
      // git merge-base exits 1 when there is none, so need throws then.
      const baseSha = need('merge-base', `origin/${pr.base}`, head).trim();
      const show = (sha, path) => {
        const shown = run('show', `${sha}:${path}`);
        return shown.status === 0 ? shown.stdout : null;
      };
      const range = `${baseSha}...${head}`;
      const files = need('diff', '--name-status', range).trim().split('\n').filter(Boolean).map((line) => {
        const [status, ...paths] = line.split('\t').map(unquotePath);
        return paths.length > 1 ? { status, from: paths[0], path: paths[1] } : { status, path: paths[0] };
      });
      const modified = filesToQuote(files).map((path) => ({ path, text: show(head, path) }));
      const epic = item.parent && /epic/i.test(item.parent.type) ? item.parent.key : null;
      const docs = epic && {
        epic,
        plan: show(baseSha, `docs/specs/${epic}/plan.md`),
        spec: show(baseSha, `docs/specs/${epic}/spec.md`),
        design: show(baseSha, `docs/specs/${epic}/design.md`),
        adrs: need('ls-tree', '--name-only', baseSha, 'docs/adr/').trim().split('\n').filter((name) => name.endsWith('.md'))
          .map((path) => ({ name: path.split('/').at(-1), text: show(baseSha, path) ?? '' })),
      };
      // The kit inside the project is one of the PR's paths, so its template is read at the base too.
      const kitPath = relative(dir, kit).replaceAll('\\', '/');
      const inside = kitPath !== '' && !kitPath.startsWith('..') && !isAbsolute(kitPath);
      const template = (inside && show(baseSha, `${kitPath}/templates/review-report.md`)) || readFileSync(join(kit, 'templates', 'review-report.md'), 'utf8');
      const runs = await github.get(`/commits/${head}/check-runs`, { per_page: 100 });
      const issue = await jira.get(`/rest/api/3/issue/${encodeURIComponent(item.key)}`, { fields: 'description' });
      const diff = run('diff', range);
      const text = buildReviewPack({
        pr: { ...pr, baseSha },
        checks: (runs.check_runs ?? []).map(({ name, status, conclusion }) => `${name}: ${conclusion ?? status}`),
        item: { ...item, parent: item.parent?.key ?? null, links: (item.blockedBy ?? []).map((key) => `is blocked by ${key}`), description: adfText(issue.fields?.description) },
        docs,
        template,
        files,
        modified,
        diff: diff.status === 0 ? diff.stdout : null,
        stat: need('diff', '--stat', range),
      });
      const name = `.ai/reviews/${pr.number}-context.md`;
      save(name, text);
      log(`context pack ${name}: ${text.length} characters`);
      return name;
    } catch (error) {
      log(`no context pack for PR #${pr.number} (${error.message}); the agent fetches what it needs itself`);
      return null;
    }
  };
}

const savePack = (dir) => (name, text) => {
  mkdirSync(join(dir, '.ai', 'reviews'), { recursive: true });
  writeFileSync(join(dir, name), text);
};

// Puts the checkout on `branch` before a run: from origin when it is there, else new from origin/<from>. A checkout with
// changes is left alone.
function prepareCheckout(spec) {
  return checkoutBranch(git, spec);
}

// The worktree of a PR for its review (Pilot 1, T10): the code at the head the review is on, never committed. It is in
// the temp folder, outside the project: Claude Code loads the instruction files (CLAUDE.md, AGENTS.md, .claude/rules) of
// a folder of the project when the agent reads a file there, and a probe of the second review of ao-sample PR #13 found
// that it loads none from a folder outside it, while agents still read, search and run commands there, and gh-guard lets
// them write in the temp folder. --add-dir is not given: with it, the skills of the folder's .claude/skills load. The
// instruction files are still removed from it, in case a later Claude Code loads more. A stale worktree from a run that
// was stopped is replaced. Node finds no node_modules there, so tests that need packages do not run in it.
// The temp folder by its long path: on Windows os.tmpdir() can give a short 8.3 path such as C:/Users/HUUTUN~1/…, where
// pnpm --filter found no app in the qa worktree (QA SHOP-68 of shop, Pilot 3). The path as it is when it cannot be read.
export function longTmpDir(realpath = realpathSync.native, tmp = tmpdir()) {
  try {
    return realpath(tmp);
  } catch {
    return tmp;
  }
}
export const reviewTreePath = (project, name, tmp = longTmpDir()) => join(tmp, 'ao-reviews', `${basename(resolve(project))}-${name}`);
function addWorktree({ name, sha, install = false, keepInstructions = false }) {
  const path = reviewTreePath(projectDir, name);
  if (existsSync(path)) {
    const removed = removeWorktree({ name });
    if (!removed.ok) return { ok: false, reason: `the worktree of ${name} from an earlier run is still at ${path}: ${removed.reason}` };
  }
  mkdirSync(join(path, '..'), { recursive: true });
  const added = git('worktree', 'add', '--detach', '--quiet', path, sha);
  if (added.status !== 0) return { ok: false, reason: `git could not add the worktree of ${name} at ${sha.slice(0, 7)}: ${(added.stderr || added.stdout).trim()}` };
  try {
    if (!keepInstructions) removeInstructions(path, { readdirSync, rmSync });
  } catch (error) {
    removeWorktree({ name });
    return { ok: false, reason: `the instruction files of the PR could not be removed from its worktree: ${error.message}` };
  }
  // qa runs the E2E there (release-workflow spec 2.5): the packages of that commit, without their install scripts, and
  // without your secrets in their environment.
  if (install) {
    const env = { ...process.env };
    for (const name of CLEARED_ENV) delete env[name];
    // npm or pnpm, by the lockfile of that commit (project-scaffold part 2, spec 2.1).
    const manager = managerFromLockfile((file) => existsSync(join(path, file))) ?? 'npm';
    const installed = runManager(manager, installArgs(manager, { ignoreScripts: true }), { cwd: path, env, encoding: 'utf8' });
    if (installed.status !== 0) {
      removeWorktree({ name });
      return { ok: false, reason: `${manager === 'npm' ? 'npm ci' : 'pnpm install'} failed in the worktree of ${name} at ${sha.slice(0, 7)}: ${(installed.stderr || installed.error?.message || '').trim().slice(-500)}` };
    }
    // The .env of each app (runs.copy of project.yaml), as a lane gets them: the @local tests start the apps there.
    const projectYaml = join(projectDir, '.ai-orchestrator', 'project.yaml');
    const { copy } = runsSettings(existsSync(projectYaml) ? parse(readFileSync(projectYaml, 'utf8')) : {});
    copyRunFiles({ existsSync, mkdirSync, copyFileSync }, projectDir, path, copy);
  }
  return { ok: true, path: path.replaceAll('\\', '/') };
}

// Whether the rendered files of a kit copy are what their sources give (kit-copy-review spec 2.3). The renderer is the
// one of this kit, never the PR's, and its sources were compared with the reviewed head before this runs. The tree keeps
// its instruction files, which render-agents reads, because no agent runs in it.
function renderCheck(number, sha, paths) {
  const name = `kit-copy-${number}`;
  return renderedReason({
    sha,
    paths,
    tree: {
      add: () => {
        const fetched = git('fetch', '--quiet', 'origin', `refs/pull/${number}/head`);
        return fetched.status === 0 ? addWorktree({ name, sha, keepInstructions: true }) : { ok: false, reason: `git fetch failed: ${fetched.stderr.trim()}` };
      },
      remove: () => removeWorktree({ name }),
    },
    render: (path) => {
      const env = { ...process.env };
      for (const secretName of CLEARED_ENV) delete env[secretName];
      const run = (flag) => spawnSync(process.execPath, [join(kitDir, 'scripts', 'render-agents.mjs'), flag, '--project', path], { env, encoding: 'utf8' });
      const checked = run('--check');
      const listed = run('--list');
      if (listed.status !== 0) return { status: listed.status, text: listed.stderr ?? '', files: [] };
      return { status: checked.status, text: `${checked.stdout ?? ''}${checked.stderr ?? ''}`, files: listed.stdout.split('\n').map((line) => line.trim()).filter(Boolean) };
    },
  });
}

// The reports of a kit copy, with the ao-review App, on the head that was compared (kit-copy-review spec 2.4).
async function kitCopyReports(step, { repo, appEnv }) {
  const { token } = await installationToken({ ...appCredentials('review', { env: appEnv }), repo, permissions: { pull_requests: 'write' } });
  return postKitCopyReports({ github: createGitHubClient({ repo, token, write: true }), step });
}

// /ao-review of a PR whose review is waived by rule (C1 spec 3.4): the trace on its head, a COMMENT review of the review
// App, in place of the reports. merge-gate and audit work the rule out again; they never take this review on trust.
async function reviewWaiverNote({ key, number, sha, waiver, level, files }, { repo, appEnv }) {
  const { token } = await installationToken({ ...appCredentials('review', { env: appEnv }), repo, permissions: { pull_requests: 'write' } });
  const github = createGitHubClient({ repo, token, write: true });
  await github.request('POST', `/pulls/${number}/reviews`, {}, { commit_id: sha, event: 'COMMENT', body: waiverBody({ id: waiver, level, files, key, sha }) });
  return [`Posted the waiver ${waiver} on the head ${sha.slice(0, 7)} of PR #${number}: no review runs.`];
}

// The first step of /ao-review on a draft PR (human-loop spec 4.6): marks it ready as the ao-dev App, which opened it.
async function prReady({ number }, { repo, settings }) {
  const slug = setting('AO_DEV_APP', settings);
  const devEnv = { ...process.env, AO_DEV_APP: slug, AO_DEV_APP_ID: setting('AO_DEV_APP_ID', settings) };
  const { token } = await installationToken({ ...appCredentials('dev', { env: devEnv }), repo, permissions: READY_PERMISSIONS });
  const marked = await markReadyForReview({ token, repo, number });
  return [marked ? `Marked PR #${number} ready for review as ${slug}[bot]; jira-sync moves its item to In Review once CI is green.` : `PR #${number} was ready already.`];
}

// The first-parent history of develop on GitHub after the tag `tag`, oldest first, as parseHistory reads it
// (release-workflow spec 2.6). The tag comes from GitHub and has the form vX.Y.Z (latestTag), so it is no option.
function developHistory(tag) {
  const fetched = git('fetch', '--quiet', '--tags', 'origin', 'develop');
  if (fetched.status !== 0) throw new Error(`git fetch failed: ${(fetched.stderr || '').trim()}`);
  const shown = git('log', '--first-parent', '--reverse', '--format=%H%x09%s', tag ? `${tag}..origin/develop` : 'origin/develop');
  if (shown.status !== 0) throw new Error(`git log failed: ${(shown.stderr || '').trim()}`);
  return shown.stdout;
}

// /ao-release <vX.Y.0> <sha>, its one step (release-workflow spec 2.6): the Fix Versions and comments on Jira with the CI
// token, a user variable of your Windows account, which an agent running as you can read past gh-guard: a risk you accept
// until the CI token leaves the machine (reviews of shop PR #21),
// then the release branch with your gh login (Pilot 3, spec 2.9). The branch comes
// last: once it is there the command stops at "release branch open", so a step cut short before it can be run again.
async function releaseCut({ version, nextVersion, sha, included, after, cancelled = [] }, { repo, mapping, userToken }) {
  const notes = [];
  const ciToken = secret('JIRA_CI_TOKEN');
  if (!ciToken) throw new Error('JIRA_CI_TOKEN is not set in your session');
  const jira = createJiraClient({ cloudId: mapping.cloud_id, authorization: bearerAuth(ciToken), write: true });
  const changes = releaseCutChanges({ version, nextVersion, sha, approvedAt: new Date().toISOString(), included, after, cancelled });
  for (const { key, names } of changes.fixVersions) await jira.editItem(key, { fields: { fixVersions: names.map((name) => ({ name })) } });
  for (const { key, text } of changes.comments) await jira.comment(key, text);
  notes.push(`Fix Version ${version} on ${included.map(({ key }) => key).join(', ')}.`);
  const moved = changes.fixVersions.filter(({ key }) => !included.some((item) => item.key === key)).map(({ key }) => key);
  if (moved.length > 0) notes.push(`Moved to ${nextVersion}: ${moved.join(', ')}.`);
  if (cancelled.length > 0) notes.push(`Cancelled, code in ${version}, commented: ${cancelled.map(({ key }) => key).join(', ')}.`);
  // Only you make a release branch (Pilot 3, spec 2.9, review round 2 of shop PR #13): the ruleset ao-release-branches
  // lets only an admin create release/*, so an agent holding ao-dev cannot cut one at a commit nobody reviewed.
  await yours(repo, userToken).request('POST', '/git/refs', undefined, { ref: `refs/heads/release/${version}`, sha });
  notes.push(`Created release/${version} at ${sha.slice(0, 8)} with your gh login.`);
  return notes;
}

// A file of a branch on GitHub, or null when it has none.
async function contentOf(github, path, branch) {
  try {
    const { content } = await github.get(`/contents/${path}`, { ref: branch });
    return Buffer.from(content, 'base64').toString('utf8');
  } catch (error) {
    if (error.status === 404) return null;
    throw error;
  }
}

// /ao-ship vX.Y.0, its last step (release-workflow spec 2.7, steps 4 and 5; Pilot 3, spec 2.9): as the ao-dev App, one
// commit with the regression report as docs/releases/<version>.md and the section of the release in CHANGELOG.md, on
// release-notes/<version> cut from the release branch, and its PR into the release branch, which merge-gate merges with
// ao-merge: the rulesets let no App push to release/* any more. A PR of the report that is open already must hold what
// this step wrote: else its branch is made again (review round 2 of shop PR #13: an agent holding ao-dev could open one
// first). Once it is merged, the release branch must hold the report and the changelog this step wrote, and have
// changed nothing else since the regression; then the release PR into main. It waits up to 15 minutes for merge-gate,
// then stops with what it waits for; run again, it commits nothing new and opens no second PR.
async function releasePr({ version, branch, regression }, { repo, settings }) {
  const [report, section, body] = ['regression-report.md', 'changelog.md', 'pr-description.md'].map((name) => readRunFile(version, name));
  if (!report || !section || !body) throw new Error(`.ai/runs/${version}/ lacks the regression report or the notes of devops`);
  const slug = setting('AO_DEV_APP', settings);
  const devEnv = { ...process.env, AO_DEV_APP: slug, AO_DEV_APP_ID: setting('AO_DEV_APP_ID', settings) };
  const { token } = await installationToken({ ...appCredentials('dev', { env: devEnv }), repo, permissions: { contents: 'write', pull_requests: 'write' } });
  const github = createGitHubClient({ repo, token, write: true });
  const bot = await botIdentity({ slug, token });
  const notes = [];
  const reportPath = `docs/releases/${version}.md`;
  const current = await contentOf(github, 'CHANGELOG.md', branch);
  const changelog = changelogWith(current, section, version);
  // Whether a branch holds exactly the report and the changelog this step wrote.
  const holds = async (ref) => (await contentOf(github, reportPath, ref)) === report && (await contentOf(github, 'CHANGELOG.md', ref)) === changelog;
  if (changelog !== current || report !== (await contentOf(github, reportPath, branch))) {
    const want = notesPullRequest(version);
    // One commit of the report on the release branch's head, on the branch of the report alone, made again when needed.
    const commitNotes = async () => {
      const head = (await github.get(`/git/ref/heads/${branch}`)).object.sha;
      const { tree } = await github.get(`/git/commits/${head}`);
      const files = [{ path: reportPath, content: report }, { path: 'CHANGELOG.md', content: changelog }].map((file) => ({ ...file, mode: '100644', type: 'blob' }));
      const made = await github.request('POST', '/git/trees', undefined, { base_tree: tree.sha, tree: files });
      const signed = { ...bot, date: new Date().toISOString() };
      const commit = await github.request('POST', '/git/commits', undefined, { message: `docs(release): add the regression report and the changelog of ${version}`, tree: made.sha, parents: [head], author: signed, committer: signed });
      try {
        await github.request('POST', '/git/refs', undefined, { ref: `refs/heads/${want.head}`, sha: commit.sha });
      } catch (error) {
        if (error.status !== 422) throw error;
        await github.request('PATCH', `/git/refs/heads/${want.head}`, undefined, { sha: commit.sha, force: true });
      }
      return commit.sha;
    };
    // merge-gate merges it only as one commit on the head of the release branch (review round 3 of shop PR #13).
    const onHead = async () => onReleaseHead(await github.get(`/git/commits/${(await github.get(`/git/ref/heads/${want.head}`)).object.sha}`), (await github.get(`/git/ref/heads/${branch}`)).object.sha);
    let pr = (await github.getAll('/pulls', { state: 'open', base: branch })).find((open) => open.head.ref === want.head);
    if (pr && (await holds(want.head)) && (await onHead())) notes.push(`PR #${pr.number} of the release report into ${branch} is open already, with the report and the changelog of this run.`);
    else if (pr) {
      const sha = await commitNotes();
      notes.push(`PR #${pr.number} of the release report into ${branch} held another report or changelog, or no longer sat on the head of ${branch}: ${want.head} is made again from ${branch} as ${bot.name} (${sha.slice(0, 8)}).`);
    } else {
      const sha = await commitNotes();
      pr = await github.request('POST', '/pulls', undefined, { title: want.title, head: want.head, base: branch, body: want.body });
      notes.push(`Committed ${reportPath} and CHANGELOG.md on ${want.head} as ${bot.name} (${sha.slice(0, 8)}), and opened PR #${pr.number} into ${branch}.`);
    }
    const outcome = await waitForMerge(() => github.get(`/pulls/${pr.number}`));
    if (outcome === 'closed') {
      notes.push(`PR #${pr.number} of the release report was closed without a merge: read why on GitHub, then run /ao-ship ${version} again, which opens it again.`);
      return notes;
    }
    if (outcome === 'waiting') {
      notes.push(`merge-gate has not merged PR #${pr.number} of the release report after 15 minutes: see its CI and the merge-gate runs on GitHub, then run /ao-ship ${version} again once it is merged.`);
      return notes;
    }
    notes.push(`merge-gate merged PR #${pr.number} of the release report into ${branch}.`);
    if (!(await holds(branch))) throw new Error(`${branch} does not hold the report and the changelog of this run after PR #${pr.number}: read that PR and the release branch on GitHub, then run /ao-ship ${version} again`);
  }
  const allowed = [reportPath, 'CHANGELOG.md'];
  const beyond = touchedPaths((await github.get(`/compare/${regression}...${branch}`)).files ?? []).filter((file) => !allowed.includes(file));
  if (beyond.length > 0) throw new Error(`${branch} changed ${beyond.join(', ')} since the regression on ${regression.slice(0, 8)}: run /ao-ship ${version} again, and the regression runs again`);
  const open = (await github.getAll('/pulls', { state: 'open', base: 'main' })).find((pr) => pr.head.ref === branch);
  // The notes may have been written again (T21): the description follows them.
  if (open) {
    if (open.body !== body) await github.request('PATCH', `/pulls/${open.number}`, undefined, { body });
    notes.push(`PR #${open.number} of ${branch} into main is open already${open.body !== body ? '; its description now holds the new notes' : ''}.`);
  }
  else {
    const pr = await github.request('POST', '/pulls', undefined, { title: `release: ${version}`, head: branch, base: 'main', body });
    notes.push(`Opened PR #${pr.number} of ${branch} into main.`);
  }
  return notes;
}

// A writing client of your gh login: GitHub records you as the creator of what it makes (gate ⑤, spec 2.4).
function yours(repo, userToken) {
  if (!userToken) throw new Error('log in with gh auth login: this step runs with your gh login');
  return createGitHubClient({ repo, token: userToken, write: true });
}

// /ao-rollback, its one step (release-workflow spec 2.9): the deployment request, with your gh login.
async function deployRequest({ environment, sha, rollback }, { repo, userToken }) {
  const id = await requestDeploy(yours(repo, userToken), { sha, environment, rollback });
  return [`Deployment request #${id} for ${sha.slice(0, 8)} on ${environment}${rollback ? ', a rollback' : ''}, made with your gh login. The deployer takes it within a minute or two.`];
}

// /ao-ship of a hotfix, its one step (release-workflow spec 2.8, steps 6 and 7): with your gh login the tag and the
// deployment request for Production; as the ao-dev App the PRs that merge main back, unless one is open already.
async function hotfixShip({ version, sha, backMerges }, { repo, settings, userToken }) {
  const github = yours(repo, userToken);
  const notes = [];
  try {
    await github.request('POST', '/git/refs', undefined, { ref: `refs/tags/${version}`, sha });
    notes.push(`Tagged ${version} at ${sha.slice(0, 8)} with your gh login.`);
  } catch (error) {
    if (error.status !== 422) throw error;
    notes.push(`The tag ${version} is there already.`);
  }
  const id = await requestDeploy(github, { sha, environment: 'production', rollback: false });
  notes.push(`Deployment request #${id} for ${version} on Production, made with your gh login (gate ⑤).`);
  const devEnv = { ...process.env, AO_DEV_APP: setting('AO_DEV_APP', settings), AO_DEV_APP_ID: setting('AO_DEV_APP_ID', settings) };
  const { token } = await installationToken({ ...appCredentials('dev', { env: devEnv }), repo, permissions: { pull_requests: 'write', contents: 'read' } });
  const dev = createGitHubClient({ repo, token, write: true });
  for (const base of backMerges) {
    const open = (await dev.getAll('/pulls', { state: 'open', base })).find((pr) => pr.head.ref === 'main');
    if (open) {
      notes.push(`The merge of main back into ${base} is open already: PR #${open.number}.`);
      continue;
    }
    const pr = await dev.request('POST', '/pulls', undefined, { title: `Merge main into ${base} after ${version}`, head: 'main', base, body: `merge-gate merges main back into ${base} with a merge commit once CI is green and there is no conflict (release-workflow spec 2.8).` });
    notes.push(`Opened PR #${pr.number}: main into ${base}.`);
  }
  return notes;
}

// The files under a folder, with forward slashes and the time each was last written; [] when there is none.
function listFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath ?? entry.path, entry.name))
    .map((path) => ({ path: path.replaceAll('\\', '/'), mtimeMs: statSync(path).mtimeMs }));
}

// The Jira client of the CI token: a user variable of your Windows account, which an agent running as you can read past
// gh-guard, a risk you accept until the CI token leaves the machine (reviews of shop PR #21).
function ciJira(mapping) {
  const ciToken = secret('JIRA_CI_TOKEN');
  if (!ciToken) throw new Error('JIRA_CI_TOKEN is not set in your session');
  return createJiraClient({ cloudId: mapping.cloud_id, authorization: bearerAuth(ciToken), write: true });
}

// The Jira name of a contract transition of the work items, from tracker/jira.yaml.
const transitionName = (mapping, id) => Object.values(mapping.workflows).map(({ transitions = {} }) => transitions[id]?.name).find(Boolean) ?? id;

// /ao-qa of an item of level light (C1 spec section 2): the main session checks it in place of a qa run. The item moves
// and the report goes up with the CI token, as contract/workflows.yaml lets automation pick up and fail an item.
async function qaLightStart({ key }, { mapping }) {
  await ciJira(mapping).transition(key, transitionName(mapping, 'pick-up'));
  return [`${key} is In QA, picked up with the CI token: level light, no qa run.`];
}

async function qaLightReport({ key, result, body }, { mapping }) {
  const jira = ciJira(mapping);
  await jira.request('POST', `/rest/api/3/issue/${encodeURIComponent(key)}/comment`, {}, { body: markdownToAdf(body) });
  const notes = [`Posted the ${result} report of the main session on ${key}, with the CI token.`];
  if (result === 'FAIL') {
    await jira.transition(key, transitionName(mapping, 'qa-fail'));
    notes.push(`${key}: QA fail, back to In Progress.`);
  }
  return notes;
}

// The Medium and Low a review left on a merged PR, to the findings Task of its Epic (C1 spec section 2), with the CI
// token: the Task made at the first of them, labelled, a child of the Epic that blocks it, then one comment per PR.
// It searches again before it makes or comments, so a second run adds nothing.
async function findingsTaskAction({ key, epic, task, pr, findings }, { mapping, contract, space }) {
  const jira = ciJira(mapping);
  const label = mapping.work_labels.findings;
  const notes = [];
  let found = task ?? (await jira.searchAll(`project = "${space}" AND parent = "${epic}" AND labels = "${label}" ORDER BY created ASC`, ['summary']))[0]?.key ?? null;
  if (!found) {
    const { summary, description } = findingsTask({ epic });
    const typeName = contract.work_types.find(({ id }) => id === 'task').jira_issue_type;
    ({ key: found } = await jira.request('POST', '/rest/api/3/issue', {}, { fields: { project: { key: space }, issuetype: { name: typeName }, summary, description: markdownToAdf(description), labels: [label], parent: { key: epic } } }));
    // The item that comes first is the inward one, as ba links them (agents/prompts/ba.md): the Epic waits for it.
    await jira.request('POST', '/rest/api/3/issueLink', {}, { type: { name: 'Blocks' }, inwardIssue: { key: found }, outwardIssue: { key: epic } });
    notes.push(`Made ${found}, the findings Task of ${epic}: label ${label}, it blocks ${epic}.`);
  }
  const comments = await jira.getAll(`/rest/api/3/issue/${encodeURIComponent(found)}/comment`, {}, 'comments');
  if (comments.some(({ body }) => adfText(body).includes(recordedLine(pr)))) return [...notes, `${found} names PR #${pr} already.`];
  await jira.request('POST', `/rest/api/3/issue/${encodeURIComponent(found)}/comment`, {}, { body: markdownToAdf(findingsComment({ key, pr, findings })) });
  return [...notes, `Added the ${findings.length} Medium and Low finding${findings.length === 1 ? '' : 's'} of PR #${pr} to ${found}.`];
}

// After a qa run, before its worktree goes: the evidence to the item with the CI token, which only this session holds,
// and whether the environment still runs the release qa tested (release-workflow spec 2.5).
// C1 spec 6.6: seo has no git, so ao-step commits what it changed under docs/specs/, in the project folder where the
// runs of an Epic and of /ao-request work, with your git; and pushes it when its branch is on GitHub already, as for an
// open docs PR. A new docs branch goes up with the docs PR ba opens. Resolves the notes of the run, or { notes, stop }.
function afterSeo(run, gates) {
  const branch = git('branch', '--show-current').stdout.trim();
  const change = seoChange({ status: git('status', '--porcelain=v1', '-z', '--untracked-files=all').stdout, branch, key: run.key, docsEpic: epicOfDocsBranch(gates, branch) });
  if (!change) return [];
  if (change.stop) return { notes: [], stop: change.stop };
  const last = (result) => `${result.stderr || result.stdout}`.trim().split('\n').at(-1);
  const added = git('add', '--', ...change.paths);
  if (added.status !== 0) return { notes: [], stop: `ao-step could not stage the change of seo on ${branch}: ${last(added)}` };
  const committed = git('commit', '--quiet', '-m', change.message);
  if (committed.status !== 0) return { notes: [], stop: `ao-step could not commit the change of seo on ${branch}: ${last(committed)}` };
  const notes = [`ao-step committed the change of seo on ${branch}: ${change.paths.join(', ')}`];
  if (git('rev-parse', '--verify', '--quiet', `refs/remotes/origin/${branch}`).status !== 0) return notes;
  const pushed = git('push', '--quiet', 'origin', branch);
  if (pushed.status !== 0) return { notes, stop: `ao-step committed the change of seo on ${branch} but could not push it: ${last(pushed)}. Push it yourself, then run the command again` };
  return [...notes, `ao-step pushed it to origin/${branch}`];
}

function afterQa(run, tree, { deploys, mapping }) {
  const ciToken = secret('JIRA_CI_TOKEN');
  const jira = ciToken ? createJiraClient({ cloudId: mapping.cloud_id, authorization: bearerAuth(ciToken), write: true }) : null;
  return qaFollowUp({
    run,
    tree,
    projectDir,
    list: listFiles,
    attach: (key, paths) => {
      if (!jira) throw new Error('JIRA_CI_TOKEN is not set in your session');
      return attachEvidence({ jira, key, files: paths });
    },
    // .ai/ is ignored by git, so the traces never reach a commit. Each keeps the name of its test folder.
    keep: async (key, paths) => {
      const folder = join(runsDir, key, 'traces');
      mkdirSync(folder, { recursive: true });
      for (const path of paths) copyFileSync(path, join(folder, `${basename(dirname(path))}-${basename(path)}`));
      return relative(projectDir, folder).replaceAll('\\', '/');
    },
    running: async (environment) => (await readRunning(deploys, mapping))[environment]?.sha ?? null,
  });
}

// Takes the worktree away with what the agent left in it. What still runs from it stops first: in QA SHOP-28 of shop,
// next dev, vite, Maven and Playwright held its files after a deploy stopped qa, and the next QA could not make it
// again. Then its node_modules go, without following a link, and git removes the rest.
function removeWorktree({ name }) {
  const path = reviewTreePath(projectDir, name);
  if (!existsSync(path)) {
    git('worktree', 'prune');
    return { ok: true };
  }
  const stopped = stopProcessesUnder(path, { spawnSync, kill: (target, signal) => process.kill(target, signal) });
  const still = (reason) => ({ ok: false, reason: `${reason}${stopped.length > 0 ? ` (stopped ${stopped.length} processes that ran from it first)` : ''}` });
  try {
    removeNodeModules({ readdirSync, rmSync }, path);
    git('worktree', 'remove', '--force', path);
    if (existsSync(path)) rmSync(path, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
  } catch (error) {
    git('worktree', 'prune');
    return still(error.message);
  }
  git('worktree', 'prune');
  return existsSync(path) ? still(`${path} is still there`) : { ok: true };
}

// /ao-run <EPIC> | <KEY> <KEY>… (C2 spec section 5): the dispatcher. Without --go it prints one round: what it would
// start now and what waits. With --go it runs until the scope is done or waits for you idle_hours, or until the budget,
// the usage limit or /ao-run --stop ends it once its commands have ended.
const END = {
  done: (scope) => `every item of ${scope} is done, or waits only for Complete`,
  idle: (scope, { idleHours }) => `nothing of ${scope} could start for ${idleHours} hours`,
  budget: (scope, { budget, spent }) => `the runs it started cost ${spent.toFixed(2)} USD, and its budget is ${budget} USD`,
  usage: () => 'an agent hit the usage limit: run /ao-run again after it resets',
  stop: () => '/ao-run --stop asked it to end',
};

async function runCommand(keys, values) {
  const settings = projectSettings(projectDir);
  const space = setting('AO_JIRA_SPACE', settings);
  const effects = dispatcherEffects({ kitDir, projectDir, spawn, fs: { existsSync, mkdirSync, openSync, closeSync, readFileSync, writeFileSync, appendFileSync, rmSync }, alive });
  const other = ['answers', 'note', 'change', 'light-report', 'result'].find((name) => values[name] !== undefined) ?? ['retest', 'full', 'seo-ok', 'json'].find((name) => values[name]);
  if (other) return console.log(`STOP: --${other} does not go with /ao-run`);
  if (values.stop) {
    if (keys.length > 0 || values.go) return console.log('STOP: /ao-run --stop takes no key and no --go');
    const held = effects.running();
    if (!held) return console.log('STOP: no /ao-run runs in this project');
    effects.askStop();
    return console.log(`/ao-run ${held.scope} (process ${held.pid}) starts no command more; the ones that run go on to their end, then it ends`);
  }
  if (keys.length === 0) return console.log(`STOP: /ao-run takes an Epic, or the items to run, such as ${space ?? 'DEMO'}-12`);
  const bad = keys.find((key) => !/^[A-Z][A-Z0-9]*-\d{1,7}$/.test(key) || (space && !key.startsWith(`${space}-`)));
  if (bad) return console.log(`STOP: ${bad} is not a Jira key of the space ${space}`);
  const projectYaml = join(projectDir, '.ai-orchestrator', 'project.yaml');
  const runs = runsSettings(existsSync(projectYaml) ? parse(readFileSync(projectYaml, 'utf8')) : {});
  const budget = values.budget === undefined ? runs.budgetUsd : Number(values.budget);
  if (!(budget > 0) || budget > 1000) return console.log(`STOP: --budget is ${values.budget}: a number of USD above 0, at most 1000`);
  const cap = runsAtOnce(runs.lanesMax, process.env);
  const readLocks = () => liveLocks(activeDir, { fs: lockFs, alive });
  const board = await effects.readBoard();
  // One key of an Epic is the Epic and its items; any other key, or several, are those items.
  const scope = keys.length === 1 && board.items.find(({ key }) => key === keys[0])?.workType === 'epic' ? { epic: keys[0] } : { keys };
  const label = scope.epic ?? keys.join(' ');

  if (!values.go) {
    const round = await planRound({ ...board, scope, live: readLocks(), cap, decide: effects.decide, agentsPerRole: runs.agentsPerRole });
    console.log(`/ao-run ${label}, ${cap} at once, budget ${budget} USD`);
    console.log(round.done ? `Every item of ${label} is done, or waits only for Complete` : `Would start now: ${round.start.map(({ command, arg }) => `/ao-${command} ${arg}`).join(', ') || 'nothing'}`);
    const yours = round.waiting.filter(({ waits }) => waits === 'you');
    const others = round.waiting.filter(({ waits }) => waits !== 'you');
    if (yours.length > 0) console.log(['Waiting for you:', ...yours.map(({ key, text }) => `  ${key}: ${text}`)].join('\n'));
    if (others.length > 0) console.log(['Waiting:', ...others.map(({ key, waits, text }) => `  ${key} (${waits}): ${text}`)].join('\n'));
    if (!round.done) console.log(`Next: /ao-run ${keys.join(' ')} --go`);
    return;
  }

  const since = Date.now();
  const record = { pid: process.pid, scope: label, startedAt: new Date(since).toISOString(), budgetUsd: budget, spentUsd: 0, running: [] };
  const locked = effects.lock(record);
  if (!locked.ok) return console.log(`STOP: ${locked.reason}`);
  // The items of the scope as it grows (the plan adds them), for what their runs cost.
  const seen = new Set(scopeOf(board.items, scope).map(({ key }) => key));
  const readBoard = async () => {
    const now = await effects.readBoard();
    for (const { key } of scopeOf(now.items, scope)) seen.add(key);
    return now;
  };
  const spent = () => spentSince([...seen], since, effects.readState);
  try {
    effects.log(`/ao-run ${label}: ${cap} at once, budget ${budget} USD, ends after ${runs.idleHours} hours with nothing to start`);
    const end = await runDispatcher({
      scope,
      cap,
      agentsPerRole: runs.agentsPerRole,
      budgetUsd: budget,
      idleMs: runs.idleHours * 3600 * 1000,
      readBoard,
      readLocks,
      decide: effects.decide,
      start: effects.start,
      spent,
      stopAsked: effects.stopAsked,
      now: Date.now,
      sleep: (ms) => new Promise((done) => setTimeout(done, ms)),
      log: effects.log,
      report: ({ running, spent: cost }) => effects.update({ ...record, spentUsd: cost, running }),
    });
    effects.log(`/ao-run ${label} ends: ${END[end.reason](label, { idleHours: runs.idleHours, budget, spent: spent() })}. Spent ${spent().toFixed(2)} USD`);
    if (end.waiting.length > 0) console.log(['Waiting for you:', ...end.waiting.map((line) => `  ${line}`)].join('\n'));
  } finally {
    effects.unlock();
  }
}

// The second /ao-plan: jira-sync for the Epic, with your gh login, since this is your session, not an agent's.
function dispatchJiraSync(key) {
  const result = spawnSync('gh', ['workflow', 'run', 'jira-sync.yml', '-f', `item=${key}`], { cwd: projectDir, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`gh workflow run jira-sync.yml failed: ${(result.stderr || result.stdout).trim()}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(`ao-step: ${error.message}`);
    process.exit(1);
  });
}
