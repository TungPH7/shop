// ao-step watch (Phiên 35 · Lượt 39–41): a watcher of what the kit runs on this machine, with no model. The commands of
// the kit run in the background, where the human sees no log, and a hand-written watcher in T14 of C2 guessed from the
// lock files and reported wrongly 8 times in 23. This one reads the locks, the agent logs and the event log of /ao-run
// every 2 minutes, and the board every 10 and as soon as a command ends, and ends with a report only when there is
// something new to tell: a process gone with its lock, an agent silent too long, a command that stops or waits for the
// human, an item flagged Needs you. Each report wakes the main session, which tells the human and starts it again;
// while all is well it says nothing, so it costs no tokens. What it told is kept in .ai/runs/watch.json, so a new
// watcher does not tell it again.
//
// Every agent can write the files it reads (review of shop PR #92, security): the event log, the locks, the record of
// the dispatcher, the agent logs. The main session, which holds your rights, tells you what the watcher prints, with the
// command to type. So the watcher prints only sentences of its own, made of a key, a command, a role or a tool name it
// reads by a strict pattern, and never a word of those files. Pure but watchEffects, which takes fs.
import { createHash } from 'node:crypto';
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

// What the watcher prints from the files: only what reads as one of these.
const KEY = /^[A-Z][A-Z0-9]{0,9}-\d{1,7}$/;
const PR = /^\d{1,7}$/;
const COMMANDS = ['intake', 'status', 'preview', 'spec', 'plan', 'request', 'build', 'review', 'fix', 'qa', 'release', 'ship', 'rollback', 'run'];
const ROLE = /^[a-z][a-z-]{0,19}$/;
const TOOL = /^[A-Za-z][\w.-]{0,63}$/;
const keyOf = (value) => (KEY.test(String(value ?? '')) ? String(value) : null);
const commandOf = (value) => (COMMANDS.includes(value) ? value : null);
const pidOf = (value) => (Number.isInteger(value) && value > 0 ? value : '?');
const statusOf = (key) => (key ? `/ao-status ${key}` : '/ao-status');
const hash = (text) => createHash('sha256').update(String(text)).digest('hex').slice(0, 16);

const minutes = (ms) => Math.max(0, Math.floor(ms / 60_000));
function labelOf({ command, key, role }) {
  const k = keyOf(key);
  return `/ao-${commandOf(command) ?? '?'} ${k ?? '(a key that cannot be read)'}${ROLE.test(String(role ?? '')) ? ` (${role})` : ''}`;
}
// The scope of /ao-run: one key or more, else nothing.
const scopeOf = (scope) => {
  const keys = String(scope ?? '').split(' ');
  return keys.length > 0 && keys.every((key) => KEY.test(key)) ? ` ${keys.join(' ')}` : '';
};

// How /ao-run ended, from the reasons of ao-step.mjs (END).
const ENDS = [
  [/budget/, 'budget'],
  [/usage limit/, 'usage limit'],
  [/--stop asked/, '--stop'],
  [/nothing to start/, 'idle'],
];

// The event log of /ao-run (lib/workflow/run-command.mjs): "HH:MM text". What is worth telling: a line that waits for
// the human or needs a fix, once per text, since the dispatcher logs the list again whenever it changes; a command that
// ends with a STOP or with no decision; the end of /ao-run. A start, or an end that is done, is progress. Returns
// { text, mark } in the watcher's words, or null.
export function eventToTell(line) {
  const text = String(line).replace(/^\d{2}:\d{2} /, '').trim();
  const asks = /^(waiting for you|needs a fix): (\S+?):/.exec(text) ?? /^(waiting for you|needs a fix): /.exec(text);
  if (asks) {
    const key = keyOf(asks[2]);
    const what = asks[1] === 'waiting for you' ? 'waits for you' : 'needs a fix';
    return { text: `${key ?? 'a line of the /ao-run log'} ${what}: ${statusOf(key)}`, mark: `said:${hash(text)}` };
  }
  const ended = /^end \/ao-(\S+) (\S+): (STOP |it stopped with no decision)/.exec(text);
  if (ended) {
    const command = commandOf(ended[1]);
    const arg = keyOf(ended[2]) ?? (PR.test(ended[2]) ? ended[2] : null);
    if (!command || !arg) return { text: 'a command of /ao-run stopped: /ao-status', mark: null };
    return { text: `/ao-${command} ${arg} stopped${ended[3] === 'STOP ' ? '' : ' with no decision'}: ${statusOf(keyOf(arg))}`, mark: null };
  }
  if (/^\/ao-run .+ ends: /.test(text)) {
    const kind = ENDS.find(([pattern]) => pattern.test(text))?.[1] ?? 'done';
    return { text: `/ao-run ended (${kind}): /ao-status`, mark: null };
  }
  return null;
}

// One look. snapshot:
//   now                 ms
//   locks               the lock files of .ai/runs/active as read: [{ name, command, key, role, pid, startedAt, agent,
//                       changedAt (ms), alive }]
//   logAt(key, role)    the newest write of an agent log of the item, of that role when there is one, in ms, or null
//   lastTool(key, role) the last call of that log: { name, at }, or null
//   dispatcher          .ai/runs/dispatcher.json with alive, or null
//   events              the lines added to the event log of /ao-run since the last look
//   flagged             [{ key, flag }] of the board when it was read this look, else null
//   boardFailed         { count, reason } when the board could not be read, else null
// told: the marks already told. Returns { tell: [line], marks: [mark], forget: [mark], running }: forget, the marks of
// flags the board no longer shows, so the next flag of the item is told again; running, whether anything of the kit
// runs.
export function look({ now, locks = [], logAt = () => null, lastTool = () => null, dispatcher = null, events = [], flagged = null, boardFailed = null }, told = new Set(), options = {}) {
  const { quietMs, waitFactor, boardFailures } = { ...WATCH, ...options };
  const tell = [];
  const marks = [];
  const say = (line, mark) => {
    if (mark && (told.has(mark) || marks.includes(mark))) return;
    tell.push(line);
    if (mark) marks.push(mark);
  };

  for (const lock of locks) {
    const key = keyOf(lock.key);
    const label = lock.command === 'preview' ? `the preview of ${key ?? '(a key that cannot be read)'}` : labelOf(lock);
    if (!lock.alive) {
      say(`${label}: its process ${pidOf(lock.pid)} is gone and its lock is still there, so it ended without cleaning up: ${statusOf(key)}`, `gone:${hash(lock.name)}:${pidOf(lock.pid)}`);
      continue;
    }
    // A preview runs the apps and no agent: its quiet is by design.
    if (lock.command === 'preview') continue;
    const role = ROLE.test(String(lock.role ?? '')) ? lock.role : null;
    const started = Date.parse(lock.startedAt ?? '') || 0;
    const log = (key && logAt(key, role)) || 0;
    const last = Math.max(started, log, lock.changedAt ?? 0);
    const limit = lock.agent ? quietMs : quietMs * waitFactor;
    if (now - last < limit) continue;
    const quiet = minutes(now - last);
    let line;
    if (lock.agent) {
      const call = key ? lastTool(key, role) : null;
      const tool = call && (TOOL.test(String(call.name ?? '')) ? call.name : 'a tool');
      const since = call && Number.isFinite(call.at) ? `; its last call, ${tool}, started ${minutes(now - call.at)} min ago` : '';
      line = `${label}: its ${role ?? 'agent'} agent has written no log for ${quiet} min${since}. It may be stuck, or in a long test run: ${statusOf(key)}`;
    } else {
      line = `${label}: no agent and no log for ${quiet} min. It may wait for RAM, its role or CI, or be stuck: ${statusOf(key)}`;
    }
    say(line, `quiet:${hash(lock.name)}:${last}`);
  }

  if (dispatcher && !dispatcher.alive) say(`/ao-run${scopeOf(dispatcher.scope)}: its process ${pidOf(dispatcher.pid)} is gone, but it did not end: its commands may still run, with nobody to start the next ones`, `dispatcher:${pidOf(dispatcher.pid)}`);

  for (const line of events) {
    const event = eventToTell(line);
    if (event) say(event.text, event.mark);
  }

  // The kind of the flag only, which the kit sets: its comment may be an agent's, and stays on Jira.
  const flags = (flagged ?? []).filter(({ key }) => keyOf(key));
  for (const { key, flag } of flags) {
    const kind = ROLE.test(String(flag ?? '')) ? flag : '';
    say(`${key} is flagged Needs you${kind ? ` (${kind})` : ''}: read its newest flag comment, /ao-status ${key}`, `flag:${key}:${kind}`);
  }
  const now_ = new Set(flags.map(({ key, flag }) => `flag:${key}:${ROLE.test(String(flag ?? '')) ? flag : ''}`));
  const forget = flagged ? [...told].filter((mark) => mark.startsWith('flag:') && !now_.has(mark)) : [];
  if (!flagged && boardFailed && boardFailed.count >= boardFailures) say(`the board could not be read${boardFailed.count > 1 ? ` ${boardFailed.count} times in a row` : ''}: ${boardFailed.reason}`, `board:${boardFailed.since}`);

  const running = locks.some(({ alive }) => alive) || Boolean(dispatcher?.alive);
  return { tell, marks, forget, running };
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
    const key = keyOf(lock.key);
    if (lock.command === 'preview') return `the preview of ${key ?? '(a key that cannot be read)'}: ${lock.alive ? 'runs' : `process ${pidOf(lock.pid)} is gone`}`;
    if (!lock.alive) return `${labelOf(lock)}: process ${pidOf(lock.pid)} is gone`;
    const log = key ? logAt(key, ROLE.test(String(lock.role ?? '')) ? lock.role : null) : null;
    const since = Date.parse(lock.startedAt ?? '');
    const age = Number.isNaN(since) ? '' : `, ${minutes(now - since)} min`;
    return `${labelOf(lock)}${age}, ${lock.agent ? 'agent running' : 'no agent now'}, ${log && log >= since ? `last log ${minutes(now - log)} min ago` : 'no log yet'}`;
  });
  if (dispatcher) lines.push(`/ao-run${scopeOf(dispatcher.scope)}: ${dispatcher.alive ? `runs (process ${pidOf(dispatcher.pid)})` : `process ${pidOf(dispatcher.pid)} is gone`}`);
  return lines.length > 0 ? lines : ['nothing of the kit runs'];
}

// The state of the watcher, .ai/runs/watch.json: { told: [mark], offsets: { <log file>: lines read }, sizes: { <log
// file>: its size when read } }. A new state starts at the end of every event log, so old lines are not told.
export function readWatchState(text, logLines) {
  try {
    const state = JSON.parse(text);
    if (Array.isArray(state.told) && state.offsets && typeof state.offsets === 'object') return { ...state, sizes: state.sizes ?? {} };
  } catch {
    // a new state below
  }
  return { told: [], offsets: { ...logLines }, sizes: {} };
}

export const nextWatchState = (state, { marks = [], forget = [], offsets = state.offsets, sizes = state.sizes ?? {} }, keep = WATCH.marks) => ({
  told: [...state.told.filter((mark) => !forget.includes(mark)), ...marks].slice(-keep),
  offsets,
  sizes,
});

// The files the watcher reads, from the project folder: fs { existsSync, readdirSync, readFileSync, statSync, and for
// claim and release writeFileSync, mkdirSync, rmSync }, alive(pid).
export function watchEffects({ projectDir, fs, alive, now = Date.now }) {
  const runsDir = join(projectDir, '.ai', 'runs');
  const activeDir = join(runsDir, 'active');
  const eventDir = join(runsDir, '_run');
  const pidFile = join(runsDir, 'watch-process.json');
  const readJson = (file) => {
    try {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
      return null;
    }
  };
  const list = (dir) => (fs.existsSync(dir) ? fs.readdirSync(dir) : []);
  const sizeOf = (file) => {
    try {
      return fs.statSync(file).size;
    } catch {
      return null;
    }
  };
  // The newest agent log of an item, of that role when there is one: its name, or null.
  const newestLog = (key, role) => {
    const dir = join(runsDir, key);
    let best = null;
    for (const name of list(dir).filter((file) => file.endsWith(role ? `-${role}.jsonl` : '.jsonl'))) {
      let at = 0;
      try {
        at = fs.statSync(join(dir, name)).mtimeMs;
      } catch {
        continue;
      }
      if (!best || at > best.at) best = { name, at };
    }
    return best;
  };
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
          return { ...lock, name: name.slice(0, -'.json'.length), changedAt, alive: Number.isInteger(lock.pid) && alive(lock.pid) };
        })
        .filter(Boolean),
    // Logs are named <n>-<role>.jsonl (lib/workflow/runner.mjs).
    logAt: (key, role) => newestLog(key, role)?.at ?? null,
    // The tool of the last call in the newest log, and when it started; its input and results are never read out.
    lastTool: (key, role) => {
      const newest = newestLog(key, role);
      if (!newest) return null;
      let text;
      try {
        text = fs.readFileSync(join(runsDir, key, newest.name), 'utf8');
      } catch {
        return null;
      }
      const rows = text.split('\n').slice(-400);
      for (let i = rows.length - 1; i >= 0; i--) {
        let event;
        try {
          event = JSON.parse(rows[i]);
        } catch {
          continue;
        }
        const call = event?.type === 'assistant' ? (event.message?.content ?? []).findLast?.((part) => part?.type === 'tool_use') : null;
        if (call) return { name: String(call.name ?? ''), at: Date.parse(event.timestamp ?? '') };
      }
      return null;
    },
    dispatcher: () => {
      const record = readJson(join(runsDir, 'dispatcher.json'));
      return record ? { ...record, alive: Number.isInteger(record.pid) && alive(record.pid) } : null;
    },
    // Every event log and how many lines it has.
    logLines: () => Object.fromEntries(list(eventDir).filter((name) => name.endsWith('.log')).map((name) => [name, lines(fs.readFileSync(join(eventDir, name), 'utf8')).length])),
    // The lines added since offsets, and the offsets and sizes after them. A log whose size is that of the last read is
    // not read again (review of shop PR #92): the logs of past days stay in the folder.
    newEvents: (offsets, sizes = {}) => {
      const events = [];
      const after = { ...offsets };
      const seen = { ...sizes };
      for (const name of list(eventDir).filter((file) => file.endsWith('.log')).sort()) {
        const size = sizeOf(join(eventDir, name));
        if (size !== null && size === sizes[name] && offsets[name] !== undefined) continue;
        const all = lines(fs.readFileSync(join(eventDir, name), 'utf8'));
        const from = offsets[name] ?? 0;
        events.push(...all.slice(from));
        after[name] = all.length;
        if (size !== null) seen[name] = size;
      }
      return { events, offsets: after, sizes: seen };
    },
    // One watcher a project (review of shop PR #92): { ok: true }, or { ok: false, pid } of the one that runs. A watcher
    // writes its file again at each round (beat); a file not written for three rounds holds nothing, whatever process
    // its pid names now (review of shop PR #93, security, Low 2).
    claim: (pid) => {
      const held = readJson(pidFile);
      const fresh = held && now() - Date.parse(held.at ?? held.startedAt ?? 0) <= 3 * WATCH.everyMs;
      if (held && held.pid !== pid && Number.isInteger(held.pid) && alive(held.pid) && fresh) return { ok: false, pid: held.pid };
      fs.mkdirSync(runsDir, { recursive: true });
      const at = new Date(now()).toISOString();
      fs.writeFileSync(pidFile, `${JSON.stringify({ pid, startedAt: at, at })}\n`);
      return { ok: true };
    },
    // { ok: true } while the file is still this watcher's; { ok: false, pid } when another took it while this one slept
    // or waited on Jira for more than three rounds, so this one ends (review of shop PR #97, reviewer Low 1).
    beat: (pid) => {
      const held = readJson(pidFile);
      if (held?.pid !== pid) return { ok: false, pid: held?.pid ?? null };
      fs.writeFileSync(pidFile, `${JSON.stringify({ ...held, at: new Date(now()).toISOString() })}\n`);
      return { ok: true };
    },
    release: (pid) => {
      if (readJson(pidFile)?.pid === pid) fs.rmSync(pidFile, { force: true });
    },
  };
}

const lines = (text) => String(text).split('\n').filter((line) => line.trim() !== '');
