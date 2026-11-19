// The process of one agent run, started by ao-step.mjs (Pilot 1, T10). `claude -p` prints its result event when the
// agent is done, but it does not exit while a command the agent left in the background is alive, such as `npm run dev`
// from a check in the browser. The run was then held until that command ended, 1 to 12 minutes, and when it ended the
// agent woke up for one more turn that cost a cache write (SMP-6, SMP-7, SMP-10, SMP-11 of ao-sample). So a minute after
// the result the process is stopped, with everything it started. Every effect is a parameter, so tests run it without
// a process.

// How long after its result an agent may take to exit by itself.
export const EXIT_GRACE_MS = 60 * 1000;

// Whether a line of the stream-json output is the result event of the agent's prompt, the last of a run. A result that
// answers a task notification is not: `claude -p --resume` of a session cut off by the usage limit first prints one for
// each command the session had left in the background, with no turn, before it reads the prompt. The wait started on
// it, and the agent was stopped a minute into its work (Pilot 3, QA SHOP-63 and build SHOP-39 of shop, 2026-11-17).
export function isResult(line) {
  try {
    return isOwnResult(JSON.parse(line));
  } catch {
    return false;
  }
}

// Whether an event of the stream is a result that is not the answer to a task notification.
export function isOwnResult(event) {
  return event?.type === 'result' && event.origin?.kind !== 'task-notification';
}

// Stops a process and what it started. On Windows `taskkill /T` takes the whole tree, which is where the dev servers
// are. Elsewhere only the process itself is stopped: a process group would need a detached child, and then Ctrl-C of
// the shell would not reach it.
export function killTree(pid, { platform = process.platform, spawnSync, kill }) {
  if (platform === 'win32') {
    spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
    return;
  }
  try {
    kill(pid, 'SIGKILL');
  } catch {
    // gone already
  }
}

// The processes whose command line names a folder, in any case and with either slash: what an agent started in a
// worktree and left running. In QA SHOP-28 of shop (Phiên 33), a deploy stopped qa, and its next dev, vite,
// mvnw spring-boot:run and Playwright went on holding the files, so the worktree could not go and the next QA stopped.
// On Windows from Win32_Process through PowerShell, elsewhere from ps; this process is left out. [{ pid, command }].
export function processesUnder(dir, { platform = process.platform, spawnSync, self = process.pid }) {
  const forms = [...new Set([dir, dir.replaceAll('\\', '/'), dir.replaceAll('/', '\\')])].map((form) => form.toLowerCase());
  const under = (command) => forms.some((form) => {
    const at = command.indexOf(form);
    // The folder itself or a path inside it, not a folder whose name goes on (shop-SHOP-28-qa-other).
    return at >= 0 && !/[\w.-]/.test(command[at + form.length] ?? '');
  });
  let rows = [];
  if (platform === 'win32') {
    const listed = spawnSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', 'Get-CimInstance Win32_Process | Select-Object ProcessId,CommandLine | ConvertTo-Json -Compress'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    if (listed.status !== 0 || !listed.stdout?.trim()) return [];
    const parsed = JSON.parse(listed.stdout);
    rows = (Array.isArray(parsed) ? parsed : [parsed]).map(({ ProcessId: pid, CommandLine: command }) => ({ pid, command: command ?? '' }));
  } else {
    const listed = spawnSync('ps', ['-eo', 'pid=,args='], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    if (listed.status !== 0) return [];
    rows = listed.stdout.split('\n').map((line) => /^\s*(\d+)\s+(.*)$/.exec(line)).filter(Boolean).map(([, pid, command]) => ({ pid: Number(pid), command }));
  }
  return rows.filter(({ pid, command }) => pid !== self && under(command.toLowerCase()));
}

// Stops the tree of every process that runs from a folder, before the folder goes. Returns their pids.
export function stopProcessesUnder(dir, { platform = process.platform, spawnSync, kill, self = process.pid }) {
  const found = processesUnder(dir, { platform, spawnSync, self });
  for (const { pid } of found) killTree(pid, { platform, spawnSync, kill });
  return found.map(({ pid }) => pid);
}

// Runs the agent and resolves { lines, stopped } when its process closes: the lines of its output, and whether it was
// stopped for staying alive after its result. append(stream, chunk) writes the log files.
export function startAgentProcess({ spawn, command, args, env, cwd, append, kill, graceMs = EXIT_GRACE_MS, setTimer = setTimeout, clearTimer = clearTimeout }) {
  return new Promise((done) => {
    const lines = [];
    let rest = '';
    let timer = null;
    let stopped = false;
    const child = spawn(command, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.on('data', (chunk) => {
      append('stdout', chunk);
      const parts = (rest + chunk.toString('utf8')).split('\n');
      rest = parts.pop();
      lines.push(...parts);
      if (timer === null && parts.some(isResult)) {
        timer = setTimer(() => {
          stopped = true;
          kill(child.pid);
        }, graceMs);
      }
    });
    child.stderr.on('data', (chunk) => append('stderr', chunk));
    child.on('error', (error) => {
      append('stderr', Buffer.from(`cannot start the agent: ${error.message}\n`));
      done({ lines, stopped });
    });
    child.on('close', () => {
      if (timer !== null) clearTimer(timer);
      done({ lines: rest ? [...lines, rest] : lines, stopped });
    });
  });
}
