// The dispatcher /ao-run (C2 spec section 5): plain code, no model. Each round it reads the board, takes the next command
// of each item in its scope (nextCommand), asks decideStep whether that command would run (decide: a dry run of
// ao-step), and starts what admit lets start, the work nearest its end first. It stops at every STOP that waits for
// you, and lists those. Pure, but runDispatcher, whose effects are parameters:
//   readBoard()               { items, pulls }: the items of the space in the order of the board, and the open PRs
//   readLocks()               the locks of the ao-step commands that run now (lib/workflow/locks.mjs)
//   decide(command, arg)      the decision of ao-step <command> <arg> without --go
//   start({ command, arg })   runs ao-step <command> <arg> --go; resolves its last decision, or null when it crashed
//   spent()                   the USD of the runs it started so far
//   stopAsked()               --stop was asked
//   now(), sleep(ms), log(line)
import { admit } from './locks.mjs';
import { nextCommand, runnableRequest } from './steps.mjs';

// The work nearest its end first (spec 5.2, step 3).
export const PRIORITY = ['qa', 'review', 'fix', 'build', 'request', 'plan', 'spec'];
// The commands that run alone: they need the project folder (parallel-runs spec 5.1).
export const ALONE = ['spec', 'plan', 'request'];
// A command started this many times on one item in one /ao-run is not started again: it does not move the item on.
export const MAX_STARTS = 5;
const PROJECT = '_project';
const SHAPING = ['specifying', 'planning'];

// The items of a scope: { epic } is the Epic and its Stories, Tasks and Bugs; { keys } the items named. Sub-tasks go
// with their Story, whose command runs them.
export function scopeOf(items, scope) {
  const inside = (item) => (scope.epic ? item.key === scope.epic || item.parent === scope.epic : scope.keys.includes(item.key));
  return items.filter((item) => item.workType !== 'sub-task' && inside(item));
}

const name = ({ command, arg }) => `${command} ${arg}`;

// One round: { start, waiting, done }. start: the commands to start now, [{ key, command, arg, role, environment }];
// waiting: what holds the others, [{ key, waits, text, reason? }] in the order of the board; done: no item of the scope
// has work left. live: the locks that run now; failed: the commands that failed in this /ao-run; starts: how many times
// each was started.
export async function planRound({ items, pulls = [], scope, live = [], cap, decide, failed = new Set(), starts = new Map(), agentsPerRole = {} }) {
  const inScope = scopeOf(items, scope);
  const prOf = new Map(pulls.map(({ key, number, draft }) => [key, { number, draft, state: 'open' }]));
  const busy = new Set(live.map(({ key }) => key));
  const waiting = [];
  const candidates = [];
  const tired = (command) => failed.has(name(command)) || (starts.get(name(command)) ?? 0) >= MAX_STARTS;
  const tiredText = (command, key) => `${name(command)} ${failed.has(name(command)) ? 'failed in this run' : `started ${MAX_STARTS} times in this run`}: /ao-status ${key}`;
  inScope.forEach((item, rank) => {
    const step = nextCommand(item, prOf.get(item.key) ?? null);
    // An open request to an adviser goes first, by /ao-request; on an Epic in spec or plan, /ao-spec and /ao-plan take it.
    const asked = !(item.workType === 'epic' && SHAPING.includes(item.state)) && (item.requests ?? []).some(runnableRequest);
    if (asked) candidates.push({ key: item.key, command: 'request', arg: item.key, rank });
    else if (step.command) candidates.push({ key: item.key, command: step.command, arg: step.arg, rank });
    // An Epic In Progress waits for its items, which are in the scope too.
    else if (step.waits && !(item.workType === 'epic' && item.state === 'in-progress')) waiting.push({ key: item.key, waits: step.waits, text: step.text, rank });
  });
  const open = inScope.filter((item) => !nextCommand(item, prOf.get(item.key) ?? null).done);
  const done = open.every((item) => item.workType === 'epic' && item.state === 'in-progress');

  const runnable = [];
  candidates.sort((a, b) => PRIORITY.indexOf(a.command) - PRIORITY.indexOf(b.command) || a.rank - b.rank);
  for (const candidate of candidates) {
    if (busy.has(candidate.key)) continue;
    if (tired(candidate)) {
      waiting.push({ key: candidate.key, waits: 'fix', text: tiredText(candidate, candidate.key), rank: candidate.rank });
      continue;
    }
    let chosen = { command: candidate.command, arg: candidate.arg };
    let decision = await decide(chosen.command, chosen.arg);
    // A STOP that hands the item to another command is asked again as that command: its own checks decide (plan, risks).
    if (!decision.go && decision.waits === 'next' && decision.then) {
      chosen = { command: decision.then.command, arg: decision.then.arg };
      if (tired(chosen)) {
        waiting.push({ key: candidate.key, waits: 'fix', text: tiredText(chosen, candidate.key), rank: candidate.rank });
        continue;
      }
      decision = await decide(chosen.command, chosen.arg);
    }
    if (decision.go) {
      const [first = {}] = decision.runs ?? [];
      runnable.push({ key: candidate.key, ...chosen, role: first.role ?? null, environment: first.qa?.environment ?? first.environment ?? null, rank: candidate.rank });
    } else {
      waiting.push({ key: candidate.key, waits: decision.waits ?? 'fix', text: decision.next ?? '', reason: decision.reason, rank: candidate.rank });
    }
  }

  const start = [];
  if (!live.some((lock) => lock.name === PROJECT)) {
    // A command that runs alone starts once nothing runs, and nothing new starts while it waits, so it never waits
    // for ever (spec 5.2, step 5).
    const alone = runnable.find(({ command }) => ALONE.includes(command));
    if (alone) {
      if (live.length === 0) start.push(alone);
    } else {
      const taken = [...live];
      for (const next of runnable) {
        const admitted = admit({ live: taken, command: next.command, key: next.key, role: next.role, environment: next.environment, cap, agentsPerRole });
        if (!admitted.ok) {
          waiting.push({ key: next.key, waits: 'item', text: admitted.reason, rank: next.rank });
          continue;
        }
        start.push(next);
        taken.push({ name: next.key, command: next.command, key: next.key, role: next.role, environment: next.environment, slot: admitted.slot, pid: 0 });
      }
    }
  }
  const strip = ({ rank, ...rest }) => rest;
  waiting.sort((a, b) => a.rank - b.rank);
  return { start: start.map(strip), waiting: waiting.map(strip), done };
}

// The loop (spec 5.2–5.4): a round, then wait until a command ends or pollMs passes. It ends when the scope is done,
// when nothing could start for idleMs, or, once its commands have ended, at the budget, the usage limit or --stop.
// Resolves { reason, waiting }: reason is done, idle, budget, usage or stop; waiting the lines that wait for you.
// report({ running, spent }), once a round, keeps what /ao-status says of the dispatcher (optional).
export async function runDispatcher({ scope, cap, agentsPerRole = {}, budgetUsd, idleMs, pollMs = 120000, readBoard, readLocks, decide, start, spent, stopAsked, now, sleep, log, report = () => {} }) {
  const running = new Map();
  const failed = new Set();
  const starts = new Map();
  let usage = false;
  let idleSince = null;
  let shown = null;
  for (;;) {
    const board = await readBoard();
    const locks = readLocks();
    // Its own commands count from the moment they start, before they take their locks.
    const own = [...running.values()].filter(({ key }) => !locks.some((lock) => lock.key === key)).map(({ key, command, role, environment }) => ({ name: key, key, command, role, environment, slot: -1, pid: 0 }));
    const round = await planRound({ ...board, scope, live: [...locks, ...own], cap, decide, failed, starts, agentsPerRole });
    const yours = round.waiting.filter(({ waits }) => waits === 'you').map(({ key, text }) => `${key}: ${text}`);
    // A stop that waits for a fix holds its item until someone acts too, such as Docker not running for be-dev.
    const fixes = round.waiting.filter(({ waits }) => waits === 'fix').map(({ key, reason, text }) => `${key}: ${reason ?? text}`);
    const lines = [...yours.map((line) => `waiting for you: ${line}`), ...fixes.map((line) => `needs a fix: ${line}`)];
    if (lines.join('\n') !== shown) {
      for (const line of lines) log(line);
      shown = lines.join('\n');
    }
    const halt = stopAsked() ? 'stop' : usage ? 'usage' : spent() >= budgetUsd ? 'budget' : null;
    if (!halt) {
      for (const next of round.start) {
        const id = name(next);
        starts.set(id, (starts.get(id) ?? 0) + 1);
        log(`start /ao-${next.command} ${next.arg}`);
        const ended = (result) => {
          running.delete(id);
          if (!result) {
            failed.add(id);
            log(`end /ao-${next.command} ${next.arg}: it stopped with no decision`);
            return;
          }
          if (result.waits === 'usage') usage = true;
          if (result.waits === 'fix') failed.add(id);
          log(`end /ao-${next.command} ${next.arg}: ${result.go ? 'done' : `STOP ${result.reason}`}`);
        };
        running.set(id, { ...next, promise: Promise.resolve(start(next)).then(ended, () => ended(null)) });
      }
    }
    report({ running: [...running.keys()].map((id) => `/ao-${id}`), spent: spent() });
    if (running.size === 0) {
      if (halt) return { reason: halt, waiting: yours };
      if (round.done) return { reason: 'done', waiting: yours };
      idleSince ??= now();
      if (now() - idleSince >= idleMs) return { reason: 'idle', waiting: yours };
    } else {
      idleSince = null;
    }
    await Promise.race([...[...running.values()].map(({ promise }) => promise), sleep(pollMs)]);
  }
}
