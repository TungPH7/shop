// The backups of the databases (project-scaffold part 3, spec 2.4; plan, decision 8). Once a day, as root, a dump in
// the custom format of each running database (the containers labelled ao.role=database) goes to
// /var/backups/ao/<project>/<environment>/, readable by root only; the newest dump of each of the 7 newest days and of
// the 4 newest weeks stay. The restore check restores the newest dump into a container with no network, and compares
// its tables and rows with the live database. Pure, with docker given as run(args) and input(args, file), as in
// docker.mjs; scripts/ao-backup.mjs runs it.
import { setTimeout as pause } from 'node:timers/promises';

const NAME = /^[a-z]([a-z0-9-]*[a-z0-9])?$/;
const ENVIRONMENTS = ['development', 'staging', 'production'];
const DATABASE = /^[A-Za-z_][A-Za-z0-9_]{0,62}$/;
const READY_TRIES = 30;
const READY_PAUSE = 2_000;

function allowed(kind, value, test) {
  if (typeof value !== 'string' || !test(value)) throw new Error(`${kind} ${JSON.stringify(value)} is not allowed in a docker argument`);
  return value;
}

// <project>-<environment>-<UTC time>.dump, and its time back; null for any other file.
const stamp = (date) => date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
export const backupFile = (project, env, now) => `${project}-${env}-${stamp(now)}.dump`;
export function backupTime(name) {
  const match = /-(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z\.dump$/.exec(name);
  return match ? new Date(Date.UTC(match[1], match[2] - 1, match[3], match[4], match[5], match[6])) : null;
}

// The ISO week of a date, such as 2026-W46.
function isoWeek(date) {
  const day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  day.setUTCDate(day.getUTCDate() + 4 - (day.getUTCDay() || 7));
  const first = new Date(Date.UTC(day.getUTCFullYear(), 0, 1));
  return `${day.getUTCFullYear()}-W${Math.ceil(((day - first) / 86400000 + 1) / 7)}`;
}

// The dumps that stay: the newest of each of the `daily` newest days, and of each of the `weekly` newest weeks.
export function backupsToKeep(names, { daily = 7, weekly = 4 } = {}) {
  const dated = names.map((name) => ({ name, time: backupTime(name) })).filter(({ time }) => time).sort((a, b) => b.time - a.time);
  const newestOf = (key, count) => {
    const seen = new Map();
    for (const dump of dated) if (!seen.has(key(dump.time))) seen.set(key(dump.time), dump.name);
    return [...seen.values()].slice(0, count);
  };
  return new Set([...newestOf((time) => time.toISOString().slice(0, 10), daily), ...newestOf(isoWeek, weekly)]);
}

// The running databases, by their label.
export const LIST_DATABASES = ['ps', '--filter', 'label=ao.role=database', '--filter', 'status=running', '--format', '{{.Names}}\t{{.Label "ao.project"}}\t{{.Label "ao.env"}}'];
export function parseDatabases(output) {
  return output.split('\n').filter(Boolean).map((line) => {
    const [container, project, env] = line.split('\t');
    return { container, project, env };
  }).filter(({ container, project, env }) => NAME.test(project ?? '') && ENVIRONMENTS.includes(env) && container === `ao-${project}-${env}-db`);
}

// pg_dump inside the database container, on the database its POSTGRES_DB names; the dump goes to stdout.
export function dumpArgs(container) {
  return ['exec', allowed('container', container, (value) => NAME.test(value)), 'sh', '-c', 'exec pg_dump -U postgres -Fc -d "$POSTGRES_DB"'];
}

// The number of tables, and of rows over all of them, counted exactly: "tables|rows".
export const COUNT_SQL = "select count(*) || '|' || coalesce(sum((xpath('/row/c/text()', query_to_xml(format('select count(*) as c from %I.%I', table_schema, table_name), false, true, '')))[1]::text::bigint), 0) from information_schema.tables where table_type = 'BASE TABLE' and table_schema not in ('pg_catalog', 'information_schema')";

const counts = (text) => {
  const [tables, rows] = text.trim().split('|').map(Number);
  return { tables, rows };
};

// Restores `dump` into a fresh container of the same image, with no network, and compares it with the live database.
// Resolves to { database, restored, live, same }. The container goes in the end, whatever happened.
export async function restoreCheck({ run, input, project, env, dump, sleep = pause }) {
  const live = `ao-${allowed('project', project, (value) => NAME.test(value))}-${allowed('environment', env, (value) => ENVIRONMENTS.includes(value))}-db`;
  const temp = `ao-restore-check-${project}-${env}`;
  const database = allowed('database', (await run(['exec', live, 'printenv', 'POSTGRES_DB'])).trim(), (value) => DATABASE.test(value));
  const image = (await run(['container', 'inspect', '--format', '{{.Config.Image}}', live])).trim();
  await run(['rm', '--force', temp]).catch(() => {});
  try {
    await run(['run', '--detach', '--name', temp, '--network', 'none', '--user', 'postgres', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges', '--memory', '256m', '--memory-swap', '256m', '--env', 'POSTGRES_HOST_AUTH_METHOD=trust', image]);
    let ready = false;
    for (let i = 0; i < READY_TRIES && !ready; i++) {
      try {
        await run(['exec', temp, 'pg_isready', '-U', 'postgres', '-q']);
        ready = true;
      } catch {
        await sleep(READY_PAUSE);
      }
    }
    if (!ready) throw new Error(`${temp} did not answer pg_isready`);
    // The roles of the live database are not in the temporary one, so ownership and grants are left out.
    await input(['exec', '-i', temp, 'pg_restore', '-U', 'postgres', '--no-owner', '--no-privileges', '--create', '-d', 'postgres'], dump);
    const restored = counts(await run(['exec', temp, 'psql', '-U', 'postgres', '-d', database, '-tAc', COUNT_SQL]));
    const now = counts(await run(['exec', live, 'psql', '-U', 'postgres', '-d', database, '-tAc', COUNT_SQL]));
    return { database, restored, live: now, same: restored.tables === now.tables && restored.rows === now.rows };
  } finally {
    await run(['rm', '--force', temp]).catch(() => {});
  }
}
