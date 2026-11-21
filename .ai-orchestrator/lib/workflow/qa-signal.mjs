// The heartbeat of a qa run on GitHub (C2 spec section 9). Approving a PR while qa tests the environment its merge
// deploys made merge-gate merge, the deployer deploy, and that QA stop as superseded, its run lost (Pilot 3, SHOP-28 and
// SHOP-69 of shop). Now ao-step marks the commit qa tests with the status ao/qa: pending while the run lives, set again
// every BEAT_MS, success when it ends; merge-gate, which runs on GitHub and cannot see this machine, waits while that
// mark is pending and fresh. No clock runs on a QA that works: a mark goes stale only when nobody sets it again (ao-step
// is gone: the machine slept, the network went), or when ao-step stops setting it (the log of the agent stayed silent
// SILENT_MS: it is stuck). Lượt 104: shop ran 78 QA runs, 7 minutes the median, 32 the longest.

export const QA_CONTEXT = 'ao/qa';
export const BEAT_MS = 2 * 60 * 1000;
// Five beats missed: one short loss of the network is no end.
export const STALE_MS = 10 * 60 * 1000;
// A command of the whole E2E suite may say nothing for minutes, without being stuck.
export const SILENT_MS = 15 * 60 * 1000;
// How long one run of merge-gate waits at most; the next run waits again (its job ends at 120 minutes).
export const WAIT_MS = 100 * 60 * 1000;
export const POLL_MS = 60 * 1000;

// ao-step's side: wraps the start of a qa run, start(run), and resolves what it resolves. post({ sha, state,
// description }) sets the status with your gh login; logSize() is the size of the run's log now. A run with no commit
// on an environment (a light QA, a defect you report) sets nothing. A status that cannot be set is logged, and the run
// goes on.
export function qaSignal({ post, every = setInterval, stop = clearInterval, now = Date.now, beatMs = BEAT_MS, silentMs = SILENT_MS, log = () => {} }) {
  return async (run, start, logSize) => {
    const sha = run.qa?.sha;
    if (!sha) return start(run);
    const send = (state, description) => post({ sha, state, description: description.slice(0, 140) }).catch((error) => log(`the status ${QA_CONTEXT} was not set: ${error.message}`));
    const testing = `qa tests ${run.key} on ${run.qa.environment}`;
    let ended = false;
    // Silence counts from the start of the run.
    let lastSize = logSize();
    let lastGrowth = now();
    await send('pending', testing);
    const timer = every(async () => {
      if (ended) return;
      const size = logSize();
      if (size !== lastSize) {
        lastSize = size;
        lastGrowth = now();
      }
      if (now() - lastGrowth >= silentMs) {
        ended = true;
        stop(timer);
        await send('success', `qa tested ${run.key}: its log stayed silent for ${Math.round(silentMs / 60000)} minutes, so it is taken as stuck`);
        return;
      }
      await send('pending', testing);
    }, beatMs);
    try {
      return await start(run);
    } finally {
      stop(timer);
      if (!ended) {
        ended = true;
        await send('success', `qa tested ${run.key}: done`);
      }
    }
  };
}

// merge-gate's side: the status that holds a merge onto the commit, or null. statuses: those of the commit, newest
// first, as GitHub lists them. Only the newest ao/qa of a login in AO_APPROVERS counts, your gh login that ao-step uses:
// a mark set by anyone else is left out.
export function qaHolding(statuses, { approvers, now = Date.now, staleMs = STALE_MS }) {
  const newest = (statuses ?? []).find(({ context, creator }) => context === QA_CONTEXT && approvers.includes(creator?.login));
  if (!newest || newest.state !== 'pending') return null;
  return now() - Date.parse(newest.updated_at ?? newest.created_at) < staleMs ? newest : null;
}

// Waits while qaHolding holds the commit `sha`, reading its statuses again every pollMs; resolves null once free, or
// the reason it gave up after maxMs. readStatuses(sha) resolves the statuses of the commit, newest first.
export function waitForQa({ readStatuses, approvers, now = Date.now, sleep, staleMs = STALE_MS, pollMs = POLL_MS, maxMs = WAIT_MS, log = () => {} }) {
  return async (sha) => {
    const since = now();
    let told = false;
    for (;;) {
      const holding = qaHolding(await readStatuses(sha), { approvers, now, staleMs });
      if (!holding) return null;
      if (now() - since >= maxMs) return `${holding.description}, still after ${Math.round(maxMs / 60000)} minutes`;
      if (!told) log(`Waiting for QA: ${holding.description}; merge-gate merges once it ends`);
      told = true;
      await sleep(pollMs);
    }
  };
}
