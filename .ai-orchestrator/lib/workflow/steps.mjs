// decideStep (dev-workflow spec 2.1, 2.2): from the facts of one command (lib/workflow/facts.mjs), GO with the runs to
// make, or STOP with the reason and the command to run instead. ao-step.mjs prints it; with --go its runner makes the
// first run, gathers the facts again and decides again, so the list after the first run is a forecast. Pure.
//
//   { go: true, runs, lines }                          runs: [{ role, key, effort, purpose, prompt, resume?, checkout? }]
//                                                      or [{ action: 'jira-sync', key }] for the second /ao-plan
//   { go: false, reason, next, lines, questions? }      questions: what an agent asked, for you to answer in the chat
//   { status: true, lines, next }                      /ao-status, which runs nothing
//
// options: { roster, contract, gates, mapping?, answers?, note? }. answers is your reply to the questions of the last run; note is what
// you wrote after the PR number of /ao-fix.
import { createHash } from 'node:crypto';
import { matchesGlob } from '../quality/glob.mjs';
import { lockfileOf } from '../quality/package-manager.mjs';
import { nextMinor } from '../release/release-cut.mjs';
import { parseVersion } from '../release/versions.mjs';
import { checkBranch, parseBranch } from '../tracker/conventions.mjs';
import { qaReportResult } from '../tracker/facts.mjs';
import { splitNote } from './notes.mjs';
import { PROJECT_FILE } from '../scaffold/project-config.mjs';
import { PREVIEW_SAMPLE, steeringReason, steersPreview } from './preview.mjs';
import { appUrls } from './qa.mjs';
import { SCREENS, SEO_OFF, pendingRuns, seoScreens, seoWord, stageRoles, stageRuns } from './conditions.mjs';
import { seoSection, seoTextProblems } from './seo-check.mjs';
import { WEB_ROLES } from '../rules/references.mjs';
import { answersPrompt, promptFor, resumePrompt, seoNote } from './prompts.mjs';
import { openQuestions } from './runs.mjs';
import { fullReviewEffort, reviewScope } from './security-scope.mjs';
import { deltaEffort } from '../quality/review-tiers.mjs';
import { waiverFor } from '../quality/waivers.mjs';
import { planLibraries } from '../quality/dependencies.mjs';
import { findingsStep } from './findings.mjs';
import { effectiveLevel } from './levels.mjs';

const ASKING = ['ba', 'ux', 'sa'];
// The roles /ao-request runs on a "Cần <role>:" comment (human-loop spec 3.3): those of stage spec and plan, security
// on a library dep-check found suspicious (C1 spec section 5), and seo on the SEO part of an item (C1 spec 6.6). The dev
// roles and qa have their own commands.
export const ADVISERS = [...ASKING, 'security', 'seo'];
// A request /ao-request runs: to an adviser, and not written by a role that reads web pages, whose request would run a
// role with Bash on what a page wrote (review of shop PR #80). A hook refuses such a comment; one that reaches Jira
// anyway waits for you.
export const runnableRequest = ({ to, from }) => ADVISERS.includes(to) && !WEB_ROLES.includes(from);
const webRequest = ({ to, from }) => ADVISERS.includes(to) && WEB_ROLES.includes(from);
// The roles whose open questions you answer: seo's too, so its questions never go to ba or sa, which have Bash.
const ANSWERING = [...ASKING, 'seo'];
// A run that stopped before its end goes on in its session; one that failed counts towards the retry limit.
const STOPPED = ['unfinished', 'usage-limit'];
const FAILED = ['error', 'max-turns'];
// The purposes of the review runs, each on the head of a PR in a worktree.
const REVIEWS = ['review', 'review-delta'];
// The order of the dev agents of a Story, from stage build of contract/stages.yaml (C1 spec section 6).
const devOrder = ({ contract }) => stageRoles(contract, 'build');

export function decideStep(command, facts, options) {
  const decide = DECIDERS[command];
  if (!decide) throw new Error(`unknown command ${command}; use one of ${Object.keys(DECIDERS).join(', ')}`);
  return withSeo(decide(facts, options), facts, options);
}

// An item with the label ao-seo has an SEO part (C1 spec 6.6): the runs that build, review and QA it are pointed to it,
// by the kind of their purpose and role. An item without the label leaves them as they are: they skip the SEO part.
const SEO_KINDS = [
  { purposes: ['build', 'fix'], roles: ['fe-dev', 'be-dev'], kind: 'dev' },
  { purposes: ['review', 'review-delta'], roles: ['reviewer'], kind: 'reviewer' },
  { purposes: ['qa', 'qa-defect'], roles: ['qa'], kind: 'qa' },
];
function withSeo(decision, facts, options) {
  const { contract } = options;
  const { item } = facts;
  if (!decision?.go || !item?.seo || !Array.isArray(decision.runs)) return decision;
  const epicType = contract.work_types.find(({ id }) => id === 'epic').jira_issue_type;
  const epic = facts.epic?.key ?? (item.parent?.type === epicType ? item.parent.key : null);
  const kindOf = (run) => SEO_KINDS.find(({ purposes, roles }) => purposes.includes(run.purpose) && roles.includes(run.role))?.kind;
  // Outside an Epic, every run that builds, reviews or tests the comment of seo needs the one you approved with seo-ok,
  // not only the first build: one seo wrote or changed since waits for you again (reviews of shop PR #80 and #81). The
  // prompt names the comment only then, as the one you approved.
  const outside = !epic && seoOutsideEpic(item, options);
  if (outside && decision.runs.some((run) => kindOf(run))) {
    const held = seoApprovalStop(facts, options);
    if (held) return { ...held, lines: decision.lines ?? [] };
  }
  // The prompt carries the words of the comment you approved, as ao-step read them when it compared the marks: an agent
  // that read the comment on Jira during its run could read one seo changed since (second review of shop PR #81).
  const comment = outside && item.seoMark?.id ? { id: item.seoMark.id, hash: item.seoMark.hash, text: item.seoComment ?? '' } : null;
  if (comment && comment.text.length > SEO_TEXT_LIMIT) {
    return { ...stop('you', `the comment ${comment.id} of SEO Specialist on ${item.key} is longer than the ${SEO_TEXT_LIMIT} characters a prompt carries`, `Ask seo for a shorter one with a comment "Cần seo:" on ${item.key}, then /ao-request ${item.key}`), lines: decision.lines ?? [] };
  }
  const runs = decision.runs.map((run) => {
    const kind = kindOf(run);
    return kind && run.prompt ? { ...run, prompt: `${run.prompt}

${seoNote(kind, { key: item.key, epic, outside, comment })}` } : run;
  });
  return { ...decision, runs };
}
// The longest comment of seo a prompt carries: the prompt goes on the command line of claude, which Windows caps at
// 32767 characters.
const SEO_TEXT_LIMIT = 12000;

// What a STOP waits for (C2 spec section 4), so the dispatcher /ao-run reads it and never the words of next:
//   you     you: a gate, a click, Accept, seo-ok, a flag, questions, a preview, or a choice only you make
//   ci      CI on the PR
//   deploy  a deploy to the environment
//   item    another item: a link Blocks, the WIP of a role, a QA on the environment, a run that holds the folder
//   usage   the usage limit of the plan
//   fix     the command does not apply as asked, or something must be fixed first (an argument, the setup)
//   next    the command `then` names moves the item on now: { command, arg }
export const WAITS = ['you', 'ci', 'deploy', 'item', 'usage', 'fix', 'next'];

// A STOP. waits comes first, so no stop can leave it out (tests/workflow/waits.test.mjs reads every call); then goes
// with next only.
function stop(waits, reason, next, extra = {}) {
  if (!WAITS.includes(waits)) throw new Error(`a STOP waits for ${JSON.stringify(waits)}, which is none of ${WAITS.join(', ')}`);
  if ((waits === 'next') !== Boolean(extra.then)) throw new Error(`a STOP that waits for next names its command in then, and only that one: ${reason}`);
  return { go: false, reason, next, waits, lines: [], ...extra };
}

// The tests of a Java app start Postgres with Testcontainers (project-scaffold part 3, spec 2.2), and the E2E that qa
// runs start the api with its Postgres for the @local tests. So a decision that starts be-dev or qa on a project with a
// Java app stops first when Docker is not running: qa started Docker Desktop itself instead, twice on SHOP-76 of shop,
// and left the database of its lane up (Pilot 3). fe-dev tests the JS apps, which need no Docker. dockerRunning() is
// asked only when it matters.
const DOCKER_ROLES = ['be-dev', 'qa'];
// Docker is asked once more after pause(), before the command stops: the first /ao-build SHOP-13 of shop stopped though
// docker info had just answered.
export function dockerGate(decision, { java, dockerRunning, pause = () => {} }) {
  if (!decision.go || !java || !decision.runs.some((r) => DOCKER_ROLES.includes(r.role))) return decision;
  if (dockerRunning()) return decision;
  pause();
  if (dockerRunning()) return decision;
  return stop('fix', 'the project has a Java app, whose tests start Postgres in Docker, and Docker is not running', 'Start Docker Desktop, wait until it says Engine running, then run the command again');
}
const go = (runs, lines = []) => ({ go: true, runs, lines });

// A run of `role` for `purpose`, at the effort of the roster unless given.
function run(role, purpose, context, options, extra = {}) {
  return { role, key: context.key, effort: extra.effort ?? options.roster.roles[role].effort, purpose, prompt: promptFor(purpose, context), ...extra };
}

// What the run state of the item says first, for the same command: answers go to the newest run of `asker`, the role
// whose questions are open (the newest run when none is), a run that stopped goes on in its session, and a run that
// failed as many times as policies.yaml allows stops the command. null when the state says nothing.
function carryOn(command, facts, options, asker) {
  const runs = (facts.run?.runs ?? []).filter((r) => r.command === command);
  const last = runs.at(-1);
  const key = facts.item.key;
  if (options.answers !== undefined) {
    const asked = asker ? runs.filter((r) => r.role === asker).at(-1) : last;
    if (!asked || !ANSWERING.includes(asked.role) || !asked.session) return stop('fix', `no run of ba, ux, sa or seo on ${key} asked questions to answer`, `/ao-status ${key}`);
    const pr = facts.docs?.pr?.state === 'open' ? facts.docs.pr.number : undefined;
    return go([{ role: asked.role, key, effort: asked.effort, purpose: asked.purpose, resume: asked.session, prompt: answersPrompt(key, options.answers, { pr, role: asked.role }), checkout: asked.checkout }]);
  }
  if (!last) return null;
  // Every review that stopped on the head of the PR goes on, each in its own session, whichever run is on record last:
  // reviewer and security run at once and hit the usage limit together (review of shop PR #81).
  const { pr } = facts;
  const stoppedOnHead = (r) => STOPPED.includes(r.outcome) && REVIEWS.includes(r.purpose) && r.session && r.head && r.head === pr.headSha && !pr.reports?.[r.role]?.onHead;
  const stoppedReviews = pr ? [...new Set(runs.map(({ role }) => role))].map((role) => runs.filter((r) => r.role === role).at(-1)).filter(stoppedOnHead).sort((a, b) => a.n - b.n) : [];
  if (stoppedReviews.length > 0) {
    return go(stoppedReviews.map((r) => ({ role: r.role, key, effort: r.effort, purpose: r.purpose, resume: r.session, prompt: resumePrompt(key, r.role), checkout: r.checkout, head: r.head, worktree: { name: reviewTree(pr.number, r.role), sha: r.head } })));
  }
  if (STOPPED.includes(last.outcome)) {
    // A run is on record from its start (lib/workflow/runner.mjs): one killed before the first line of its log has no
    // session, and is made afresh (reviewer of ao-pilot PR #23).
    if (!last.session) return null;
    // The head and the note stay on the record of the run: /ao-fix reads them to know a note is done.
    const goOn = { role: last.role, key, effort: last.effort, purpose: last.purpose, resume: last.session, prompt: resumePrompt(key, last.role), ...(last.head && { head: last.head }), ...(last.note && { note: last.note }), ...(last.rebuild && { rebuild: last.rebuild }), ...(last.request && { request: last.request }) };
    if (REVIEWS.includes(last.purpose)) {
      // A review goes on only on the head it was reviewing, with its worktree back, while its report is not on that
      // head: on a new head, ao-pr would post what it wrote about the old one as the report of the new head. Those that
      // stopped on this head went on above.
      return null;
    }
    // A build goes on where its agent left the checkout, on the branch it made, as build-again does: the checkout of
    // its first run is develop.
    return go([{ ...goOn, checkout: last.purpose === 'build' ? undefined : last.checkout }]);
  }
  const limit = options.contract.retry.agent_failures_before_stop;
  let failures = 0;
  for (const r of [...runs].reverse()) {
    if (r.role !== last.role || r.purpose !== last.purpose || !FAILED.includes(r.outcome)) break;
    failures += 1;
  }
  if (failures >= limit) {
    return stop('you', `${last.role} failed ${failures} times in a row on ${key} (${last.outcome}); the contract stops after ${limit}`, `Read .ai/runs/${key}/last.md and the log of run ${last.n}, fix the cause, then run the command again`);
  }
  return null;
}

// Stops every command shares: a flagged item waits for you.
function flaggedStop(item) {
  if (!item.flagged) return null;
  const by = { 'merge-gate': 'merge-gate', audit: 'audit', rework: 'the rework limit' }[item.flag] ?? 'an agent or you';
  return stop('you', `${item.key} is flagged Needs you by ${by}`, `Read the newest flag comment on ${item.key}, act on it, then remove the flag and the needs-you label`);
}

function notAnEpic(item, command) {
  if (item.workType === 'epic') return null;
  return stop('fix', `${item.key} is a ${item.type}: /ao-${command} takes an Epic`, item.workType === 'sub-task' ? `/ao-build ${item.parent?.key}` : `/ao-build ${item.key}`);
}

// The run of the oldest open request to ba, ux, sa, security or seo on the item, or null (human-loop spec 3.3). On an Epic in stage spec
// or plan the role works on the docs branch, and pushes once the docs PR is open; anywhere else it works on Jira only,
// from develop. `request` is the time of the comment: two requests to one role are two runs, not the same one again.
function requestRun(facts, options) {
  const { item, docs } = facts;
  const [asked] = (item.requests ?? []).filter(runnableRequest);
  if (!asked) return null;
  const shaping = item.workType === 'epic' && ['specifying', 'planning'].includes(item.state) && docs;
  const pr = shaping && docs.pr?.state === 'open' ? docs.pr.number : undefined;
  const context = { key: item.key, role: asked.to, from: asked.from, at: asked.at, ...(shaping && { branch: docs.branch }), ...(pr && { pr }) };
  const checkout = shaping ? { branch: docs.branch, from: 'develop' } : { branch: 'develop', pull: true };
  // security looks at one library only, at high, not at the max of its full reviews (C1 spec section 5).
  return run(asked.to, 'request', context, options, { checkout, request: asked.at, ...(asked.to === 'security' && { effort: 'high' }) });
}

// The runs of the requests a change of the item's documents wrote (live-run-fixes spec 2.2): those to ba, ux or sa on
// the item or its Epic, written after `since` (the start of the change run, in ms), oldest first. Each runs on the branch
// of the item, before its dev agents: at T20 of human-loop such requests ran on Jira only, and the plan and design that
// merged kept the old order. Any other request still goes through /ao-request. extra: the checkout, and what the runs
// of a rebuild carry.
function followUpRuns(facts, since, options, { branch, pr, extra }) {
  const { item, epic } = facts;
  const open = (holder) => (holder?.requests ?? []).filter((asked) => runnableRequest(asked) && asked.at > since).map((asked) => ({ ...asked, on: holder.key }));
  const asked = [...open(item), ...(epic && epic.key !== item.key ? open(epic) : [])].sort((a, b) => a.at - b.at);
  return asked.map(({ to, from, at, on }) => run(to, 'request', { key: on, role: to, from, at, branch, pr, item: item.key }, options, { ...extra, request: at, key: item.key }));
}

// /ao-request <KEY>: the open requests to ba, ux, sa, security or seo on the item, one run each, oldest first (human-loop spec 3.3).
function decideRequest(facts, options) {
  const { item } = facts;
  const lines = [item.workType === 'epic' ? epicLine(facts) : itemLine(facts)];
  const blocked = flaggedStop(item);
  if (blocked) return { ...blocked, lines };
  const carried = carryOn('request', facts, { ...options, answers: undefined });
  if (carried) return { ...carried, lines };
  const next = requestRun(facts, options);
  if (next) return go([next], lines);
  const web = (item.requests ?? []).find(webRequest);
  if (web) return { ...stop('you', `${item.key} has a request of ${web.from} to ${web.to}: ${web.from} reads web pages, so its request runs no role`, `Read it on Jira; when it is right, ask ${web.to} yourself on ${item.key} with your own comment "Cần ${web.to}: …"`), lines };
  const others = (item.requests ?? []).filter(({ to }) => !ADVISERS.includes(to));
  const rest = others.length === 0 ? '' : `; ${others.length} open request${others.length > 1 ? 's go to other roles' : ' goes to another role'} (${[...new Set(others.map(({ to }) => to))].join(', ')})`;
  return { ...stop('fix', `${item.key} has no open request to ba, ux, sa, security or seo${rest}`, `/ao-status ${item.key}`), lines };
}

// A change asked for after its gate goes into a new Epic (human-loop spec 3.2; Lượt 111).
const pastGate = (key, gate, what) => stop('you', `${key} is past gate ${gate}: its ${what} no longer changes before the gate`, '/ao-intake with the change, for a new Epic');

// Whether `note` was made already, for /ao-spec and /ao-plan: the newest run of `command` for `purpose` that had a note
// had this one, and ended done. `moved(run)` adds a condition. /ao-fix counts by dev agent instead (human-loop spec 4.4).
function noteDone(facts, command, purpose, note, moved = () => true) {
  const lastNoted = (facts.run?.runs ?? []).filter((r) => r.command === command && r.purpose === purpose && r.note).at(-1);
  return Boolean(note) && lastNoted?.outcome === 'done' && lastNoted.note === noteKey(note) && moved(lastNoted);
}

const questionsStop = (key, artifact, questions, asker) =>
  stop('you', `${asker} left ${questions.length} open question${questions.length > 1 ? 's' : ''} in docs/specs/${key}/${artifact}`, `Answer them in the chat; Claude writes your answers to .ai/runs/${key}/answers.md and runs the command again with --answers`, { questions, asker });

// /ao-spec <EPIC>: ba, ux when the SPEC has screens, sa, then ba opens the docs PR, and seo writes last when design.md
// has screens of an app with seo: true; it ends at gate ①.
function decideSpec(facts, options) {
  const { item: epic, docs } = facts;
  const key = epic.key;
  const lines = [epicLine(facts)];
  const early = notAnEpic(epic, 'spec');
  if (early) return { ...early, lines };
  const byState = {
    new: () => stop('you', `Epic ${key} is New: its spec has not started`, `Click Start spec on ${key}, then /ao-spec ${key}`),
    planning: () => stop('next', `${key} is past gate ① spec-approval`, `/ao-plan ${key}`, { then: { command: 'plan', arg: key } }),
  };
  // The word seo or no-seo after the key turns seo on or off (C1 spec 6.1); any other text is a change to the SPEC.
  const word = seoWord(options.note);
  const note = word ? undefined : options.note?.trim() || undefined;
  if ((note || word) && !['new', 'specifying'].includes(epic.state)) return { ...pastGate(key, '① spec-approval', 'SPEC'), lines };
  if (epic.state !== 'specifying') return { ...(byState[epic.state]?.() ?? stop('fix', `${key} is ${epic.status}: stage spec is over`, `/ao-status ${key}`)), lines };
  const blocked = flaggedStop(epic);
  if (blocked) return { ...blocked, lines };
  const { used, limit } = facts.wip.epicShaping;
  if (used > limit) return { ...stop('you', `${used} Epics are in Specifying or Planning, over the WIP limit epic-shaping of ${limit}`, 'Finish or cancel another Epic first'), lines };
  // Open questions come before the docs PR: questions left on an open docs PR still go to you, and to who asked them.
  const pending = specQuestions(facts);
  const carried = carryOn('spec', facts, options, pending?.asker);
  if (carried) return { ...carried, lines };
  if (pending) return { ...questionsStop(key, pending.artifact, pending.questions, pending.asker), lines };
  // A change you ask for before gate ① (human-loop spec 3.2), unless the same one was made already.
  const revise = note && !noteDone(facts, 'spec', 'spec-revise', note) ? note : undefined;
  if (revise && !docs.spec) return { ...stop('fix', `${key} has no SPEC yet: a change waits for stage spec to write one`, `/ao-spec ${key}`), lines };
  // seo: the apps with seo: true of project.yaml, and your word (C1 spec 6.1). no-seo on a SPEC already written: ba
  // writes the line "SEO: không" in it, once; on a SPEC still to write, ba writes it with the SPEC.
  const seo = { apps: options.seoApps ?? [], word: word?.word };
  const seoFacts = { ...facts, seo };
  const off = word?.word === 'no-seo' ? seoOffNote(word.reason) : undefined;
  const turnOff = off && docs.spec && !SEO_OFF.test(docs.spec) && !noteDone(facts, 'spec', 'spec-revise', off) ? off : undefined;
  if (word) lines.push(seoWordLine(word, docs, seo));
  const context = {
    key,
    branch: docs.branch,
    ...(word?.word === 'no-seo' && { seoOff: word.reason ?? '' }),
    ...(word?.word === 'seo' && SEO_OFF.test(docs.spec ?? '') && { again: true }),
  };
  const checkout = { branch: docs.branch, from: 'develop' };
  const at = (role, purpose, extra) => run(role, purpose, context, options, { checkout, ...extra });
  const pr = docs.pr?.state === 'open' ? docs.pr.number : undefined;
  // Your change first, then a request between ba, ux and sa on the Epic, before the rest of the stage and gate ① (3.3).
  const asked = requestRun(facts, options);
  const change = revise ?? turnOff;
  const runs = [...(change ? [run('ba', 'spec-revise', { ...context, pr, note: change }, options, { checkout, note: noteKey(change) })] : []), ...(asked ? [asked] : [])];
  const pendingList = pendingRuns(options.contract, 'spec', seoFacts);
  if (pr) {
    // The runs the contract puts after the docs PR, seo's: it writes from web pages, so it writes last and ao-step pushes
    // its commit to the PR, which you read at gate ① before any agent with Bash reads it (second review of shop PR #79).
    const stage = stageRuns(options.contract, 'spec');
    const after = new Set(stage.slice(stage.findIndex(({ purpose }) => purpose === 'docs-pr') + 1).map(({ purpose }) => purpose));
    runs.push(...pendingList.filter(({ purpose, when }) => after.has(purpose) && !when).map(({ role, purpose }) => at(role, purpose)));
    if (runs.length > 0) return go(runs, lines);
    // A check that needs no model names what has no place in the section ## SEO, before you read it.
    const issues = seoTextProblems(seoSection(docs.spec), { hosts: options.seoHosts ?? [] });
    const warning = issues.length > 0 ? `. seo wrote the section ## SEO from web pages, and it holds ${issues.join('; ')} (lines counted from its heading): read it with care before you approve` : '';
    return { ...stop('you', `the docs PR #${pr} of ${key} is open: stage spec is done and waits for you at gate ① spec-approval${warning}`, `Read the diff of PR #${pr}, click Approve spec on ${key}, then /ao-plan ${key}`), lines };
  }
  // The rest of the stage, in the order of contract/stages.yaml (C1 spec section 6). ba says in the docs PR that seo
  // writes after it.
  const seoAfter = pendingList.some(({ role, when }) => WEB_ROLES.includes(role) && !when);
  const rest = pendingList.map(({ role, purpose, when }) => (purpose === 'docs-pr' && seoAfter ? run(role, purpose, { ...context, seoAfter }, options, { checkout }) : at(role, purpose, when && { when })));
  return go([...runs, ...rest], lines);
}

// The change ba makes for the word no-seo on a SPEC already written (C1 spec 6.1).
const seoOffNote = (reason) => `Ghi vào SPEC, ngay trước mục Open Questions, đúng một dòng "SEO: không, vì ${reason ?? 'bạn chọn `no-seo`'}", và bỏ mục ## SEO nếu SPEC có.`;

// What your word seo or no-seo does, for the lines of the check (C1 spec 6.1, step 1: ao-step says why seo does not run).
function seoWordLine(word, docs, seo) {
  if (seo.apps.length === 0) return `seo does not run: no app of .ai-orchestrator/project.yaml has seo: true`;
  if (word.word === 'no-seo') return `seo is off for this Epic, as you asked: ba writes "SEO: không, vì ${word.reason ?? 'bạn chọn `no-seo`'}" in the SPEC`;
  if (docs.design && seoScreens(docs.design, seo).length === 0) return `seo does not run: design.md has no screen of ${seo.apps.join(', ')}, the apps with seo: true`;
  return 'seo is on for this Epic, as you asked';
}

// The role among `roles` whose run of `command` came last: who to give the answers to.
const lastAsker = (facts, command, roles) => (facts.run?.runs ?? []).filter((r) => r.command === command && roles.includes(r.role)).at(-1)?.role;

// The open questions of stage spec, SPEC first, then design.md when the SPEC has screens: { artifact, questions, asker }
// or null.
function specQuestions(facts) {
  const { docs } = facts;
  if (!docs.spec) return null;
  const spec = openQuestions(docs.spec);
  if (spec.length > 0) return { artifact: 'spec.md', questions: spec, asker: lastAsker(facts, 'spec', ['ba', 'sa', 'seo']) ?? 'ba' };
  const design = SCREENS.test(docs.spec) && docs.design ? openQuestions(docs.design) : [];
  return design.length > 0 ? { artifact: 'design.md', questions: design, asker: 'ux' } : null;
}

// /ao-plan <EPIC>: sa writes the plan, ba creates the items; it ends at gate ②. Once you approved the plan, the second
// run asks jira-sync to refine the items, and merge-gate then merges the docs PR.
function decidePlan(facts, options) {
  const { item: epic, docs } = facts;
  const key = epic.key;
  const lines = [epicLine(facts)];
  const early = notAnEpic(epic, 'plan');
  if (early) return { ...early, lines };
  if (epic.state === 'new') return { ...stop('you', `Epic ${key} is New: its spec has not started`, `Click Start spec on ${key}, then /ao-spec ${key}`), lines };
  if (epic.state === 'specifying') {
    const pr = docs.pr?.state === 'open' ? `Read the diff of the docs PR #${docs.pr.number}, click` : 'Run /ao-spec first; then click';
    return { ...stop('you', `${key} waits at gate ① spec-approval`, `${pr} Approve spec on ${key}, then /ao-plan ${key}`), lines };
  }
  const note = options.note?.trim() || undefined;
  if (note && ['in-progress', 'done', 'cancelled'].includes(epic.state)) return { ...pastGate(key, '② plan-approval', 'plan'), lines };
  const blocked = flaggedStop(epic);
  if (blocked) return { ...blocked, lines };
  if (epic.state === 'in-progress') return { ...afterPlanGate(facts), lines };
  if (epic.state !== 'planning') return { ...stop('fix', `${key} is ${epic.status}: stage plan is over`, `/ao-status ${key}`), lines };
  const carried = carryOn('plan', facts, options, docs.plan && openQuestions(docs.plan).length > 0 ? 'sa' : undefined);
  if (carried) return { ...carried, lines };
  if (docs.pr?.state !== 'open') return { ...stop('fix', `${key} has no open docs PR on ${docs.branch}`, `/ao-spec ${key} opens it; if it was closed, reopen it`), lines };
  // The day of gate ① in UTC, as the changelog of the Epic records it: sa writes it in the Status of the SPEC and design.
  const passed = epic.gates?.['spec-approval'];
  const context = { key, branch: docs.branch, pr: docs.pr.number, ...(passed && { approved: new Date(passed).toISOString().slice(0, 10) }) };
  const checkout = { branch: docs.branch, from: 'develop' };
  const at = (role, purpose) => run(role, purpose, context, options, { checkout });
  // A request between ba, ux and sa on the Epic runs before the rest of the stage, and before gate ② (human-loop 3.3).
  const asked = requestRun(facts, options);
  const first = asked ? [asked] : [];
  // A change you ask for before gate ② (human-loop spec 3.2), unless the same one was made already.
  const revise = note && !noteDone(facts, 'plan', 'plan-revise', note) ? note : undefined;
  if (revise && !docs.plan) return { ...stop('fix', `${key} has no plan yet: a change waits for stage plan to write one`, `/ao-plan ${key}`), lines };
  // The runs of the stage still to make, in the order of contract/stages.yaml (C1 spec section 6).
  const rest = pendingRuns(options.contract, 'plan', facts).map(({ role, purpose }) => at(role, purpose));
  if (!docs.plan) return go([...first, ...rest], lines);
  const questions = openQuestions(docs.plan);
  if (questions.length > 0) return { ...questionsStop(key, 'plan.md', questions, 'sa'), lines };
  const lead = [...(revise ? [run('sa', 'plan-revise', { ...context, note: revise }, options, { checkout, note: noteKey(revise) })] : []), ...first];
  if (rest.length > 0) return go([...lead, ...rest], lines);
  if (lead.length > 0) return go(lead, lines);
  // The Stories and Tasks of the Epic, and their Sub-tasks, which carry the labels when a Story is split.
  const items = epic.children.flatMap((child) => [child, ...(child.subtasks ?? [])]);
  const effort = items.filter(({ effort: e }) => e).length;
  // The new libraries of the plan, checked before you approve them with it (C1 spec section 5); the dev agent runs
  // dep-check again, and writes the approval, when it installs one.
  const libraries = planLibraries(docs.plan);
  const libraryLines = libraries.length > 0 ? [`New libraries of the plan: ${libraries.map(({ ecosystem, spec }) => `${ecosystem} ${spec}`).join(', ')}. Check each before you approve: node .ai-orchestrator/scripts/dep-check.mjs <npm|maven> <name>@<version> --dry-run`] : [];
  return {
    ...stop('you',
      `the plan and the ${items.length} items of ${key} are done; ${effort > 0 ? `${effort} of them have an effort label` : 'none has an effort label'}. They wait for you at gate ② plan-approval`,
      `Read plan.md on the docs PR #${docs.pr.number}, click Approve plan on ${key}, then /ao-plan ${key} again`,
    ),
    lines: [...lines, ...libraryLines],
  };
}

// The states in which an item has its PR merged (the `dependencies-merged` guard looks at the PR itself).
const MERGED_STATES = new Set(['ready-for-qa', 'in-qa', 'done']);

// Ready items that no unmerged item of the Epic blocks (Pilot 1, T9: the first Ready item was suggested, though its
// blocker was not merged). A blocker outside the Epic cannot be told from here: /ao-build checks it with its own guard.
function startable(children) {
  const blocked = ({ blockedBy = [] }) => blockedBy.some((key) => {
    const blocker = children.find((child) => child.key === key);
    return blocker && !MERGED_STATES.has(blocker.state);
  });
  return children.filter((child) => child.state === 'ready' && !blocked(child)).map(({ key }) => key);
}

// Past gate ②: jira-sync refines the items (refine-children) and merge-gate merges the docs PR after it.
function afterPlanGate(facts) {
  const { item: epic, docs } = facts;
  const waiting = epic.children.filter(({ state }) => state === 'new');
  if (docs.pr?.merged && waiting.length === 0) {
    const ready = epic.children.filter(({ state }) => state === 'ready');
    const [first] = startable(epic.children);
    const why = `the docs PR #${docs.pr.number} of ${epic.key} is merged and its items are refined`;
    if (!first && ready.length > 0) return stop('item', `${why}; every Ready item waits for an item that is not merged yet`, `/ao-status ${epic.key}`);
    // Nothing Ready: the items are at work, or wait for you.
    const waits = first ? 'next' : 'item';
    return stop(waits, why, first ? `/ao-build ${first}` : `/ao-status ${epic.key}`, first ? { then: { command: 'build', arg: first } } : {});
  }
  if (!docs.pr) return stop('fix', `${epic.key} is past gate ② but has no docs PR on ${docs.branch}`, `/ao-status ${epic.key}`);
  return go([{ action: 'jira-sync', key: epic.key, then: docs.pr.merged ? null : { mergeGate: docs.pr.number } }]);
}

// The command that runs an open request, after its text: /ao-request for ba, ux and sa (human-loop spec 3.3).
const runsRequest = ({ to }, key) => (ADVISERS.includes(to) ? ` → /ao-request ${key}` : '');
// One open request for /ao-status: none of the words of a request seo wrote, which reach the main session before you
// read them (review of shop PR #80).
const requestLine = (request, key) =>
  webRequest(request) ? `${request.to} from ${request.from}: not run, since ${request.from} reads web pages; read it on Jira` : `${request.to}${request.from ? ` from ${request.from}` : ''}: ${request.text}${runsRequest(request, key)}`;

// A preview that runs, for /ao-status (human-loop spec 4.3): the folder is on a PR branch until it stops.
const previewLine = ({ key, branch, apps = [] }) => `the preview of ${key} runs on ${branch}${apps.length > 0 ? `: ${apps.map(({ name, url }) => `${name} ${url}`).join(', ')}` : ', its apps stopped'} → /ao-preview ${key} --stop`;

// /ao-status: the item and what comes next, or every item of the space.
function decideStatus(facts, options) {
  if (!facts.item) return spaceStatus(facts);
  const lines = [facts.item.workType === 'epic' ? epicLine(facts) : itemLine(facts)];
  // A level label that does not count is said here too (second review of shop PR #79).
  if (facts.item.levelIgnored) lines.push(levelLine(facts, options));
  const cost = (facts.run?.runs ?? []).reduce((total, r) => total + (r.costUsd ?? 0), 0);
  if (facts.run?.runs?.length) lines.push(`Runs: ${facts.run.runs.length}, ${usd(cost)} in all; the last: ${describeRun(facts.run.runs.at(-1))}`);
  if (facts.previewRunning) lines.unshift(previewLine(facts.previewRunning));
  for (const request of facts.item.requests) lines.push(`Open request to ${requestLine(request, facts.item.key)}`);
  if (facts.item.workType === 'epic' && facts.itemRuns) lines.push(epicCostLine(facts));
  const quiet = facts.pr?.state === 'open' ? findingsLine(facts.pr) : null;
  if (quiet) lines.push(quiet);
  return { status: true, lines, next: nextFor(facts.item, facts.pr) };
}

function spaceStatus(facts) {
  // A draft PR counts too: it waits for your preview (human-loop spec 4.7).
  const prOf = new Map(facts.pulls.map(({ key, number, draft }) => [key, { number, draft }]));
  const costOf = new Map(facts.runs.map(({ key, runs = [] }) => [key, runs.reduce((total, r) => total + (r.costUsd ?? 0), 0)]));
  const lines = [];
  const yours = facts.previewRunning ? [previewLine(facts.previewRunning)] : [];
  for (const item of facts.items.filter(({ workType }) => workType !== 'sub-task')) {
    const pull = prOf.get(item.key);
    const step = nextCommand(item, pull ? { ...pull, state: 'open' } : null);
    const next = step.text;
    const cost = costOf.get(item.key);
    lines.push(`${item.key} ${item.type} "${item.summary}": ${item.status}${pull?.draft ? `, draft PR #${pull.number}` : ''}${item.flagged ? ', flagged' : ''}${cost ? `, ${usd(cost)}` : ''} → ${next}`);
    // What waits for you comes from the step, not from its words (C2 spec section 4).
    if (step.waits === 'you') yours.push(`${item.key}: ${next}`);
    for (const request of item.requests) lines.push(`  open request to ${requestLine(request, item.key)}`);
  }
  // release-workflow spec 2.2: what runs where, the open release branch, what is Done but not in a release yet, and the
  // Release click left on Jira for the release on Production. Read with your gh login; without it these lines are left out.
  if (facts.release) {
    const { running, productionVersion: onProduction, releaseBranches, doneUnreleased } = facts.release;
    const where = (env) => {
      const sha = running[env]?.sha;
      if (!sha) return 'nothing';
      return env === 'production' && onProduction ? `${onProduction.name} (${eight(sha)})` : eight(sha);
    };
    lines.push(`Running: Development ${where('development')}, Staging ${where('staging')}, Production ${where('production')}`);
    // Each public app on its own host (project-scaffold part 2, spec 2.4): where it answers.
    for (const env of ['development', 'staging', 'production']) {
      const { apps } = appUrls({ projectText: running[env]?.projectText, environment: env, url: null });
      if (Object.keys(apps).length > 0) lines.push(`  ${env[0].toUpperCase()}${env.slice(1)}: ${Object.entries(apps).map(([app, url]) => `${app} ${url}`).join(', ')}`);
    }
    if (releaseBranches.length > 0) lines.push(`Open release branch: ${releaseBranches.map(({ name }) => name).join(', ')}`);
    if (doneUnreleased.length > 0) lines.push(`Done, not released yet: ${doneUnreleased.join(', ')}`);
    if (onProduction && !onProduction.released) yours.push(`${onProduction.name}: click Release on it in Jira: it runs on Production`);
  }
  return { status: true, lines: [...(yours.length > 0 ? ['Waiting for you:', ...yours.map((line) => `  ${line}`), ''] : []), ...lines], next: yours[0] ?? lines.find((line) => line.includes('→ /ao-'))?.split('→ ')[1] ?? null };
}

// The guards of complete in contract/workflows.yaml: every item of the Epic Cancelled, or Done in a release on Production.
const closed = ({ state, fixVersions = [] }) => state === 'cancelled' || (state === 'done' && fixVersions.some(({ released }) => released));

// The command or click that moves an item on, from its state. pr: the item's newest PR ({ number, state, draft }), or
// null. Only an open PR counts: an item In Progress whose PR is merged failed QA, and is built again on a new branch
// (live-run-fixes spec 2.4).
export function nextFor(item, pr = null) {
  return nextCommand(item, pr).text;
}

// The same as a step (C2 spec section 5.2, plan decision 5): { command, arg, text } for the ao-step command that moves
// the item on, { waits, text } for what it waits for (WAITS), or { done: true, text } for an item at its end. The
// dispatcher takes command and arg; /ao-status prints text, and lists the items that wait for you.
export function nextCommand(item, pr = null) {
  const open = pr?.state === 'open' ? pr : null;
  const key = item.key;
  const command = (name, arg, text = `/ao-${name} ${arg}`) => ({ command: name, arg, text });
  const waits = (on, text) => ({ waits: on, text });
  const end = (text) => ({ done: true, text });
  if (item.flagged) return waits('you', `read the flag comment on ${key} (Needs you)`);
  if (item.workType === 'epic' && item.state === 'in-progress' && item.children?.length > 0 && item.children.every(closed)) return waits('you', `Click Complete on ${key}`);
  if (item.workType === 'epic') {
    const epic = {
      new: () => waits('you', `Click Start spec on ${key}`),
      specifying: () => command('spec', key),
      planning: () => command('plan', key),
      'in-progress': () => waits('item', 'its items move on'),
      done: () => end('done'),
      cancelled: () => end('cancelled'),
    };
    return epic[item.state]?.() ?? waits('fix', `/ao-status ${key}`);
  }
  const work = {
    new: () => waits('item', 'waits to be refined (jira-sync after Approve plan, or you)'),
    ready: () => command('build', key),
    // A draft PR waits for your preview, which you may skip (human-loop spec 4.2).
    'in-progress': () => {
      if (!open) return command('build', key);
      return open.draft ? waits('you', `/ao-preview ${key} or /ao-review ${open.number}`) : command('review', open.number);
    },
    // /ao-review decides whether the reports ask for /ao-fix (a STOP with then).
    'in-review': () => (open ? command('review', open.number, `/ao-review ${open.number} or /ao-fix ${open.number}`) : waits('fix', 'its PR is closed: /ao-status')),
    'ready-for-qa': () => command('qa', key),
    'in-qa': () => waits('you', `Accept or QA fail on ${key} after the QA report`),
    done: () => end('done'),
    cancelled: () => end('cancelled'),
  };
  return work[item.state]?.() ?? waits('fix', `/ao-status ${key}`);
}

export const usd = (value) => `${value.toFixed(2)} USD`;

// The acceptance criteria of a SPEC: the distinct numbers of its lines "- AC<n>:", less those dropped with "(bỏ)".
export function acCount(spec) {
  const kept = new Set();
  for (const line of String(spec ?? '').split(/\r?\n/)) {
    const found = /^\s*[-*]\s+(?:\*\*)?AC(\d+)\b/.exec(line);
    if (found && !/\(bỏ\)/.test(line)) kept.add(Number(found[1]));
  }
  return kept.size;
}

// The cost of an Epic per acceptance criterion (C1 spec section 7): its own runs and those of its items, from their
// state.json. A run whose cost is unknown is counted apart, not as 0.
function epicCostLine({ item, run, itemRuns = [], docs }) {
  const runs = [...(run?.runs ?? []), ...itemRuns.flatMap(({ runs: r }) => r)];
  const known = runs.filter((r) => typeof r.costUsd === 'number');
  const total = known.reduce((sum, r) => sum + r.costUsd, 0);
  const unknown = runs.length - known.length;
  const acs = acCount(docs?.spec);
  const per = acs > 0 ? `, ${usd(total / acs)} per AC over ${acs} AC${acs > 1 ? 's' : ''}` : ', no AC in the SPEC yet';
  return `Cost of ${item.key}: ${usd(total)} in ${known.length} run${known.length === 1 ? '' : 's'} of the Epic and its items${per}${unknown > 0 ? `; ${unknown} run${unknown > 1 ? 's have' : ' has'} no known cost, not counted` : ''}`;
}

// A run stopped before its result has a cost of null: unknown (lib/workflow/runs.mjs).
const costOfRun = (r) => (r.costUsd === null ? ', cost unknown' : r.costUsd !== undefined ? `, ${usd(r.costUsd)}` : '');
const describeRun = (r) => `${r.role} ${r.purpose ?? ''} ${r.outcome}${costOfRun(r)}`.replace(/\s+/g, ' ');

function epicLine({ item, docs }) {
  const pr = docs?.pr ? `docs PR #${docs.pr.number} ${docs.pr.merged ? 'merged' : docs.pr.state}` : docs?.exists ? `branch ${docs.branch}, no PR` : 'no docs branch';
  const children = item.children?.length ? `; ${item.children.length} items` : '';
  return `${item.key} ${item.type} "${item.summary}": ${item.status}; ${pr}${children}`;
}

export function itemLine({ item, pr }) {
  const subs = item.subtasks.length > 0 ? `; Sub-task ${item.subtasks.map(({ key, role }) => `${key} (${role ? `ao-${role}` : 'no role label'})`).join(', ')}` : '';
  const labels = item.subtasks.length === 0 ? `; ${item.role ? `ao-${item.role}` : 'no role label'}${item.effort ? `, ao-effort-${item.effort}` : ''}` : '';
  const state = pr ? `; PR #${pr.number} ${pr.merged ? 'merged' : pr.state}${pr.state === 'open' ? `, CI ${pr.ci.green ? 'green' : pr.ci.failed ? 'red' : 'running'}` : ''}` : '; no PR';
  return `${item.key} ${item.type} "${item.summary}": ${item.status}${subs}${labels}${state}`;
}

const EFFORT_ORDER = ['low', 'medium', 'high', 'xhigh', 'max'];
const atLeast = (effort, floor) => (EFFORT_ORDER.indexOf(effort) >= EFFORT_ORDER.indexOf(floor) ? effort : floor);
// At the second request for changes (Rework 2 or more), the dev agent works at xhigh at least (spec 2.5).
const REWORK_FLOOR = { count: 2, effort: 'xhigh' };

// /ao-build <KEY>: the dev agent of each Sub-task, BE before FE, or of the item's role label, up to an open PR.
function decideBuild(facts, options) {
  const devRoles = devOrder(options);
  const { item, pr, docs } = facts;
  const lines = [itemLine(facts)];
  const key = item.key;
  const out = (decision) => ({ ...decision, lines: [...lines, ...(decision.lines ?? [])] });
  if (item.workType === 'epic') return out(stop('fix', `${key} is an Epic: /ao-build takes its Stories and Tasks`, `/ao-plan ${key}`));
  if (item.workType === 'sub-task') return out(stop('fix', `${key} is a Sub-task: /ao-build takes its Story, which runs every Sub-task in order`, `/ao-build ${item.parent?.key}`));
  const blocked = flaggedStop(item);
  if (blocked) return out(blocked);
  // A Sub-task still to build that its agent flagged waits for you: jira-guard refuses its moves until the flag is off.
  const held = item.subtasks.find(({ state, flagged }) => state !== 'done' && flagged);
  if (held) {
    return out(stop('you', `Sub-task ${held.key} of ${key} is flagged Needs you`, `Read the newest comment on ${held.key} and answer it there, remove the flag and the needs-you label, then /ao-build ${key}`));
  }
  // The draft PR of a build waits for your preview (human-loop spec 4.2); red CI goes to /ao-fix first.
  if (pr?.state === 'open' && pr.draft) {
    if (pr.ci.failed) return out(stop('next', `CI is red on the draft PR #${pr.number} of ${key}`, `/ao-fix ${pr.number}`, { then: { command: 'fix', arg: pr.number } }));
    // facts.previewDir: where the preview is when the item has a lane (review of shop PR #21).
    return out(stop('you', `the draft PR #${pr.number} of ${key} waits for your preview${pr.ci.pending ? ' (CI still running)' : ''}: the screenshots and API samples of its dev agents are in ${facts.previewDir ?? `.ai/runs/${key}/preview/`}`, `/ao-preview ${key}, or /ao-review ${pr.number} to skip the preview`));
  }
  if (pr?.state === 'open') {
    const then = { command: pr.ci.failed || pr.changesRequested ? 'fix' : 'review', arg: pr.number };
    return out(stop('next', `PR #${pr.number} of ${key} is open: the build is done`, `/ao-${then.command} ${pr.number}`, { then }));
  }
  // A Story split into Sub-tasks goes on through them: their agents keep the ledgers, one per Sub-task. Any other item
  // In Progress goes on from its own ledger.
  const subtaskLedgers = facts.subtaskLedgers ?? [];
  const split = item.subtasks.length > 0;
  // A Story whose agent kept its ledger by the key of the Story, with a Sub-task done, goes on too (SHOP-34 of shop).
  const again = item.state === 'in-progress' && (split ? subtaskLedgers.length > 0 || (facts.ledger && item.subtasks.some(({ state }) => state === 'done')) : facts.ledger);
  // After QA fail: the PR of the item is merged and its newest QA report is FAIL (human-loop spec 5.2).
  const afterQaFail = item.state === 'in-progress' && Boolean(pr?.merged) && facts.qaReport?.result === 'FAIL';
  // A build run that stopped with a session goes on first, whatever the ledger: its agent may have started the item and
  // hit the usage limit before it wrote one (live check of shop, 2026-11-16, SHOP-11).
  if (item.state === 'in-progress' && !again && !afterQaFail) {
    const resumed = carryOn('build', facts, options);
    // A stopped run of an ops Task goes on in no lane, with the basic auth its labels give now (review of shop PR #78).
    if (resumed && item.ops) return out({ ...resumed, runs: resumed.runs.map((r) => ({ ...r, lane: false, ...(item.envAuth && { envAuth: true }) })) });
    if (resumed) return out(resumed);
  }
  // A Story or Task added to an Epic after its plan was approved stays New: jira-sync refined the children of the Epic
  // only at Approve plan (Phiên 33 of shop: SHOP-39, 41, 42, 43, 45). One that meets DoR (refinable) gets jira-sync now,
  // and the build goes on once it is Ready.
  if (item.state === 'new' && facts.refinable) return out(go([{ action: 'jira-sync', key, continue: true }]));
  if (item.state !== 'ready' && !again && !afterQaFail) {
    const why = item.state === 'in-progress' ? `${key} is In Progress but has no ledger in .ai/ledger/: its run did not come from an agent of the kit` : `${key} is ${item.status}, not Ready`;
    return out(stop('fix', why, nextFor(item, pr)));
  }
  if (!facts.dependenciesMerged) return out(stop('item', `an item ${key} depends on (${item.blockedBy.join(', ')}) is not merged yet`, `/ao-status ${item.blockedBy[0]}`));
  if (item.parent && docs && !docs.pr?.merged) {
    return out(stop('item', `the docs PR of Epic ${item.parent.key} is not merged yet`, `/ao-plan ${item.parent.key} after you approve its plan`));
  }
  const carried = carryOn('build', facts, options);
  if (carried) return out(carried);
  if (afterQaFail) return out(rebuild(facts, options));
  const seoWait = item.state === 'ready' ? seoOkStop(facts, options) : null;
  if (seoWait) return out(seoWait);

  // Who builds what: the Sub-tasks still to do, in order, or the item itself.
  const todo = item.subtasks.filter(({ state }) => state !== 'done').sort((a, b) => devRoles.indexOf(a.role) - devRoles.indexOf(b.role) || a.key.localeCompare(b.key, undefined, { numeric: true }));
  const unlabelled = item.subtasks.length > 0 ? todo.filter(({ roles }) => roles.length !== 1) : item.roles.length !== 1 ? [item] : [];
  if (unlabelled.length > 0) {
    const which = unlabelled.map(({ key: k, roles }) => `${k} ${roles.length === 0 ? 'has no role label' : `has ${roles.length} role labels`}`).join('; ');
    return out(stop('you', `${which}: /ao-build does not guess who builds it`, `Ask ba to label it ${options.mapping?.work_labels?.role_prefix ?? 'ao-'}<role> (be-dev, fe-dev or devops), then /ao-build ${key}`));
  }
  if (item.subtasks.length > 0 && todo.length === 0) return out(stop('fix', `every Sub-task of ${key} is done, and it has no open PR`, `/ao-status ${key}`));
  const effortOf = (work) => work.effort ?? item.effort ?? options.roster.roles[work.role].effort;
  if (item.state === 'ready') {
    for (const role of new Set((todo.length > 0 ? todo : [item]).map(({ role: r }) => r))) {
      if (facts.wip.devAgent[role] === false) return out(stop('item', `${role} is at its WIP limit dev-agent: it has an item In Progress already`, `/ao-status`));
    }
  }
  // An ops Task (label ao-ops; kit followups, batch 4 item 14) is devops's, with no branch: no checkout to make, and
  // the basic auth only under the label ao-env-auth, which only you put (block-atlassian refuses it to agents).
  if (item.ops) {
    const prefix = options.mapping?.work_labels?.role_prefix ?? 'ao-';
    if (item.role !== 'devops') return out(stop('you', `${key} is an ops Task, which only devops does, and its role label is ${prefix}${item.role}`, `Ask ba to label it ${prefix}devops, then /ao-build ${key}`));
    const auth = item.envAuth ? { envAuth: true } : {};
    const prompt = again ? promptFor('build-again', { key, status: item.status }) : promptFor('build-ops', { key, auth: Boolean(item.envAuth) });
    // No lane: an ops Task has no branch, so its lane would never be pruned (review of shop PR #78).
    return out(go([{ role: 'devops', key, effort: effortOf(item), purpose: 'build', prompt, lane: false, ...auth }]));
  }
  if (again && !split) return out(go([{ role: item.agent && devRoles.includes(item.agent) ? item.agent : item.role, key, effort: effortOf(item), purpose: 'build', prompt: promptFor('build-again', { key, status: item.status }) }]));
  if (item.subtasks.length === 0) {
    return out(go([{ role: item.role, key, effort: effortOf(item), purpose: 'build', prompt: promptFor('build', { key, type: item.type, status: item.status }), checkout: { branch: 'develop', pull: true } }]));
  }
  const done = item.subtasks.filter(({ state }) => state === 'done');
  const runs = todo.map((sub, i) => {
    const previous = i === 0 ? done.at(-1)?.key : todo[i - 1].key;
    const last = i === todo.length - 1;
    const first = i === 0 && !previous;
    const context = { key: sub.key, story: key, role: sub.role, status: item.status, previous, last };
    // A Sub-task its agent started and left a ledger for goes on from that ledger, on the branch it is on.
    if (sub.state === 'in-progress' && subtaskLedgers.includes(sub.key)) {
      return { role: sub.role, key: sub.key, story: key, effort: effortOf(sub), purpose: 'build', prompt: promptFor('build-again', { key: sub.key, status: sub.status }) };
    }
    return { role: sub.role, key: sub.key, story: key, effort: effortOf(sub), purpose: 'build', prompt: promptFor(first ? 'build-first' : 'build-next', context), ...(first && { checkout: { branch: 'develop', pull: true } }) };
  });
  return out(go(runs));
}

// The stop of /ao-build before an item with the label ao-seo outside an Epic starts, or null (second review of shop PR
// #79): its dev agent builds the comment of seo word for word, seo wrote it from web pages, and no gate had you read it,
// as gate ① has you read the section ## SEO of a SPEC. It waits for seo's answer, then for your seo-ok
// (options.seoOk), with what a check that needs no model finds in the comment.
function seoOkStop(facts, options) {
  const { item } = facts;
  if (!seoOutsideEpic(item, options)) return null;
  if ((item.requests ?? []).some(({ to }) => WEB_ROLES.includes(to))) return stop('next', `${item.key} has an open request to seo: its SEO part is not written yet`, `/ao-request ${item.key}`, { then: { command: 'request', arg: item.key } });
  return seoApprovalStop(facts, options);
}

const seoOutsideEpic = (item, options) => {
  const epicType = options.contract.work_types.find(({ id }) => id === 'epic').jira_issue_type;
  return Boolean(item?.seo) && item.parent?.type !== epicType;
};

// Your seo-ok holds one comment of seo: the one that was newest when you gave it, by its id and a hash of its text
// (review of shop PR #80). facts.seoApproved is that mark, item.seoMark the one of the newest comment now; an item whose
// description points to a SPEC has no comment, and its mark has no id. Null when the dev runs may go, or the stop.
function seoApprovalStop(facts, options) {
  const { item } = facts;
  const mark = seoMarkText(item.seoMark);
  const approved = facts.seoApproved;
  // seo-ok names the mark the check printed, so it holds the comment you read, not one written since (review of shop
  // PR #81).
  if (options.seoOk === mark || (approved && seoMarkText(approved) === mark)) return null;
  const issues = seoTextProblems(item.seoComment ?? '', { hosts: options.seoHosts ?? [] });
  const holds = issues.length > 0 ? `. It holds ${issues.join('; ')} (lines of the comment)` : '';
  const next = `Read the newest comment of SEO Specialist on ${item.key} on Jira (or the section ## SEO its description points to); when it is right, /ao-build ${item.key} seo-ok ${mark}`;
  if (options.seoOk) return stop('you', `the comment of SEO Specialist on ${item.key} changed after the check showed it: seo wrote or changed one since${holds}`, next);
  if (approved) return stop('you', `the newest comment of SEO Specialist on ${item.key} is not the one you approved with seo-ok: seo wrote or changed one since${holds}`, next);
  return stop('you', `${item.key} has the label ao-seo and is in no Epic: its dev agent builds the comment of SEO Specialist word for word, and seo wrote it from web pages${holds}`, next);
}

// The mark of a comment of seo as seo-ok names it: its id and hash, or none.
export const seoMarkText = (mark) => `${mark?.id ?? 'none'}:${mark?.hash ?? 'none'}`;

// The next branch of an item after QA fail: the same kind, key and slug, with -r2, -r3… (tracker-integration spec 2.5).
const nextRound = (headRef) => {
  const branch = parseBranch(headRef);
  return branch && branch.kind !== 'release' ? `${branch.kind}/${branch.key}-${branch.slug}-r${branch.round + 1}` : null;
};

// /ao-build after QA fail (human-loop spec 5.2): a new branch from develop, then ba when the criteria changed on Jira
// after the merge (spec-sync), then one dev agent per side with defects, BE first, at the level of the item: the
// Sub-tasks of a Story are done, and a Sub-task cannot be opened again. The runs of one rebuild carry the time of the
// QA report they answer, so a later QA fail is a rebuild of its own. For a Story with a BE and an FE Sub-task you split
// the defects with be: and fe:, as for /ao-fix.
function rebuild(facts, options) {
  const devRoles = devOrder(options);
  const { item, pr, qaReport } = facts;
  const key = item.key;
  const branch = nextRound(pr.headRef);
  if (!branch) return stop('fix', `PR #${pr.number} of ${key} is on ${pr.headRef}, not the branch of a work item`, `/ao-status ${key}`);
  const runs = facts.run?.runs ?? [];
  const mine = runs.filter((r) => r.command === 'build' && r.rebuild === qaReport.at);
  const done = (role, purpose) => mine.some((r) => r.role === role && r.purpose === purpose && r.outcome === 'done');
  const sides = item.subtasks.length > 0 ? [...new Set(item.subtasks.map(({ role }) => role))] : [item.role].filter(Boolean);
  if (sides.length === 0) return stop('you', `${key} has no role label: /ao-build does not guess who fixes it`, `Ask ba to label it ${options.mapping?.work_labels?.role_prefix ?? 'ao-'}<role>, then /ao-build ${key}`);
  const note = options.note?.trim() || undefined;
  let parts = { [sides[0]]: note };
  if (sides.length > 1) {
    const split = note ? splitNote(note) : null;
    if (!split?.prefixed) return stop('you', `${key} failed QA and has a BE and an FE Sub-task: say which defects of its QA report go to whom`, `/ao-build ${key} with the defects split by be: and fe:`);
    parts = split.parts;
  }
  const epic = item.parent && /epic/i.test(item.parent.type) ? item.parent.key : null;
  const merged = Date.parse(pr.mergedAt ?? 0);
  const acAdded = runs.filter((r) => r.command === 'qa' && r.purpose === 'ac-add' && r.outcome === 'done' && Date.parse(r.endedAt ?? r.startedAt ?? 0) > merged).at(-1);
  const checkout = { branch, from: 'develop' };
  const list = [];
  if (acAdded && epic && !done('ba', 'spec-sync')) list.push(run('ba', 'spec-sync', { key, epic, branch }, options, { checkout, rebuild: qaReport.at }));
  // The requests to ba, ux or sa written since ba changed the criteria, by ba or by spec-sync, follow on this branch
  // before the dev agents: the plan and the design follow the SPEC (live-run-fixes spec 2.2).
  if (acAdded) list.push(...followUpRuns(facts, Date.parse(acAdded.startedAt ?? 0), options, { branch, extra: { checkout, rebuild: qaReport.at } }));
  const roles = devRoles.filter((role) => Object.hasOwn(parts, role) && !done(role, 'build'));
  roles.forEach((role, i) => {
    let effort = item.effort ?? options.roster.roles[role].effort;
    if (item.rework >= REWORK_FLOOR.count) effort = atLeast(effort, REWORK_FLOOR.effort);
    const others = roles.filter((other) => other !== role).map((other) => ({ role: other, text: parts[other] }));
    const prompt = promptFor('rebuild', { key, at: qaReport.at, branch, pr: pr.number, part: parts[role], others, next: roles[i + 1] });
    list.push({ role, key, effort, purpose: 'build', prompt, checkout, rebuild: qaReport.at });
  });
  if (list.length === 0) return stop('fix', `the fix of ${key} after QA fail is built on ${branch}, but no PR of it is open`, `/ao-status ${key}`);
  return go(list, [`QA fail on ${qaReport.at.slice(0, 16).replace('T', ' ')} UTC: the fix goes on ${branch}, new from develop`]);
}

// The review runs a PR still needs on its head: reviewer always on the whole PR, security on the whole PR or on the
// new part only (spec 2.6). Each starts on the base branch of the PR, a protected one (baseStop): what steers an agent
// (.claude/, CLAUDE.md, hooks) is read from the checkout. The code of the PR is in a worktree at its head, without the
// instruction files Claude Code loads (Pilot 1, T10 and the reviews of ao-sample PR #13). ao-step itself and the kit are
// those of the branch checked out when the command starts; ao-step starts a review or a fix only on a protected branch,
// and goes back to the base of the PR when a command ends with the PR open (checkoutStop, homeBranch in ao-step.mjs).
// The review waived by rule that holds for the PR of a command (C1 spec 3.4), or null; none with /ao-review <PR> full.
function waiverOf({ item, pr }, options) {
  if (options.full || !pr) return null;
  const truncated = Number.isInteger(pr.changedFiles) && Number.isInteger(pr.filesRead) && pr.filesRead < pr.changedFiles;
  return waiverFor({ files: pr.files ?? [], gates: options.gates, label: item?.level ?? null, blockingFound: Boolean(pr.blockingEver), truncated });
}

function reviewRuns(facts, options) {
  // A PR whose review is waived by rule owes none (C1 spec 3.4).
  if (waiverOf(facts, options)) return [];
  const { pr, item } = facts;
  // head: kept in state.json, so a stopped review goes on only on the head it was reviewing (carryOn).
  // Each role its own worktree, so reviewer and security may run at once (C2 spec section 7).
  const place = (role) => ({ checkout: { branch: pr.base, pull: true }, worktree: { name: reviewTree(pr.number, role), sha: pr.headSha }, head: pr.headSha });
  // The roles in the order of stage review of contract/stages.yaml (C1 spec section 6); each knows what it still owes.
  const runs = stageRoles(options.contract, 'review').flatMap((role) => {
    if (!options.roster.roles[role]) throw new Error(`stage review of contract/stages.yaml names ${role}, which is not a role of the roster`);
    return owedReview(role, facts, options, place(role));
  });
  // Neither reads the other's report, so they may run at once when a second agent may start (C2 spec section 7).
  return runs.length > 1 ? runs.map((run) => ({ ...run, together: true })) : runs;
}

// The worktree of a review run of `role` on PR `number`.
const reviewTree = (number, role) => `pr-${number}-${role}`;

// The effective level of the item of a PR command (C1 spec section 2): its label, raised by a critical path, or by a
// Critical or High a review found on the PR.
function levelOf({ item, pr }) {
  return effectiveLevel({ label: item?.level ?? null, tier: pr?.tier ?? null, blockingFound: Boolean(pr?.blockingEver) });
}

// A line on the level of the item, when it is not plain standard: its label, or why it went up; and the lower label the
// agents' account put, which does not count (second review of shop PR #79).
function levelLine(facts, options = {}) {
  const { level, label, reasons } = levelOf(facts);
  const ignored = facts.item?.levelIgnored;
  if (!label && reasons.length === 0 && !ignored) return null;
  const base = `Level of ${facts.item.key}: ${level}${label ? ` (label ${label}${reasons.length ? `; ${reasons.join(', ')}` : ''})` : reasons.length ? ` (${reasons.join(', ')})` : ''}`;
  return ignored ? `${base}. ${ignoredLevelText(ignored, options)}` : base;
}

const ignoredLevelText = ({ label }, options) => {
  const prefix = options.mapping?.work_labels?.level_prefix ?? 'ao-level-';
  const what = label ? `The label ${prefix}${label} was put` : 'Its level label was taken off';
  return `${what} by the agents' Jira account, which your main session uses too, and lowers the level, so it does not count: lower a level on Jira itself`;
};

// The review run `role` still owes on the head of the PR: [] when none, or one run (C1 spec sections 2 and 3). A full
// review runs at the higher of the efforts the level of the item and the tier of the PR ask for, or not at all for
// security on a light or standard item with a PR of tier normal or docs, unless the merge needs its report anyway:
// security reported on the PR before. A review of only the new part runs at high, or at the efforts of a critical PR
// when the new part is critical (Pilot 1, second review of ao-sample PR #13). When the level rose after a role
// reviewed the head at a lower effort, that role reviews the head again at the new one.
function owedReview(role, facts, options, place) {
  const { pr, item } = facts;
  const { gates } = options;
  const rosterEffort = options.roster.roles[role].effort;
  const { level } = levelOf(facts);
  const truncated = Number.isInteger(pr.changedFiles) && Number.isInteger(pr.filesRead) && pr.filesRead < pr.changedFiles;
  const full = () => fullReviewEffort({ role, files: pr.files ?? [], gates, rosterEffort, truncated, level });
  const scope = reviewScope({ role, report: pr.reports[role], full: pr[`${role}Full`], compare: pr[`${role}Compare`], gates });
  if (scope.mode === 'none') {
    const ran = (facts.run?.runs ?? []).findLast((r) => r.role === role && REVIEWS.includes(r.purpose) && r.head === pr.headSha && r.outcome === 'done');
    const { effort } = full();
    const lower = ran && effort && EFFORT_ORDER.includes(ran.effort) && EFFORT_ORDER.indexOf(ran.effort) < EFFORT_ORDER.indexOf(effort);
    if (!lower) return [];
    return [{ role, key: item.key, effort, purpose: 'review', prompt: promptFor('review', { pr: pr.number }), ...place, scope: `the level of ${item.key} rose to ${level} after the ${role} review at ${ran.effort} on this head`, effortWhy: `level ${level}` }];
  }
  const needed = (pr.requiredRoles ?? []).includes(role);
  if (scope.mode === 'delta') {
    const prompt = promptFor('review-delta', { role, pr: pr.number, since: scope.since, at: scope.at, earlier: scope.earlier });
    return [{ role, key: item.key, effort: deltaEffort(role, scope.tier, rosterEffort), purpose: 'review-delta', prompt, ...place, scope: scope.reason }];
  }
  const { effort, reason } = full();
  if (effort === null && !needed) return [];
  const why = effort === null ? `${reason}, but ${role} reported on this PR before, so the merge needs its report` : reason;
  return [{ role, key: item.key, effort: effort ?? 'high', purpose: 'review', prompt: promptFor('review', { pr: pr.number }), ...place, scope: scope.reason, effortWhy: why }];
}

// Why a PR command cannot run on this PR, or null.
function prStop(facts, command, { gates }) {
  const { pr } = facts;
  if (!pr) return stop('fix', `PR #${facts.arg} was not found`, '/ao-status');
  if (pr.state !== 'open') return stop('fix', `PR #${pr.number} is ${pr.merged ? 'merged' : 'closed'}`, facts.item ? `/ao-status ${facts.item.key}` : '/ao-status');
  if (pr.docsEpic) return stop('fix', `PR #${pr.number} is the docs PR of ${pr.docsEpic}: merge-gate merges it after gate ②, with no review`, `/ao-plan ${pr.docsEpic}`);
  if (facts.outside) return stop('fix', `PR #${pr.number} is on ${pr.headRef}, whose item ${facts.outside} is not in ${facts.space}: ao-step works in ${facts.space} only`, '/ao-status');
  if (!facts.item) return stop('fix', `PR #${pr.number} is on ${pr.headRef}, which is not the branch of a work item`, '/ao-status');
  // The repository is public: a fork's branch may share the item's name, and its code is an outsider's (review of shop
  // PR #80). The PR of the item is opened from this repository by ao-dev.
  if (pr.fromFork) return stop('you', `PR #${pr.number} comes from another repository: ao-step reviews and fixes only a branch of this one`, `Close PR #${pr.number} on GitHub, or review it yourself; /ao-status ${facts.item.key}`);
  return baseStop(pr, gates) ?? flaggedStop(facts.item) ?? (command === 'review' && pr.ci.pending ? stop('ci', `CI is still running on the head ${pr.headSha.slice(0, 7)} of PR #${pr.number}`, `/ao-review ${pr.number} once CI is done`) : null);
}

// The reviews run on a checkout of the PR's base, whose .claude/ and kit steer the agents. Its author chooses the base
// and can change it after CI has run, so it must be a protected branch, and the one its branch is cut from (Pilot 1,
// review of ao-sample PR #13).
function baseStop(pr, gates) {
  const next = `/ao-review ${pr.number} once its base on GitHub is the branch it was cut from`;
  if (!gates.protected_branches.some((pattern) => matchesGlob(pattern, pr.base))) {
    return stop('fix', `PR #${pr.number} goes into ${pr.base}, which is not a protected branch (${gates.protected_branches.join(', ')}): its review would run on a branch the PR author controls`, next);
  }
  const branch = checkBranch(pr.headRef, { base: pr.base });
  return branch.ok ? null : stop('fix', `PR #${pr.number} goes into ${pr.base}, but ${branch.reason.replace(/, not .*$/, '')}`, next);
}

// /ao-review <PR>: reviewer, then security; it ends at gate ③ with both reports on the head.
function decideReview(facts, options) {
  const lines = facts.item ? [itemLine(facts)] : [];
  const early = prStop(facts, 'review', options);
  if (early) return { ...early, lines };
  const { pr } = facts;
  if (pr.ci.failed) return { ...stop('next', `CI is red on the head ${pr.headSha.slice(0, 7)} of PR #${pr.number}`, `/ao-fix ${pr.number}`, { then: { command: 'fix', arg: pr.number } }), lines };
  const carried = carryOn('review', facts, options);
  if (carried) return { ...carried, lines };
  // A draft PR is marked ready first, a script as ao-dev with no agent, and the reviews go on in the same command: you
  // previewed it, or skip the preview by typing /ao-review (human-loop spec 4.6). jira-sync then moves the item.
  if (pr.draft) return go([{ action: 'pr-ready', key: facts.item.key, number: pr.number, continue: true }, ...reviewRuns(facts, options)], lines);
  // A review waived by rule (C1 spec 3.4): its trace on the head in place of the reports, unless you ask for a full
  // review with /ao-review <PR> full. merge-gate and audit work the rule out again.
  const waiver = waiverOf(facts, options);
  if (waiver) {
    if (pr.waiverOnHead === waiver.id) return { ...stop('you', `PR #${pr.number} needs no review: every file is in the waiver ${waiver.id}, and ${facts.item.key} is at level ${waiver.level}; the waiver is on the head ${pr.headSha.slice(0, 7)}. It waits for you at gate ③ merge-approval`, `Read the diff of PR #${pr.number}, approve it; merge-gate merges it. To review it anyway: /ao-review ${pr.number} full`), lines };
    return go([{ action: 'review-waiver', key: facts.item.key, number: pr.number, sha: pr.headSha, waiver: waiver.id, level: waiver.level, files: waiver.files }], lines);
  }
  // A kit another project reviewed in full: ao-step posts the reports, with no agent (kit-copy-review spec 2.1). A report
  // an agent already put on the head stays. Any doubt falls through to the review by the agents.
  const { kitCopy } = facts;
  // Its report is a full one, which would clear the findings still open: those go to /ao-fix and the review of the new
  // part, as on any PR (review of ao-pilot PR #24).
  const open = Object.entries(pr.reports).filter(([, report]) => report?.blocking > 0).map(([role, report]) => `${role} ${report.blocking}`);
  if (kitCopy && !kitCopy.ok) lines.push(`Kit review: ${kitCopy.reason}, so the agents review the PR`);
  else if (kitCopy && open.length > 0) lines.push(`Kit review: PR #${pr.number} still has Critical or High findings open (${open.join(', ')}), so the agents review the PR`);
  if (kitCopy?.ok && open.length === 0) {
    const roles = options.gates.github_apps.review.roles.filter((role) => !pr.reports[role]?.onHead);
    if (roles.length > 0) return go([{ action: 'kit-copy-reports', key: facts.item.key, number: pr.number, title: pr.title, sha: pr.headSha, roles, reference: kitCopy.reference, compared: kitCopy.compared }], lines);
  }
  const level = levelLine(facts, options);
  if (level) lines.push(level);
  const runs = reviewRuns(facts, options);
  if (runs.length > 0) return go(runs, lines);
  const quiet = findingsLine(pr);
  return { ...afterReviews(facts), lines: quiet ? [...lines, quiet] : lines };
}

// The environment a merge into the base of `pr` deploys to (release-workflow spec 2.4): develop on Development, a
// release branch on Staging; main on Staging for a hotfix and on Production for a release.
function mergeEnvironment(pr) {
  if (pr.base === 'develop') return 'development';
  if (parseBranch(pr.base)?.kind === 'release') return 'staging';
  if (pr.base === 'main') return parseBranch(pr.headRef)?.kind === 'hotfix' ? 'staging' : 'production';
  return null;
}

// The dev agent of each app of project.yaml by its profile: a back end for be-dev, a front end for fe-dev; an app of
// another profile is left out. apps: the apps of project.yaml.
const BACK_END = ['spring-boot', 'nestjs'];
const FRONT_END = ['nextjs', 'react'];
export function appRolesOf(apps = {}) {
  return Object.fromEntries(Object.entries(apps ?? {}).flatMap(([name, app]) => {
    if (BACK_END.includes(app?.profile)) return [[name, 'be-dev']];
    if (FRONT_END.includes(app?.profile)) return [[name, 'fe-dev']];
    return [];
  }));
}

// The dev agent of the app a path is in, by appRoles of project.yaml ({ api: 'be-dev', user: 'fe-dev' }), or null for a
// path outside apps/<app>/ or an app it does not name.
function appRoleOf(where, appRoles = {}) {
  const match = /^`?apps\/([^/`]+)\//.exec(String(where ?? '').trim());
  return match ? (appRoles[match[1]] ?? null) : null;
}

// The findings of the reports on the head that do not block (C1 spec section 4), or null: they open no round of fixes,
// and wait for the findings Task of the Epic, unless you ask for a fix now. A Medium with no repro counts as Low.
function findingsLine(pr) {
  const parts = Object.entries(pr?.reports ?? {}).flatMap(([role, report]) => {
    if (!report?.onHead || !report.counts) return [];
    const kinds = ['Medium', 'Low'].filter((severity) => report.counts[severity] > 0).map((severity) => `${report.counts[severity]} ${severity}`);
    if (kinds.length === 0) return [];
    const why = report.counts.downgraded > 0 ? ` (${report.counts.downgraded} Medium counted as Low: no "Tái hiện:" line)` : '';
    return [`${role} ${kinds.join(', ')}${why}`];
  });
  return parts.length > 0 ? `Findings that do not block: ${parts.join('; ')}. They open no round of fixes; to fix one now: /ao-fix ${pr.number} <what to fix>` : null;
}

// Both reports are on the head: a blocking finding goes back to the dev agent, otherwise you approve. qaRunning: the
// qa runs that hold a lock now, [{ key, environment, pid }]. Approving while one tests the environment the merge
// deploys to makes merge-gate merge and the deployer deploy, and ao-step then stops that QA as superseded, to start
// again (Pilot 3, SHOP-28 and SHOP-69 of shop): the stop says to wait.
function afterReviews({ pr, qaRunning = [] }) {
  const open = Object.entries(pr.reports).filter(([, report]) => report?.blocking > 0);
  const blocking = open.map(([role, report]) => `${role} ${report.blocking}${report.ids?.length ? `: ${report.ids.join(' ')}` : ''}`);
  // A High may be accepted rather than fixed (Pilot 3, spec 2.9 part 5): say how, with the ids to name.
  const accept = open.some(([, report]) => report.ids?.length) ? `. To accept a High instead of fixing it, approve PR #${pr.number} on its head with one line per finding: Accept risk: <id> until <YYYY-MM-DD>: <why> (docs/quality-gates.md)` : '';
  if (blocking.length > 0 || pr.changesRequested) return stop('next', `the reports on the head of PR #${pr.number} ask for changes${blocking.length ? ` (Critical or High: ${blocking.join(', ')})` : ''}${accept}`, `/ao-fix ${pr.number}`, { then: { command: 'fix', arg: pr.number } });
  const yours = pr.protectedPaths.length > 0 ? `, then Squash and merge it yourself: it changes ${pr.protectedPaths.join(', ')}` : '; merge-gate merges it';
  const environment = mergeEnvironment(pr);
  const testing = environment ? qaRunning.find((lock) => lock.environment === environment) : null;
  // merge-gate waits while that QA marks the commit with ao/qa (C2 spec section 9): you approve when you like.
  const wait = testing ? `. qa is testing ${testing.key} on ${environment} now (process ${testing.pid}): merge-gate merges after it ends, so the deploy does not cut it` : '';
  const read = `ead the reports and the diff of PR #${pr.number}, approve it${yours}`;
  // A PR of tier normal or docs needs the reviewer only (C1 spec 3.1): say why security did not run.
  const roles = pr.requiredRoles ?? Object.keys(pr.reports);
  const which = roles.length === 1 ? `the ${roles[0]} report is on the head ${pr.headSha.slice(0, 7)} of PR #${pr.number}, which needs no other (tier ${pr.tier ?? 'normal'}: no sensitive or critical path)` : `both reports are on the head ${pr.headSha.slice(0, 7)} of PR #${pr.number}`;
  return stop('you', `${which}: it waits for you at gate ③ merge-approval${wait}`, `R${read}`);
}

// /ao-fix <PR> [what to fix]: the dev agent of the item, then the reviews again.
function decideFix(facts, options) {
  const devRoles = devOrder(options);
  const lines = facts.item ? [itemLine(facts)] : [];
  const early = prStop(facts, 'fix', options);
  if (early) return { ...early, lines };
  const { pr, item } = facts;
  const carried = carryOn('fix', facts, { ...options, answers: undefined });
  if (carried) return { ...carried, lines };
  const asked = options.note?.trim() || undefined;
  const reasons = [];
  if (pr.changesRequested) reasons.push(`the changes requested on ${pr.headSha.slice(0, 7)}`);
  if (pr.ci.failed) reasons.push(`the red CI on ${pr.headSha.slice(0, 7)}`);
  for (const [role, report] of Object.entries(pr.reports)) if (report?.onHead && report.blocking > 0) reasons.push(`the ${report.blocking} Critical or High findings of the ${role} report`);
  // Who fixes what is not yours to say: the dev agent of the item, or the last one of a split Story.
  const own = devRoles.includes(item.agent) ? item.agent : (item.role ?? [...item.subtasks].sort((a, b) => devRoles.indexOf(a.role) - devRoles.indexOf(b.role)).at(-1)?.role);
  // A Story with a BE and an FE Sub-task (Pilot 3, PR #62 of shop: CI was red only in apps/user, and be-dev, the Agent
  // of the Story, got the fix): a blocking finding goes to the dev agent of the app its Where is in, by the profiles of
  // project.yaml (options.appRoles); a red CI without your request stops, since ao-step cannot tell which side broke it.
  const subRoles = new Set(item.subtasks.map(({ role }) => role));
  const twoSided = subRoles.has('be-dev') && subRoles.has('fe-dev');
  if (twoSided && !asked && pr.ci.failed) {
    return { ...stop('you', `CI is red on PR #${pr.number}, and ${item.key} has a BE and an FE Sub-task: /ao-fix does not guess which side broke it`, `Read the failed job (gh run view --log-failed), then /ao-fix ${pr.number} be: … or fe: …, with what to fix`), lines };
  }
  const blockingWhere = Object.values(pr.reports).filter((report) => report?.onHead && report.blocking > 0).flatMap((report) => (report.open ?? []).map(({ where }) => where));
  const bySide = twoSided ? [...new Set(blockingWhere.map((where) => appRoleOf(where, options.appRoles)).filter(Boolean))] : [];
  // With your request on such a Story, its be: and fe: parts say who works; the reasons add no one else.
  const fixers = bySide.length > 0 ? bySide : twoSided && asked ? [] : own ? [own] : [];
  // Your request, split by be: and fe: (human-loop spec 4.4). Without a prefix it goes to the item's dev agent, unless
  // the Story has a BE and an FE Sub-task: then it stops, since /ao-fix does not guess.
  let parts = {};
  if (asked) {
    const split = splitNote(asked);
    const sides = new Set(item.subtasks.length > 0 ? item.subtasks.map(({ role }) => role) : [item.role]);
    if (!split.prefixed && sides.has('be-dev') && sides.has('fe-dev')) {
      return { ...stop('you', `your request has no be: or fe:, and ${item.key} has a BE and an FE Sub-task: /ao-fix does not guess who does it`, `Start each part of your request with be: or fe:, then /ao-fix ${pr.number} again`), lines };
    }
    parts = split.prefixed ? split.parts : own ? { [own]: split.text } : {};
  }
  // A part pushed already is not sent again: the done runs of this request since the last one of another request, a fix
  // only when the head moved on since (Pilot 1, PR #4 of ao-sample; review test of 2026-11-07; human-loop spec 4.4).
  const done = new Set();
  if (asked) {
    for (const r of [...(facts.run?.runs ?? [])].reverse().filter((r) => r.command === 'fix' && r.note && (r.purpose === 'fix' || CHANGE_RUNS[r.purpose]))) {
      if (r.note !== noteKey(asked)) break;
      if (r.outcome === 'done' && (r.purpose !== 'fix' || r.head !== pr.headSha)) done.add(`${r.role} ${r.purpose}`);
    }
  }
  const todo = Object.fromEntries(Object.entries(parts).filter(([role]) => !done.has(`${role} fix`)));
  // What the request changes, as you answered (human-loop spec 4.5): ba or sa change the documents first, on the PR.
  const change = asked ? (options.change ?? 'none') : 'none';
  const epic = item.parent && /epic/i.test(item.parent.type) ? item.parent.key : null;
  if (change === 'story' && item.workType !== 'task') return { ...stop('you', `${item.key} is a ${item.type}: only a Task becomes a Story`, `/ao-fix ${pr.number} with what your request really changes`), lines };
  if (change === 'story' && !epic) return { ...stop('you', `Task ${item.key} has no Epic, and a Story needs one with an approved plan`, '/ao-intake with your request, for a small Epic'), lines };
  if (['api', 'epic'].includes(change) && !epic) return { ...stop('you', `${item.key} has no Epic, so no plan or SPEC to change`, `/ao-fix ${pr.number} with --change none, or /ao-intake with your request`), lines };
  const [changer, purpose] = Object.entries(CHANGE_RUNS).map(([p, { role, change: c }]) => (c === change ? [role, p] : null)).find(Boolean) ?? [];
  const first = changer && !done.has(`${changer} ${purpose}`)
    ? [{ role: changer, key: item.key, effort: options.roster.roles[changer].effort, purpose, prompt: promptFor(purpose, { pr: pr.number, key: item.key, branch: pr.headRef, epic, note: asked }), checkout: { branch: pr.headRef, pull: true }, head: pr.headSha, note: noteKey(asked) }]
    : [];
  // Once the change ran for this request, the requests it wrote to ba, ux or sa run next, on the PR branch (spec 2.2).
  const changed = changer && done.has(`${changer} ${purpose}`) ? (facts.run?.runs ?? []).findLast((r) => r.command === 'fix' && r.purpose === purpose && r.note === noteKey(asked) && r.outcome === 'done') : null;
  const follow = changed ? followUpRuns(facts, Date.parse(changed.startedAt ?? 0), options, { branch: pr.headRef, pr: pr.number, extra: { checkout: { branch: pr.headRef, pull: true } } }) : [];
  const roles = devRoles.filter((role) => todo[role] !== undefined || (reasons.length > 0 && fixers.includes(role)));
  if (roles.length === 0 && follow.length > 0) return go(follow, lines);
  if (roles.length === 0) {
    if (reasons.length > 0 && fixers.length === 0) return { ...stop('you', `${item.key} has no dev agent: no Agent value of a dev role, and no role label`, `Ask ba to label ${item.key}, then /ao-fix ${pr.number}`), lines };
    if (pr.ci.pending) return { ...stop('ci', `CI is still running on the head ${pr.headSha.slice(0, 7)} of PR #${pr.number}`, `/ao-fix ${pr.number} once CI is done`), lines };
    // A draft PR has no review yet: you look at it again, or review it (human-loop spec 4.4).
    if (pr.draft) return { ...stop('you', `the draft PR #${pr.number} of ${item.key} has nothing left to fix${asked ? ': your request is pushed' : ''}`, `/ao-preview ${item.key} to look at it again, or /ao-review ${pr.number}`), lines };
    const runs = reviewRuns(facts, options);
    if (runs.length > 0) return go(runs, lines);
    // The stop rule of the fix loop (C1 spec 4.4): with no Critical or High open, Medium and Low wait.
    const quiet = findingsLine(pr);
    return { ...stop('you', `nothing blocks the merge of PR #${pr.number}: no request for changes, no red CI, no Critical or High finding`, afterReviews(facts).next), lines: quiet ? [...lines, quiet] : lines };
  }
  const devs = roles.map((role) => {
    let effort = item.effort ?? options.roster.roles[role].effort;
    if (item.rework >= REWORK_FLOOR.count) effort = atLeast(effort, REWORK_FLOOR.effort);
    const note = todo[role];
    const mine = [...(role === own ? reasons : []), ...(note !== undefined ? ['what the human asks below'] : [])];
    const others = Object.entries(todo).filter(([who]) => who !== role).map(([who, text]) => ({ role: who, text }));
    const criteria = note !== undefined && ['ac', 'story'].includes(change);
    const prompt = promptFor('fix', { pr: pr.number, key: item.key, branch: pr.headRef, reasons: mine, note, others, draft: pr.draft, criteria });
    return { role, key: item.key, effort, purpose: 'fix', prompt, checkout: { branch: pr.headRef, pull: true }, head: pr.headSha, ...(note !== undefined && { note: noteKey(asked) }) };
  });
  if (pr.draft) return go([...first, ...follow, ...devs], lines);
  // A forecast: the reviews run again on the new head, each on the new part or the whole PR, at the effort of its tier
  // (C1 spec section 3); security only when the merge needs its report.
  const later = '(decided after the fix: the new part only, or the whole PR)';
  const reviews = (pr.requiredRoles ?? ['reviewer', 'security']).map((role) => ({ role, key: item.key, effort: role === 'security' ? 'high or max' : 'high or xhigh', purpose: 'review', prompt: later, when: 'the fix is pushed and CI is green' }));
  return go([...first, ...follow, ...devs, ...reviews], lines);
}

// The run before the dev agents for each answer to "what does your request change?" (human-loop spec 4.5): its purpose,
// its role and the --change word. `none` has no such run.
const CHANGE_RUNS = {
  'ac-revise': { role: 'ba', change: 'ac' },
  'api-revise': { role: 'sa', change: 'api' },
  'epic-revise': { role: 'sa', change: 'epic' },
  'to-story': { role: 'ba', change: 'story' },
};
export const CHANGES = ['none', ...Object.values(CHANGE_RUNS).map(({ change }) => change)];

// Which note a fix run was for, kept in state.json: the first 12 hex digits of its SHA-256.
const title = (env) => `${env[0].toUpperCase()}${env.slice(1)}`;
const eight = (sha) => sha.slice(0, 8);
// The deployer gives every deployment the URL of its environment; one without came from another tool (Checkpoint 2:
// the fake deploy.yml of ao-pilot), and qa would test no URL.
const noUrl = (sha, env) => `the deployment of ${eight(sha)} on ${env} has no URL: only the deployer of the kit deploys there with one (spec 2.3)`;

// What the main session checks on an item of level light, from its description: the sections of its template that say
// what done looks like (templates/story.md, task.md, bug.md), one line each; [] when none is found.
const CHECKED = { story: ['Acceptance Criteria', 'Verification'], task: ['Verification'], bug: ['Steps to Reproduce', 'Expected Result'] };
const HEADINGS = ['User Story', 'Acceptance Criteria', 'Dependencies', 'Design', 'Sub-tasks', 'Verification', 'Definition of Ready', 'Goal', 'Technical Checklist', 'Steps to Reproduce', 'Actual Result', 'Expected Result', 'Fields', 'Evidence', 'Example'];
export function lightChecks(description, workType) {
  const lines = String(description ?? '').split('\n').map((line) => line.replace(/^#+\s*/, '').trim());
  const wanted = CHECKED[workType] ?? ['Verification'];
  const out = [];
  let current = null;
  for (const line of lines) {
    if (HEADINGS.includes(line)) current = wanted.includes(line) ? line : null;
    else if (current && line) out.push(`  ${current}: ${line}`);
  }
  return out;
}

// /ao-qa of an item of level light (C1 spec section 2): no qa run. ao-step picks the item up with the CI token and
// prints what to check and where; the main session checks each line on the environment, writes a short report from
// templates/qa-report.md, and gives it with --light-report; ao-step posts it with the CI token, and moves the item
// through QA fail on a FAIL. The guards stay: an Accept needs the PASS report.
function qaLight(facts, options, { env, where, lines }) {
  const { item, qaReport } = facts;
  const key = item.key;
  if (item.state === 'ready-for-qa') return go([{ action: 'qa-light-start', key, continue: true }], lines);
  const report = options.lightReport;
  if (report !== undefined) {
    const result = qaReportResult(report);
    const again = `Write it from .ai-orchestrator/templates/qa-report.md, then /ao-qa ${key} --light-report <file> again`;
    if (!result) return stop('fix', 'the light report has no "# QA report" heading, or no PASS, FAIL or NOT TESTED under "## Result"', again, { lines });
    if (!new RegExp(`^#\\s*QA report:\\s*${key}\\b`, 'm').test(report)) return stop('fix', `the light report is not about ${key}: its heading must read "# QA report: ${key} …"`, again, { lines });
    return go([{ action: 'qa-light-report', key, result, body: report }], lines);
  }
  if (qaReport?.result === 'PASS') return stop('you', `the PASS report of ${key} is on Jira: it waits for you`, `Read it, then click Accept on ${key}`, { lines });
  const checks = lightChecks(facts.description, item.workType);
  return stop('you',
    `${key} is at level light: no qa run. Check each line below on ${env}, then write a short report from templates/qa-report.md`,
    `Check ${key} on ${where}, write .ai/runs/${key}/light-report.md, then /ao-qa ${key} --light-report .ai/runs/${key}/light-report.md`,
    { lines: [...lines, ...(checks.length > 0 ? ['To check:', ...checks] : [`To check: the description of ${key} has no section to check; read it on Jira`])] },
  );
}

// /ao-qa <KEY> (release-workflow spec 2.2, 2.5): qa on the QA environment of the item's route, which must run a release
// that holds the merge of its PR. qa tests the URL of that environment and runs the E2E in a worktree at the commit that
// runs, writes its report and moves the item; Accept stays yours. facts.qa: { environment, running, contains }.
function decideQa(facts, options) {
  const { item, pr, qa } = facts;
  if (item.workType === 'epic') return stop('fix', `${item.key} is an Epic: /ao-qa takes a Story, Task or Bug`, `/ao-status ${item.key}`);
  const flagged = flaggedStop(item);
  if (flagged) return flagged;
  // A qa run the usage limit stopped may have picked the item up already: it goes on from In QA too.
  const last = (facts.run?.runs ?? []).filter((r) => r.command === 'qa' && r.role === 'qa').at(-1);
  const stopped = last && STOPPED.includes(last.outcome) && last.session ? last : null;
  // A qa run stopped because another deploy came during it (parallel-runs spec 5.1) left the item In QA with no report:
  // a new run tests the version that runs now.
  const superseded = last?.outcome === 'superseded';
  // A defect you found (human-loop spec 5.1): before qa runs, and until you Accept after its PASS.
  const asked = options.note?.trim() || undefined;
  const defect = asked && !noteDone(facts, 'qa', 'qa-defect', asked) ? asked : undefined;
  // A NOT TESTED report (a cause outside the code, such as a Bug of the environment) leaves the item In QA. Once you
  // fixed the cause and cleared its flag, --retest makes the whole QA afresh from In QA (Pilot 3, SHOP-20 after SHOP-56),
  // not the road of a defect you found.
  const retest = Boolean(options.retest);
  if (retest && !(item.state === 'in-qa' && facts.qaReport?.result === 'NOT TESTED')) {
    const newest = facts.qaReport ? `its newest QA report is ${facts.qaReport.result}` : 'it has no QA report';
    return stop('fix', `--retest runs QA again only for an item In QA whose newest QA report is NOT TESTED: ${item.key} is ${item.status}, and ${newest}`, nextFor(item, pr));
  }
  // An item of level light has no qa run: the main session checks it, and the command runs again with its report while
  // the item is In QA (C1 spec section 2). An ops Task keeps its own road.
  const { level } = levelOf(facts);
  const light = !item.ops && !defect && !retest && level === 'light';
  const states = stopped || superseded || defect || retest || light ? ['ready-for-qa', 'in-qa'] : ['ready-for-qa'];
  if (!states.includes(item.state)) return stop('fix', `${item.key} is ${item.status}, not Ready for QA`, nextFor(item, pr));
  // An ops Task (kit followups, batch 4 item 14) has no PR and no deploy: qa checks its Verification where it names, from
  // the evidence of devops, with the basic auth and no worktree. No sha: nothing to watch for a new deploy.
  if (item.ops) {
    const opsRun = run('qa', 'qa-ops', { key: item.key }, options, { qa: { environment: null, sha: null, auth: true } });
    if (stopped) return go([{ ...opsRun, effort: stopped.effort ?? opsRun.effort, resume: stopped.session, prompt: resumePrompt(item.key, opsRun.role) }]);
    return go([opsRun]);
  }
  if (!pr?.merged || !pr.mergeCommit) return stop('fix', `PR #${pr?.number ?? '?'} of ${item.key} is not merged`, `/ao-status ${item.key}`);
  // The Medium and Low its review left go to the findings Task of the Epic first (C1 spec section 2).
  const record = findingsStep(facts);
  if (record) return go([record]);
  const env = title(qa.environment);
  if (!qa.running) return stop('deploy', `${env} runs no release yet`, 'Wait for the deployer to run one; its deployments are on GitHub');
  if (!qa.contains) {
    return stop('deploy', `${env} runs ${eight(qa.running.sha)}, which does not hold the merge of PR #${pr.number} (${eight(pr.mergeCommit)}) yet`, `Wait a minute for the deployer, then run /ao-qa ${item.key} again; if its deployment failed, read why on GitHub`);
  }
  if (!qa.running.url) return stop('fix', noUrl(qa.running.sha, env), `/ao-status ${item.key}`);
  // Each public app on its own host (project-scaffold part 2, spec 2.4): its URL for Playwright, from project.yaml.
  const apps = appUrls({ projectText: qa.running.projectText, environment: qa.environment, url: qa.running.url });
  if (apps.problem) return stop('fix', apps.problem, `Make the hosts of ${PROJECT_FILE} and of /etc/ao/deployer.yaml the same, then /ao-qa ${item.key}`);
  if (light) {
    const where = Object.keys(apps.apps).length > 0 ? Object.entries(apps.apps).map(([app, url]) => `${app} ${url}`).join(', ') : qa.running.url;
    return qaLight(facts, options, { env, where, lines: [`${env} runs ${eight(qa.running.sha)}, which holds the merge of PR #${pr.number}`] });
  }
  // A QA again at level standard, after a FAIL: qa checks again only the criteria that failed, and the whole E2E suite
  // (C1 spec section 2). At level heavy, and after a NOT TESTED, it checks every criterion, as before.
  const again = level === 'standard' && !defect && facts.qaReport?.result === 'FAIL' && facts.qaReport.failed?.length > 0 ? { failed: facts.qaReport.failed, at: facts.qaReport.at, id: facts.qaReport.id } : null;
  const auth = qa.environment !== 'production';
  const context = { key: item.key, type: item.type, environment: env, sha: qa.running.sha, url: qa.running.url, pr: pr.number, auth, ...(Object.keys(apps.apps).length > 0 && { apps: apps.apps }), ...(defect && { note: defect, picked: item.state === 'in-qa' }), ...(again && { again }) };
  const qaRun = run('qa', defect ? 'qa-defect' : 'qa', context, options, {
    worktree: { kind: 'qa', name: `${item.key}-qa`, sha: qa.running.sha, install: true },
    env: { E2E_BASE_URL: qa.running.url, ...apps.env },
    qa: { environment: qa.environment, sha: qa.running.sha, auth },
    ...(defect && { note: noteKey(defect) }),
  });
  const lines = [`${env} runs ${eight(qa.running.sha)}, which holds the merge of PR #${pr.number}`];
  // The run goes on in its session, in a new worktree with the same URL and basic auth: carryOn would drop them.
  if (stopped) return go([{ ...qaRun, effort: stopped.effort ?? qaRun.effort, resume: stopped.session, prompt: resumePrompt(item.key, qaRun.role) }], lines);
  const resumed = carryOn('qa', facts, options);
  if (resumed) return resumed;
  // A new expectation: ba adds the criterion on Jira first, and qa then fails it (human-loop spec 5.1). The SPEC follows
  // on the next branch of the item (spec-sync, 5.2).
  if (defect && options.change === 'ac' && !noteDone(facts, 'qa', 'ac-add', defect)) {
    const epic = item.parent && /epic/i.test(item.parent.type) ? item.parent.key : null;
    return go([run('ba', 'ac-add', { key: item.key, epic, note: defect }, options, { checkout: { branch: 'develop', pull: true }, note: noteKey(defect) }), qaRun], lines);
  }
  return go([qaRun], lines);
}

// /ao-release and /ao-release <vX.Y.0> <sha> (release-workflow spec 2.2, 2.6, 6). Without arguments it prints the cut
// point, the items and the release, and stops at gate ④; with the release and the cut point you read, it cuts the
// release branch with a script, as ao-dev, and sets the Fix Versions with the CI token: no agent. The major is yours to
// raise. facts.release: { latestTag, version, commits, cut, included, after, versions, releaseBranches }.
function decideRelease(facts) {
  const r = facts.release;
  const [open] = r.releaseBranches;
  if (open) {
    if (facts.arg && open.name === `release/${facts.arg}`) return stop('you', `${open.name} is open at ${eight(open.sha)}: the deployer puts it on Staging within a minute or two`, `/ao-ship v${open.version}`);
    return stop('you', `${r.releaseBranches.map(({ name }) => name).join(' and ')} ${r.releaseBranches.length > 1 ? 'are' : 'is'} open: ship it before you cut the next release`, `/ao-ship v${open.version}`);
  }
  const since = r.latestTag ?? 'its start';
  if (r.commits === 0) return stop('fix', `no commit on develop since ${since}`, '/ao-status');
  if (!r.cut) {
    const holder = r.after.find(({ state }) => state !== 'done');
    const why = holder ? `${holder.key} (${holder.status}) is not Done, and the items after it wait for it` : 'no item of the space is Done';
    return stop('you', `no cut point on develop since ${since}: ${why}`, '/ao-status');
  }
  const version = facts.arg ?? r.version;
  const nextVersion = nextMinor(version);
  const short = r.cut.sha.slice(0, 7);
  const moved = r.after.filter(({ fixVersions }) => fixVersions.includes(version)).map(({ key }) => key);
  const known = (name) => r.versions.find((v) => v.name === name);
  const cancelled = r.cancelled ?? [];
  const lines = [
    `develop: ${r.commits} commits since ${since}; cut point ${short} "${r.cut.subject}"`,
    `In ${version}: ${r.included.map(({ key }) => key).join(', ')} (Done)`,
    // A Cancelled item does not hold the cut point (lib/release/cut.mjs): you approve its code here, at gate ④.
    ...(cancelled.length > 0 ? [`Cancelled, with code in ${version} and no Fix Version: ${cancelled.map(({ key }) => key).join(', ')}. Revert it on develop first if it should not ship`] : []),
    ...(r.after.length > 0 ? [`After the cut point, for ${nextVersion} or later: ${r.after.map(({ key, status }) => `${key} (${status})`).join(', ')}`] : []),
    ...(moved.length > 0 ? [`Moves from ${version} to ${nextVersion} on Jira: ${moved.join(', ')}`] : []),
    `Fix Versions on Jira: ${[version, nextVersion].map((name) => `${name} (${!known(name) ? 'missing' : known(name).released ? 'released' : 'unreleased'})`).join(', ')}`,
  ];
  const lacking = [version, nextVersion].filter((name) => !known(name) || known(name).released);
  if (facts.arg && facts.arg !== r.version && !isNewMajor(facts.arg, r.version)) return stop('fix', `${facts.arg} is not the next release: that is ${r.version}, or a new major`, `/ao-release ${r.version} ${short}`, { lines });
  if (facts.arg && !(facts.extra?.length >= 7 && r.cut.sha.startsWith(facts.extra))) return stop('fix', `${facts.extra} is not the cut point ${short}: read the list again`, `/ao-release ${version} ${short}`, { lines });
  if (lacking.length > 0) {
    const released = lacking.some((name) => known(name)) ? ', unreleased' : '';
    return stop('you', `gate ④ waits for the Fix Version${lacking.length > 1 ? 's' : ''} ${lacking.join(' and ')} on Jira${released}`, `Create ${lacking.join(' and ')} in Jira (Releases, then Create version), then run /ao-release again`, { lines });
  }
  if (!facts.arg) return stop('you', `gate ④. Read the list, then run /ao-release ${version} ${short}`, `/ao-release ${version} ${short}`, { lines });
  return go([{ action: 'release-cut', key: version, version, nextVersion, sha: r.cut.sha, included: r.included, after: r.after, ...(cancelled.length > 0 && { cancelled }) }], lines);
}

// /ao-ship vX.Y.0 (release-workflow spec 2.7): the full regression of the release on Staging, the notes of devops, then
// a script commits the report and the changelog on release-notes/<version> as ao-dev, waits for merge-gate to merge its
// PR into the release branch (Pilot 3, spec 2.9), and opens the release PR; it ends at gate ⑤, your approval of that PR. Each run of the command goes on from the step still missing. A regression holds for
// a newer head only when the branch changed nothing but those two files since; otherwise it runs again.
// facts.ship: { version, branch, staging, bugs, regression, changedSinceRegression, notes, pr }.
function decideShip(facts, options) {
  if (facts.hotfix) return decideHotfix(facts);
  const s = facts.ship;
  const v = s.version;
  if (!s.branch) return stop('fix', `release/${v} is not open`, '/ao-release');
  if (s.bugs.length > 0) {
    return stop('you', `${s.bugs.length} Bug${s.bugs.length > 1 ? 's' : ''} Critical or High ${s.bugs.length > 1 ? 'are' : 'is'} open with Fix Version ${v}: ${s.bugs.map(({ key, severity }) => `${key} (${severity})`).join(', ')}`, `Fix them on bugfix/<BUG> branches into ${s.branch.name}, through review and gate ③, then run /ao-ship ${v} again`);
  }
  const allowed = [`docs/releases/${v}.md`, 'CHANGELOG.md'];
  const beyond = (s.changedSinceRegression ?? []).filter((file) => !allowed.includes(file));
  const holds = s.regression?.result === 'PASS' && s.changedSinceRegression !== null && beyond.length === 0;
  // The report of this regression is on the branch once the branch changed it since: a regression run again on the
  // head of a branch whose PR is open still needs its report, notes and CHANGELOG committed (T21).
  const reported = (s.changedSinceRegression ?? []).includes(`docs/releases/${v}.md`);
  if (s.pr && holds && reported && s.notes) {
    return stop('you', `gate ⑤: PR #${s.pr.number} of ${s.branch.name} waits for your approval on its head ${eight(s.pr.headSha)}`, `Approve PR #${s.pr.number} on GitHub, without merging it: merge-gate merges it with a merge commit, tags ${v} and merges main back into develop`);
  }
  if (!s.staging) return stop('deploy', 'Staging runs no release yet: wait for the deployer', `/ao-ship ${v}`);
  if (s.staging.sha !== s.branch.sha) return stop('deploy', `Staging runs ${eight(s.staging.sha)}, not the head ${eight(s.branch.sha)} of ${s.branch.name}: wait for the deployer`, `/ao-ship ${v}`);
  if (!s.staging.url) return stop('fix', noUrl(s.staging.sha, 'Staging'), '/ao-status');
  const apps = appUrls({ projectText: s.staging.projectText, environment: 'staging', url: s.staging.url });
  if (apps.problem) return stop('fix', apps.problem, `Make the hosts of ${PROJECT_FILE} and of /etc/ao/deployer.yaml the same, then /ao-ship ${v}`);
  if (s.regression?.result === 'FAIL' && s.regression.sha === s.staging.sha) {
    return stop('you', `the regression of ${v} failed on ${eight(s.regression.sha)}`, `Read the draft Bugs in .ai/runs/${v}/regression-report.md, triage and create the Bugs; once they are fixed on ${s.branch.name}, run /ao-ship ${v} again`);
  }
  const context = { version: v, sha: s.staging.sha, url: s.staging.url, branch: s.branch.name, ...(Object.keys(apps.apps).length > 0 && { apps: apps.apps }) };
  const notes = run('devops', 'release-notes', { key: v, ...context }, options);
  const pr = { action: 'release-pr', key: v, version: v, branch: s.branch.name, regression: holds ? s.regression.sha : s.staging.sha };
  if (!holds) {
    const regression = run('qa', 'regression', { key: v, ...context }, options, {
      worktree: { kind: 'qa', name: `${v}-regression`, sha: s.staging.sha, install: true },
      env: { E2E_BASE_URL: s.staging.url, ...apps.env },
      qa: { environment: 'staging', sha: s.staging.sha, auth: true },
    });
    const why = beyond.length > 0 ? [`${s.branch.name} changed ${beyond.join(', ')} after the regression on ${eight(s.regression.sha)}, so the regression runs again`] : [];
    return go([regression, notes, pr], why);
  }
  if (!s.notes) return go([notes, pr]);
  return go([pr]);
}

// /ao-ship vX.Y.(Z+1), a hotfix (release-workflow spec 2.8): its Bug is Done after QA on Staging, and Staging runs its
// merge on main. A script with your gh login then tags it, asks for it on Production (gate ⑤), and opens the merges of
// main back into develop and the open release branch. No regression: that is the shorter stage hotfix.
// facts.hotfix: { version, production, expected, main, bug, staging, tag, request, releaseBranches }.
function decideHotfix(facts) {
  const h = facts.hotfix;
  const v = h.version;
  if (!h.production) return stop('fix', 'Production runs no tagged release, so there is nothing to patch', '/ao-status');
  // Production runs the newest commit of main: the hotfix, once it went live; right after a release, its merge, no hotfix.
  if (h.production.sha === h.main.sha && h.main.pull?.head?.startsWith('hotfix/')) return stop('fix', `Production runs ${h.production.version} (${eight(h.main.sha)}), the hotfix: nothing is left to ship`, '/ao-status');
  // Its own tag moved the next patch on, so the request comes first (T22).
  if (h.tag?.sha === h.main.sha && h.request?.sha === h.main.sha) return stop('deploy', `${v} is tagged and deployment request #${h.request.id} asks for it on Production: the deployer takes it within a minute or two`, '/ao-status');
  if (v !== h.expected) return stop('fix', `${v} is not the next patch of ${h.production.version} on Production: that is ${h.expected}`, `/ao-ship ${h.expected}`);
  const { pull } = h.main;
  if (!pull?.key || !pull.head.startsWith('hotfix/')) return stop('fix', `main ends with ${eight(h.main.sha)}, ${pull ? `the merge of PR #${pull.number} from ${pull.head}` : 'a commit without a PR'}, not of a hotfix`, '/ao-status');
  if (!h.bug || h.bug.state !== 'done') return stop('you', `${pull.key} is ${h.bug?.status ?? 'not on Jira'}, not Done: QA it on Staging with /ao-qa ${pull.key}, then Accept it`, `/ao-qa ${pull.key}`);
  if (!h.bug.fixVersions.includes(v)) return stop('you', `${pull.key} does not carry the Fix Version ${v}`, `Set the Fix Version of ${pull.key} to ${v} in Jira, then run /ao-ship ${v} again`);
  if (h.tag && h.tag.sha !== h.main.sha) return stop('fix', `the tag ${v} is at ${eight(h.tag.sha)}, not at the hotfix ${eight(h.main.sha)}`, '/ao-status');
  if (h.staging?.sha !== h.main.sha) return stop('deploy', `Staging runs ${h.staging ? eight(h.staging.sha) : 'nothing'}, not the hotfix ${eight(h.main.sha)}: wait for the deployer`, `/ao-ship ${v}`);
  return go(
    [{ action: 'hotfix-ship', key: v, version: v, sha: h.main.sha, backMerges: ['develop', ...h.releaseBranches.map(({ name }) => name)] }],
    [`Production runs ${h.production.version}; ${v} is the hotfix of ${pull.key}, merged as ${eight(h.main.sha)} by PR #${pull.number}, which Staging runs`],
  );
}

// /ao-rollback <environment> [<sha>] (release-workflow spec 2.9, plan decision 5): a deployment request with your gh
// login, for the release that ran there before, or for the commit you name. The deployer checks it again: a rollback
// only to a release that ran there, and on Production the two conditions of spec 2.4.
// facts.rollback: { environment, running, earlier, target, requested }.
function decideRollback(facts) {
  const r = facts.rollback;
  const env = title(r.environment);
  const given = facts.extra !== undefined;
  const target = given ? r.target : r.earlier[0];
  if (!target) return stop('fix', given ? `${facts.extra} is not a commit of the repository` : `${env} has no earlier release that ran there`, '/ao-status');
  if (r.running?.sha === target.sha) return stop('fix', `${env} runs ${eight(target.sha)} already`, '/ao-status');
  if (r.requested?.sha === target.sha) return stop('deploy', `deployment request #${r.requested.id} asks for ${eight(target.sha)} on ${env}: the deployer takes it within a minute or two`, '/ao-status');
  const what = given ? 'the commit you named. The deployer takes the history up to it as read by you' : `the release that ran there before`;
  return go(
    [{ action: 'deploy-request', key: facts.runKey, environment: r.environment, sha: target.sha, rollback: !given }],
    [`${env} runs ${r.running ? eight(r.running.sha) : 'nothing'}; the request asks for ${eight(target.sha)}, ${what}`],
  );
}

// /ao-preview <KEY> [--stop] (human-loop spec 4.3): no agent. ao-step switches the project folder to the PR branch and
// starts the apps of project.yaml, or stops them and goes back to develop. facts.preview: { stop, config, configError,
// active, agentRunning, dirty, busy, install }, read by ao-step from this machine.
function decidePreview(facts, options = {}) {
  const { item, pr, preview: p } = facts;
  const urls = (apps) => apps.map(({ name, url }) => `${name} ${url}`).join(', ');
  // A state, not a stop: --stop ends here once the preview is down, and --go ends on "runs" below (Pilot 3, T4).
  if (p.stop) {
    if (!p.active) return { status: true, lines: ['No preview runs.'], next: '/ao-status' };
    return go([{ action: 'preview-stop', key: p.active.key }], [`The preview of ${p.active.key} runs on ${p.active.branch}: ${urls(p.active.apps)}`]);
  }
  const lines = [itemLine(facts)];
  const key = item.key;
  const out = (decision) => ({ ...decision, lines: [...lines, ...(decision.lines ?? [])] });
  if (item.workType === 'epic' || item.workType === 'sub-task') return out(stop('fix', `${key} is ${item.workType === 'epic' ? 'an Epic' : 'a Sub-task'}: /ao-preview takes the item of a PR`, '/ao-status'));
  if (p.active?.key === key) {
    return { status: true, lines: [...lines, `The preview of ${key} runs on ${p.active.branch}: ${urls(p.active.apps)}`], next: `/ao-preview ${key} --stop, when you are done with it` };
  }
  if (p.active) return out(stop('you', `the preview of ${p.active.key} runs`, `/ao-preview ${p.active.key} --stop, when you are done with it`));
  if (pr?.state !== 'open') return out(stop('fix', `${key} has no open PR to preview`, nextFor(item, pr)));
  // With lanes on, the apps run from the lane of the item (C2 spec section 8).
  if (p.lane && !p.lane.dir) return out(stop('fix', `${key} has no lane: with runs.worktrees on, /ao-preview runs the apps of a PR from the lane of its item, and ${key} was built without one`, `/ao-review ${pr.number}`));
  // Protected paths, and what steers a session at any depth (CLAUDE.md, AGENTS.md, a nested .claude/, .mcp.json…), which
  // Claude Code would load from the folder during the preview (review of ao-sample PR #21; live-run-fixes spec 2.7).
  // A protected path in another case counts too: Windows writes .Claude/ into .claude/ (review of ao-sample PR #21).
  const globs = (options.gates?.protected_paths ?? []).map(({ path }) => path);
  const steering = [...new Set([...pr.protectedPaths, ...(pr.files ?? []).filter((path) => steersPreview(path, globs))])];
  if (steering.length > 0) return out(stop('you', steeringReason(pr.number, steering), `/ao-review ${pr.number}`));
  // GitHub lists at most 3000 files of a PR: a file past them would not be checked (live-run-fixes spec 2.7).
  if (pr.changedFiles != null && (pr.filesRead ?? 0) < pr.changedFiles) {
    return out(stop('you', `GitHub lists ${pr.filesRead ?? 0} of the ${pr.changedFiles} files of PR #${pr.number}, so /ao-preview cannot check each one for a file that steers the agents`, `/ao-review ${pr.number}`));
  }
  // Only a branch of this repository, and only once CI (secrets, sast, policy, tests) passed on its head (review of PR #21).
  if (pr.fromFork) return out(stop('you', `PR #${pr.number} comes from another repository: /ao-preview runs only a branch of this one`, `/ao-review ${pr.number}`));
  if (pr.ci.failed) return out(stop('next', `CI is red on the head of PR #${pr.number}`, `/ao-fix ${pr.number}`, { then: { command: 'fix', arg: pr.number } }));
  if (!pr.ci.green) return out(stop('ci', `CI is still running on the head of PR #${pr.number}`, `/ao-preview ${key} once CI is done`));
  // In a lane, only a run on this item holds it back; the lane's own changes count, not the folder's.
  const where = p.lane ? `the lane of ${key}` : 'the project folder';
  if (p.agentRunning) return out(stop('item', `ao-step is running ${p.agentRunning.command} ${p.agentRunning.arg}${p.lane ? ` on ${key}: its lane is busy` : ': the project folder is busy'}`, `Wait for it to end, then /ao-preview ${key}`));
  if (p.dirty > 0) return out(stop('you', `${where} has changes not committed (${p.dirty} files)`, `Commit them, or put them aside with git stash, then /ao-preview ${key}`));
  if (p.configError) return out(stop('fix', p.configError, `Fix ${PROJECT_FILE}, then /ao-preview ${key}`));
  // A kit copy brings it: ao-kit sync makes it from the preview.yaml the project had (project-scaffold spec 2.1).
  if (!p.config) return out(stop('fix', `the project has no ${PROJECT_FILE}, which says the apps to start`, `Copy the kit again with ao-kit sync, which writes it, or write it as below and in SPEC-project-scaffold.md 2.1; then /ao-preview ${key}`, { lines: PREVIEW_SAMPLE.split('\n') }));
  if (p.busy.length > 0) return out(stop('you', `port ${p.busy.join(', ')} is in use: a server runs there already`, `Stop it, then /ao-preview ${key}`));
  // npm or pnpm, as project.yaml says (project-scaffold part 2, spec 2.1).
  const manager = p.manager ?? 'npm';
  const install = p.lane ? 'the packages of its lane' : p.install ? `${manager === 'npm' ? 'npm ci' : 'pnpm install'} first, since ${lockfileOf(manager)} differs from the one installed` : 'the packages installed are those of the head';
  // The protected paths go with the step: ao-step checks them again on the list of files git gives (spec 2.7).
  return out(go([{ action: 'preview-start', key, number: pr.number, branch: pr.headRef, head: pr.headSha, install: p.install, protected: globs, ...(p.lane && { lane: p.lane.dir }) }], [`Preview of PR #${pr.number}${pr.draft ? ' (draft)' : ''}: ${pr.headRef} at ${eight(pr.headSha)}; ${install}; apps ${urls(p.config)}`]));
}

// /ao-intake (human-loop spec 3.1): no run. The main session interviews you and creates the item itself; the check gives
// it the Epics not done, to see work that is there already, the WIP of epic-shaping, the contract's rule to pick a type,
// and the Jira ids of the Bug fields it fills. facts.intake: { epics, epicShaping, bugFields }.
function decideIntake(facts, { contract, seoApps = [] }) {
  const { epics, epicShaping: { used, limit }, bugFields = {} } = facts.intake;
  const values = (id) => contract.work_item_fields.find((field) => field.id === id);
  const fieldLine = (id) => `${values(id).name} = ${bugFields[id] ?? 'not found on Jira'} (${values(id).values.map(({ name }) => name).join(', ')})`;
  const lines = [
    `Space ${facts.space}. Epics not done: ${epics.length || 'none'}`,
    ...epics.map(({ key, summary, status }) => `  ${key} "${summary}": ${status}`),
    `WIP epic-shaping: ${used} of ${limit} Epics in Specifying or Planning${used >= limit ? '; Start spec on a new Epic waits until one leaves them' : ''}`,
    `How to pick a type: ${contract.work_type_selection}`,
    ...contract.work_item_conventions.map((rule) => `- ${rule}`),
    'Intake makes an Epic, a Task or a Bug, never a Story: a Story needs acceptance criteria in a SPEC, screens and an API contract, which stage spec and plan write. Work the size of one Story is a small Epic',
    `Bug fields: ${fieldLine('found-in')}; ${fieldLine('severity')}`,
    // C1 spec 6.6: a Task or a Bug on a page of these apps gets the label ao-seo, with a request to seo when nobody wrote its SEO part.
    seoApps.length > 0
      ? `Apps with seo: true in project.yaml: ${seoApps.join(', ')}. A Task or a Bug that touches their pages gets the label ao-seo (C1 spec 6.6)`
      : 'Apps with seo: true in project.yaml: none, so no item gets the label ao-seo',
  ];
  return { status: true, lines, next: 'Interview the human, write the draft in .ai/intake/, and create the item once they say OK' };
}

// v(M+1).0.0 when the next release would be vM.N.0.
const isNewMajor = (tag, next) => {
  const [given, expected] = [parseVersion(tag), parseVersion(next)];
  return Boolean(given && expected) && given.major === expected.major + 1 && given.minor === 0 && given.patch === 0;
};

export function noteKey(note) {
  return createHash('sha256').update(note.trim()).digest('hex').slice(0, 12);
}

const DECIDERS = { status: decideStatus, intake: decideIntake, preview: decidePreview, spec: decideSpec, plan: decidePlan, request: decideRequest, build: decideBuild, review: decideReview, fix: decideFix, qa: decideQa, release: decideRelease, ship: decideShip, rollback: decideRollback };
export { DECIDERS };
