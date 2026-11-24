// ao-kit verify (SPEC-guided-setup.md section 5): one real write on each platform a project uses, each cleaned up after
// itself, once ao-kit doctor passes. doctor reads; verify writes: a Jira Task the CI token makes and comments on, which
// your classic token then cancels; a branch the App ao-dev makes at the head of develop and deletes; a token of ao-review
// with the write access a review needs; and, for each public app with a Development host, its health page with and
// without basic auth. It opens no PR, runs no agent and deploys nothing. Every call is given, so tests need no network:
//   jira: the Jira client of the CI token (lib/tracker/jira-client.mjs, write: true), or null when the token is not set;
//   admin(method, path, body): your site with JIRA_ADMIN_EMAIL and JIRA_ADMIN_CLASSIC_TOKEN, { status, json }, or null;
//   appToken(kind, permissions): a token of the App (dev or review), or a thrown error that says why;
//   github(method, path, token, body): the GitHub REST API, { status, json };
//   fetch: for the hosts; envAuth: AO_ENV_AUTH, user:password, or undefined.
// No secret is printed or written: rows name tokens, never their values.

export const VERIFY_LABEL = 'ao-kit-verify';
export const VERIFY_FILE = '.ai/setup/verify.md';
// The resolution the Cancel transition asks for (tracker/jira.yaml, resolution values).
const CANCEL_RESOLUTION = "Won't Do";

// A stamp for names: 20261124-1930, from an ISO time.
const stampOf = (now) => now.toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 13);
const firstLine = (error) => String(error?.message ?? error).split('\n')[0].slice(0, 300);

export async function verifyProject({ config, now = new Date(), taskType = 'Task', jira, admin, appToken, github, fetch = globalThis.fetch, envAuth }) {
  const rows = [];
  const row = (group, name, ok, fix) => rows.push({ group, name, ok, fix: ok === true ? '' : fix });
  const stamp = stampOf(now);
  const space = config.jira.space;
  const repo = config.github.repo;

  // Jira: the CI token makes a Task, reads it back and comments; your classic token cancels it.
  let item = null;
  if (!jira) {
    row('Jira', 'the CI token makes a Task', false, 'Set JIRA_CI_TOKEN as a user variable (docs/getting-started.md 2.3), open Claude Code again, then run ao-kit verify again');
  } else {
    try {
      const summary = `ao-kit verify ${stamp}`;
      const text = 'Made by ao-kit verify to check that the CI token writes to Jira. ao-kit verify cancels it at once.';
      ({ key: item } = await jira.request('POST', '/rest/api/3/issue', {}, { fields: { project: { key: space }, issuetype: { name: taskType }, summary, labels: [VERIFY_LABEL], description: { type: 'doc', version: 1, content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] } } }));
      row('Jira', `the CI token makes a Task: ${item}`, true, '');
    } catch (error) {
      row('Jira', 'the CI token makes a Task', false, `${firstLine(error)}. The account orchestratorci needs Create work items in ${space} (docs/jira-setup.md)`);
    }
  }
  if (item) {
    try {
      const read = await jira.get(`/rest/api/3/issue/${encodeURIComponent(item)}`, { fields: 'labels,summary' });
      row('Jira', `the CI token reads ${item} back`, (read?.fields?.labels ?? []).includes(VERIFY_LABEL), `${item} came back without the label ${VERIFY_LABEL}: check the fields of the Task screen of ${space}`);
    } catch (error) {
      row('Jira', `the CI token reads ${item} back`, false, firstLine(error));
    }
    try {
      await jira.comment(item, `ao-kit verify ${stamp}: the CI token comments.`);
      row('Jira', `the CI token comments on ${item}`, true, '');
    } catch (error) {
      row('Jira', `the CI token comments on ${item}`, false, `${firstLine(error)}. The account orchestratorci needs Add comments in ${space}`);
    }
    rows.push(...(await cancel(admin, item)));
  }

  // GitHub: ao-dev makes a branch at the head of develop and deletes it; ao-review gets the token a review needs.
  const branch = `ao-kit-verify-${stamp}`;
  let devToken = null;
  try {
    devToken = await appToken('dev', { contents: 'write', pull_requests: 'write' });
    row('GitHub', 'ao-dev gets a token that writes code and PRs', true, '');
  } catch (error) {
    row('GitHub', 'ao-dev gets a token that writes code and PRs', false, `${firstLine(error)} (docs/github-apps-setup.md)`);
  }
  if (devToken) rows.push(...(await branchRoundTrip({ github, repo, token: devToken, branch })));
  try {
    await appToken('review', { pull_requests: 'write' });
    row('GitHub', 'ao-review gets a token that posts reviews', true, '');
  } catch (error) {
    row('GitHub', 'ao-review gets a token that posts reviews', false, `${firstLine(error)} (docs/github-apps-setup.md)`);
  }

  // VPS: the Development host of each public app, with and without basic auth.
  const hosted = Object.entries(config.apps ?? {}).filter(([, app]) => app.public && app.hosts?.development);
  for (const [name, app] of hosted) rows.push(await hostRow({ fetch, envAuth, name, app }));
  const notes = hosted.length === 0 ? ['No public app has a Development host in project.yaml: the VPS is not checked'] : [];
  return { rows, item, branch, notes };
}

// Cancel with your classic token, since Cancel is a transition for people only (contract: no agent cancels).
async function cancel(admin, item) {
  const name = `your token cancels ${item}`;
  if (!admin) return [{ group: 'Jira', name, ok: false, fix: `Set JIRA_ADMIN_EMAIL and JIRA_ADMIN_CLASSIC_TOKEN (docs/getting-started.md 2.3), or cancel ${item} on Jira by hand: Cancel, resolution ${CANCEL_RESOLUTION}` }];
  try {
    const path = `/rest/api/3/issue/${encodeURIComponent(item)}/transitions`;
    const listed = await admin('GET', path);
    const found = (listed.json?.transitions ?? []).find((t) => t.name === 'Cancel');
    if (!found) return [{ group: 'Jira', name, ok: false, fix: `${item} has no transition Cancel for your account (status ${listed.status}): run ao-kit setup jira again, then cancel ${item} by hand` }];
    const done = await admin('POST', path, { transition: { id: found.id }, fields: { resolution: { name: CANCEL_RESOLUTION } } });
    const ok = done.status >= 200 && done.status < 300;
    return [{ group: 'Jira', name, ok, fix: ok ? '' : `Jira answered ${done.status}: cancel ${item} by hand, resolution ${CANCEL_RESOLUTION}` }];
  } catch (error) {
    return [{ group: 'Jira', name, ok: false, fix: `${firstLine(error)}: cancel ${item} by hand, resolution ${CANCEL_RESOLUTION}` }];
  }
}

// A branch at the head of develop, read back, then deleted: it has no commit of its own, and no workflow runs on it.
async function branchRoundTrip({ github, repo, token, branch }) {
  const rows = [];
  const fail = (name, fix) => rows.push({ group: 'GitHub', name, ok: false, fix });
  const head = await github('GET', `repos/${repo}/git/ref/heads/develop`, token);
  const sha = head.json?.object?.sha;
  if (!sha) {
    fail('ao-dev reads the head of develop', `GitHub answered ${head.status}: push develop first (docs/getting-started.md, part 3 step 5), and check that ao-dev is installed on ${repo}`);
    return rows;
  }
  const made = await github('POST', `repos/${repo}/git/refs`, token, { ref: `refs/heads/${branch}`, sha });
  if (made.status !== 201) {
    fail(`ao-dev makes the branch ${branch}`, `GitHub answered ${made.status}: ao-dev needs Contents read and write on ${repo}, and no ruleset may stop it making a branch`);
    return rows;
  }
  const back = await github('GET', `repos/${repo}/git/ref/heads/${encodeURIComponent(branch)}`, token);
  const gone = await github('DELETE', `repos/${repo}/git/refs/heads/${encodeURIComponent(branch)}`, token);
  const ok = back.json?.object?.sha === sha && gone.status === 204;
  rows.push({ group: 'GitHub', name: `ao-dev makes, reads and deletes the branch ${branch}`, ok, fix: ok ? '' : `read back ${back.status}, delete ${gone.status}: if the branch is still there, delete ${branch} on GitHub by hand` });
  return rows;
}

// The health page of the Development host of an app: 200 with basic auth, 401 without.
async function hostRow({ fetch, envAuth, name, app }) {
  const url = `https://${app.hosts.development}${app.health ?? '/'}`;
  const what = `Development of ${name} answers ${app.health ?? '/'} with basic auth, and 401 without`;
  if (!envAuth || !envAuth.includes(':')) return { group: 'VPS', name: what, ok: false, fix: 'Set AO_ENV_AUTH, user:password of the basic auth of Development and Staging, as a user variable, then open Claude Code again' };
  try {
    // redirect: manual, so a redirect is a status to judge and no address is followed or printed.
    const authed = await fetch(url, { headers: { Authorization: `Basic ${Buffer.from(envAuth).toString('base64')}` }, redirect: 'manual', signal: AbortSignal.timeout(30_000) });
    const bare = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(30_000) });
    const ok = authed.status === 200 && bare.status === 401;
    return { group: 'VPS', name: what, ok, fix: ok ? '' : `with basic auth ${authed.status}, without ${bare.status}: deploy Development first (docs/getting-started.md, part 5 step 8), or check the hosts of ${name} in /etc/ao/deployer.yaml` };
  } catch (error) {
    return { group: 'VPS', name: what, ok: false, fix: `${firstLine(error)}: is the DNS of ${app.hosts.development} on the VPS, and does Caddy run?` };
  }
}

// .ai/setup/verify.md: when it ran, the rows, and what ao-kit-setup.md asks the main session to do next.
export function verifyReport({ rows, item, notes, now = new Date() }) {
  const lines = ['# ao-kit verify', '', `Ran ${now.toISOString()}.`, ''];
  for (const { group, name, ok, fix } of rows) lines.push(`- ${ok ? '✔' : '✘'} ${group}: ${name}${ok ? '' : ` — ${fix}`}`);
  for (const note of notes ?? []) lines.push(`- ${note}`);
  if (item) lines.push('', `MCP check for the main session (ao-kit-setup.md): read ${item} through the atlassian server; it is Cancelled and has the label ${VERIFY_LABEL}.`);
  lines.push('');
  return lines.join('\n');
}
