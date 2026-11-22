// The effects of the dispatcher /ao-run on this machine (C2 spec 5.2, 5.6, 5.7). It asks ao-step itself: the board is
// `ao-step status --json`, a decision `ao-step <command> <arg> --json`, a run `ao-step <command> <arg> --go --result
// <file>`. So each answer is the one you get when you type the command, and the dispatcher holds no token of its own.
// Effects are parameters, so tests run it with fake processes and files:
//   spawn(command, args, options)   node:child_process spawn
//   fs                              { existsSync, mkdirSync, openSync, closeSync, readFileSync, writeFileSync, appendFileSync, rmSync }
//   alive(pid), now(), print(line)
import { join } from 'node:path';

const RUN_DIR = ['.ai', 'runs', '_run'];
export const DISPATCHER_FILE = ['.ai', 'runs', 'dispatcher.json'];

// The last line of JSON a command printed, or null.
export function lastJson(text) {
  const line = String(text ?? '').trim().split('\n').reverse().find((row) => row.trim().startsWith('{'));
  if (!line) return null;
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

// The USD of the runs of `keys` that started at `since` or later, from their state.json (lib/workflow/runner.mjs).
export function spentSince(keys, since, readState) {
  let total = 0;
  for (const key of keys) {
    for (const run of readState(key)?.runs ?? []) {
      if (typeof run.costUsd === 'number' && Date.parse(run.startedAt ?? '') >= since) total += run.costUsd;
    }
  }
  return total;
}

export function dispatcherEffects({ kitDir, projectDir, spawn, fs, alive, now = Date.now, execPath = process.execPath, env = process.env, print = console.log }) {
  const script = join(kitDir, 'scripts', 'ao-step.mjs');
  const runDir = join(projectDir, ...RUN_DIR);
  const lockFile = join(projectDir, ...DISPATCHER_FILE);
  const stopFile = join(runDir, 'stop');
  const stamp = () => new Date(now()).toISOString().replace(/[:.]/g, '-');
  const readJson = (file) => {
    try {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
      return null;
    }
  };
  // One dry command: resolves { code, stdout, stderr }.
  const ask = (args) =>
    new Promise((done) => {
      let stdout = '';
      let stderr = '';
      const child = spawn(execPath, [script, ...args], { cwd: projectDir, env, windowsHide: true });
      child.stdout?.on('data', (data) => (stdout += data));
      child.stderr?.on('data', (data) => (stderr += data));
      child.on('error', (error) => done({ code: 1, stdout, stderr: error.message }));
      child.on('close', (code) => done({ code, stdout, stderr }));
    });
  const lastLine = (text) => String(text ?? '').trim().split('\n').at(-1) ?? '';

  return {
    readBoard: async () => {
      const { code, stdout, stderr } = await ask(['status', '--json']);
      const board = lastJson(stdout);
      if (code !== 0 || !board) throw new Error(`ao-step status --json gave no board: ${lastLine(stderr || stdout)}`);
      return { items: board.items ?? [], pulls: board.pulls ?? [], merged: board.merged ?? [] };
    },
    // A dry run that gives no decision is a command that cannot run as asked (waits fix).
    decide: async (command, arg) => {
      const { stdout, stderr } = await ask([command, String(arg), '--json']);
      return lastJson(stdout) ?? { go: false, waits: 'fix', reason: `ao-step ${command} ${arg} gave no decision: ${lastLine(stderr || stdout)}`, next: `/ao-${command} ${arg}`, lines: [] };
    },
    // A real run, its output in .ai/runs/<KEY>/run-<time>.log; resolves its last decision, or null when it gave none.
    start: ({ command, arg, key }) =>
      new Promise((done) => {
        const at = stamp();
        const result = join('.ai', 'runs', '_run', 'results', `${key}-${command}-${at}.json`);
        fs.mkdirSync(join(runDir, 'results'), { recursive: true });
        fs.mkdirSync(join(projectDir, '.ai', 'runs', key), { recursive: true });
        const out = fs.openSync(join(projectDir, '.ai', 'runs', key, `run-${at}.log`), 'a');
        let ended = false;
        const finish = () => {
          if (ended) return;
          ended = true;
          fs.closeSync(out);
          done(readJson(join(projectDir, result)));
        };
        const child = spawn(execPath, [script, command, String(arg), '--go', '--result', result], { cwd: projectDir, env, stdio: ['ignore', out, out], windowsHide: true });
        child.on('error', finish);
        child.on('close', finish);
      }),
    readState: (key) => readJson(join(projectDir, '.ai', 'runs', key, 'state.json')),
    stopAsked: () => fs.existsSync(stopFile),
    askStop: () => {
      fs.mkdirSync(runDir, { recursive: true });
      fs.writeFileSync(stopFile, `${new Date(now()).toISOString()}\n`);
    },
    // The dispatcher of this project, or null; one whose process is gone does not count.
    running: () => {
      const held = readJson(lockFile);
      return held && alive(held.pid) ? held : null;
    },
    // Takes the place of the one dispatcher of the project: { ok } or { ok: false, reason }.
    lock: (record) => {
      const held = readJson(lockFile);
      if (held && alive(held.pid)) return { ok: false, reason: `/ao-run ${held.scope} runs already (process ${held.pid}, since ${held.startedAt}): one dispatcher per project` };
      fs.mkdirSync(join(projectDir, '.ai', 'runs'), { recursive: true });
      fs.rmSync(stopFile, { force: true });
      fs.writeFileSync(lockFile, `${JSON.stringify(record, null, 2)}\n`);
      return { ok: true };
    },
    update: (record) => fs.writeFileSync(lockFile, `${JSON.stringify(record, null, 2)}\n`),
    unlock: () => {
      fs.rmSync(lockFile, { force: true });
      fs.rmSync(stopFile, { force: true });
    },
    // One line per event, printed and kept in .ai/runs/_run/<date>.log.
    log: (line) => {
      const date = new Date(now());
      const text = `${date.toTimeString().slice(0, 5)} ${line}`;
      print(text);
      fs.mkdirSync(runDir, { recursive: true });
      fs.appendFileSync(join(runDir, `${date.toISOString().slice(0, 10)}.log`), `${text}\n`);
    },
  };
}
