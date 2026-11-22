// ao-step watch (Phiên 35 · Lượt 39–41): a watcher of what the kit runs on this machine, with no model. The commands of
// the kit run in the background, where the human sees no log, and a hand-written watcher in T14 of C2 guessed from the
// lock files and reported wrongly 8 times in 23. This one reads the locks, the agent logs and the event log of /ao-run
// every 2 minutes, and the board every 10 and as soon as a command ends, and ends with a report only when there is something new to tell: a process
// gone with its lock, an agent silent too long, a command that stops or waits for the human, an item flagged Needs you.
// Each report wakes the main session, which tells the human and starts it again; while all is well it says nothing,
// so it costs no tokens. What it told is kept in .ai/runs/watch.json, so a new watcher does not tell it again. Pure but
// watchEffects, which takes fs.
import { join } from 'node:path';

export const WATCH = {
  everyMs: 120_000,
  remoteEveryMs: 600_000,
  // An agent may be silent a long time and still be right, as in a Maven build of be-dev.
  quietMs: 20 * 60_000,
  // A command with no agent at the moment waits for something: RAM, its role, the CI of its PR.
  waitFactor: 3,
  // With nothing of the kit running for this long, the watcher ends.
  endMs: 10 * 60_000,
  // Marks kept in watch.json.
  marks: 500,
  // Board reads that fail in a row before it says so.
  boardFailures: 3,
};

const minutes = (ms) => Math.max(0, Math.floor(ms / 60_000));
const labelOf = ({ command, key, role }) => `/ao-${command} ${key}${role ? ` (${role})` : ''}`;

// The event log of /ao-run (lib/workflow/run-command.mjs): "HH:MM text". What is worth telling: a line that waits for
// the human or needs a fix, once per text, since the dispatcher logs the list again whenever it changes; a command that
// ends with a STOP or with no decision; the end of /ao-run. A start, or an end that is done, is progress.
export function eventToTell(line) {
  const text = String(line).replace(/^\d{2}:\d{2} /, '').trim();
  if (/^(?:waiting for you|needs a fix): /.test(text)) return { text, mark: `said:${text}` };
  if (/^end \/ao-\S+ \S+: (?:STOP |it stopped with no decision)/.test(text)) return { text, mark: null };
  if (/^\/ao-run .+ ends: /.test(text)) return { text, mark: null };
  return null;
}

// One look. snapshot:
//   now                 ms
//   locks               the lock files of .ai/runs/active as read: [{ name, command, key, role, pid, startedAt, agent,
//                       changedAt (ms), alive }]
//   logAt(key, role)    the newest write of an agent log of the item, of that role when there is one, in ms, or null
//   dispatcher          .ai/runs/dispatcher.json with alive, or null
//   events              the lines added to the event log of /ao-run since the last look
//   flagged             [{ key, flag }] of the board when it was read this look, else null
//   boardFailed         { count, reason } when the board could not be read, else null
// told: the marks already told. Returns { tell: [line], marks: [mark], running }: running is whether anything of the
// kit runs.
export function look({ now, locks = [], logAt = () => null, dispatcher = null, events = [], flagged = null, boardFailed = null }, told = new Set(), options = {}) {
  const { quietMs, waitFactor, boardFailures } = { ...WATCH, ...options };
  const tell = [];
  const marks = [];
  const say = (line, mark) => {
    if (mark && (told.has(mark) || marks.includes(mark))) return;
    tell.push(line);
    if (mark) marks.push(mark);
  };

  for (const lock of locks) {
    const label = lock.command === 'preview' ? `the preview of ${lock.key}` : labelOf(lock);
    if (!lock.alive) {
      say(`${label}: its process ${lock.pid} is gone and its lock is still there, so it ended without cleaning up: /ao-status ${lock.key}`, `gone:${lock.name}:${lock.pid}`);
      continue;
    }
    // A preview runs the apps and no agent: its quiet is by design.
    if (lock.command === 'preview') continue;
    const started = Date.parse(lock.startedAt ?? '') || 0;
    const log = logAt(lock.key, lock.role ?? null) ?? 0;
    const last = Math.max(started, log, lock.changedAt ?? 0);
    const limit = lock.agent ? quietMs : quietMs * waitFactor;
    if (now - last < limit) continue;
    const quiet = minutes(now - last);
    const line = lock.agent
      ? `${label}: its ${lock.role ?? 'agent'} agent has written no log for ${quiet} min. It may be stuck, or in a long test run: read the newest .ai/runs/${lock.key}/*.jsonl`
      : `${label}: no agent and no log for ${quiet} min. It may wait for RAM, its role or CI, or be stuck: /ao-status ${lock.key}`;
    say(line, `quiet:${lock.name}:${last}`);
  }

  if (dispatcher && !dispatcher.alive) say(`/ao-run ${dispatcher.scope}: its process ${dispatcher.pid} is gone, but it did not end: its commands may still run, with nobody to start the next ones`, `dispatcher:${dispatcher.pid}`);

  for (const line of events) {
    const event = eventToTell(line);
    if (event) say(event.text, event.mark);
  }

  // The kind of the flag only: its comment may be an agent's, and stays on Jira.
  for (const { key, flag } of flagged ?? []) say(`${key} is flagged Needs you${flag ? ` (${flag})` : ''}: read its newest flag comment, /ao-status ${key}`, `flag:${key}:${flag ?? ''}`);
  if (!flagged && boardFailed && boardFailed.count >= boardFailures) say(`the board could not be read${boardFailed.count > 1 ? ` ${boardFailed.count} times in a row` : ''}: ${boardFailed.reason}`, `board:${boardFailed.since}`);

  const running = locks.some(({ alive }) => alive) || Boolean(dispatcher?.alive);
  return { tell, marks, running };
}

// Whether to read the board this look: every remoteEveryMs, and as soon as a command ends, since an agent flags its
// item as its command ends (SHOP-85 of shop: two flags taken off within minutes were never read). before, after: the
// names of the live locks at the last look and now.
export function boardDue({ now, lastBoard, before = [], after = [] }, { remoteEveryMs } = WATCH) {
  if (now - lastBoard >= remoteEveryMs) return true;
  return before.some((name) => !after.includes(name));
}

// What runs now, for ao-step watch --once: one line per lock and for the dispatcher.
export function nowLines({ now, locks = [], logAt = () => null, dispatcher = null }) {
  const lines = locks.map((lock) => {
    if (lock.command === 'preview') return `the preview of ${lock.key}: ${lock.alive ? 'runs' : `process ${lock.pid} is gone`}`;
    if (!lock.alive) return `${labelOf(lock)}: process ${lock.pid} is gone`;
    const log = logAt(lock.key, lock.role ?? null);
    const since = Date.parse(lock.startedAt ?? '');
    const age = Number.isNaN(since) ? '' : `, ${minutes(now - since)} min`;
    return `${labelOf(lock)}${age}, ${lock.agent ? 'agent running' : 'no agent now'}, ${log && log >= since ? `last log ${minutes(now - log)} min ago` : 'no log yet'}`;
  });
  if (dispatcher) lines.push(`/ao-run ${dispatcher.scope}: ${dispatcher.alive ? `runs (process ${dispatcher.pid})` : `process ${dispatcher.pid} is gone`}`);
  return lines.length > 0 ? lines : ['nothing of the kit runs'];
}

// The state of the watcher, .ai/runs/watch.json: { told: [mark], offsets: { <log file>: lines read } }. A new state
// starts at the end of every event log, so old lines are not told.
export function readWatchState(text, logLines) {
  try {
    const state = JSON.parse(text);
    if (Array.isArray(state.told) && state.offsets && typeof state.offsets === 'object') return state;
  } catch {
    // a new state below
  }
  return { told: [], offsets: { ...logLines } };
}

export const nextWatchState = (state, { marks = [], offsets = state.offsets }, keep = WATCH.marks) => ({ told: [...state.told, ...marks].slice(-keep), offsets });

// The files the watcher reads, from the project folder: fs { existsSync, readdirSync, readFileSync, statSync }, alive(pid).
export function watchEffects({ projectDir, fs, alive }) {
  const runsDir = join(projectDir, '.ai', 'runs');
  const activeDir = join(runsDir, 'active');
  const eventDir = join(runsDir, '_run');
  const readJson = (file) => {
    try {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
      return null;
    }
  };
  const list = (dir) => (fs.existsSync(dir) ? fs.readdirSync(dir) : []);
  return {
    stateFile: join(runsDir, 'watch.json'),
    // The locks as they are, a dead one too: the watcher tells it, and leaves it to the next command to remove.
    locks: () =>
      list(activeDir)
        .filter((name) => name.endsWith('.json'))
        .map((name) => {
          const file = join(activeDir, name);
          const lock = readJson(file);
          if (!lock) return null;
          let changedAt = 0;
          try {
            changedAt = fs.statSync(file).mtimeMs;
          } catch {
            // gone since the list
          }
          return { ...lock, name: name.slice(0, -'.json'.length), changedAt, alive: alive(lock.pid) };
        })
        .filter(Boolean),
    // Logs are named <n>-<role>.jsonl (lib/workflow/runner.mjs).
    logAt: (key, role) => {
      const dir = join(runsDir, key);
      const times = list(dir)
        .filter((name) => name.endsWith(role ? `-${role}.jsonl` : '.jsonl'))
        .map((name) => {
          try {
            return fs.statSync(join(dir, name)).mtimeMs;
          } catch {
            return 0;
          }
        });
      return times.length > 0 ? Math.max(...times) : null;
    },
    dispatcher: () => {
      const record = readJson(join(runsDir, 'dispatcher.json'));
      return record ? { ...record, alive: alive(record.pid) } : null;
    },
    // Every event log and how many lines it has.
    logLines: () => Object.fromEntries(list(eventDir).filter((name) => name.endsWith('.log')).map((name) => [name, lines(fs.readFileSync(join(eventDir, name), 'utf8')).length])),
    // The lines added since offsets, and the offsets after them.
    newEvents: (offsets) => {
      const events = [];
      const after = { ...offsets };
      for (const name of list(eventDir).filter((file) => file.endsWith('.log')).sort()) {
        const all = lines(fs.readFileSync(join(eventDir, name), 'utf8'));
        const from = offsets[name] ?? 0;
        events.push(...all.slice(from));
        after[name] = all.length;
      }
      return { events, offsets: after };
    },
  };
}

const lines = (text) => String(text).split('\n').filter((line) => line.trim() !== '');
