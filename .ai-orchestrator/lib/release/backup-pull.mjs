// Your machine pulls the encrypted copies of the dumps (Pilot 3, spec 2.4; plan, decision 3). The account aobackup on
// the VPS only reads, over SFTP, inside /var/backups/ao-offsite (ChrootDirectory, internal-sftp -R), so the paths it
// lists start at that folder: /<project>/<environment>/<project>-<environment>-<UTC time>.dump.age. The copies land in
// <dest>/<project>/<environment>/, which keeps the copies the VPS keeps (Pilot 3, spec 2.9). Pure but for localCopies
// and pulledCopyAges, which read the folder and the record; scripts/ao-backup-pull.mjs runs sftp, and ao-kit doctor
// reads the ages.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { backupTime, backupsToKeep } from './backup.mjs';

const ENVIRONMENTS = ['development', 'staging', 'production'];
const LINE = /^\/([a-z]([a-z0-9-]*[a-z0-9])?)\/([a-z]+)\/([A-Za-z0-9.-]+\.dump\.age)$/;
const HOST = /^[A-Za-z0-9][A-Za-z0-9.-]*$/;
export const TASK_NAME = 'ao-backup-pull';
// Where install writes the host and folder, for status and ao-kit doctor.
export const PULL_CONFIG = join(homedir(), '.ao', 'backup-pull.json');

// The batch of sftp that lists every copy. The leading - lets the batch go on when no copy is there yet.
export const LIST_BATCH = '-ls -1 /*/*/*.dump.age\n';

// The copies in what that batch prints: only a path of the right shape, with a name of its own project and environment.
export function parseListing(text) {
  const files = [];
  for (const line of text.split(/\r?\n/).map((l) => l.trim())) {
    const match = LINE.exec(line);
    if (!match) continue;
    const [, project, , env, name] = match;
    if (!ENVIRONMENTS.includes(env) || !name.startsWith(`${project}-${env}-`) || !backupTime(name.slice(0, -'.age'.length))) continue;
    files.push({ project, env, name, path: line });
  }
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

export const localPath = (dest, file) => join(dest, file.project, file.env, file.name);

// The copies already on your machine, in the shape parseListing gives.
export function localCopies(dest) {
  const dirs = (dir) => (existsSync(dir) ? readdirSync(dir).filter((name) => statSync(join(dir, name)).isDirectory()) : []);
  const paths = [];
  for (const project of dirs(dest)) for (const env of dirs(join(dest, project))) for (const name of readdirSync(join(dest, project, env))) paths.push(`/${project}/${env}/${name}`);
  return parseListing(paths.join('\n'));
}

// The ages of the copies on this machine when it pulls them (install wrote PULL_CONFIG), else null. A record that
// cannot be read gives { broken }, which doctor shows as a row to fix, instead of stopping (review of shop PR #13).
export function pulledCopyAges(now = new Date(), config = PULL_CONFIG) {
  if (!existsSync(config)) return null;
  let dest;
  try {
    ({ dest } = JSON.parse(readFileSync(config, 'utf8')));
  } catch {
    return { broken: `${config} is not JSON` };
  }
  if (typeof dest !== 'string' || dest === '') return { broken: `${config} names no folder` };
  return copyAges(localCopies(dest), now);
}

// Minutes of clock drift between the VPS and your machine that a copy's time may run ahead.
const DRIFT_MS = 5 * 60_000;

// A copy whose name holds a time later than now, past the drift (Pilot 3, spec 2.9): a VPS taken over could write one to
// pass for the newest copy for ever. pull leaves it on the VPS and says so; copyAges leaves it out.
export const isFuture = (file, now) => backupTime(file.name.slice(0, -'.age'.length)) - now > DRIFT_MS;

// The copies of this machine to let go: those the VPS no longer keeps either (backupsToKeep: every copy of the 48 hours
// before the newest, then the newest of each of the 7 newest days and of the 4 newest weeks), for each project and
// environment on its own.
export function toPrune(files) {
  const groups = new Map();
  for (const file of files) groups.set(`${file.project}/${file.env}`, [...(groups.get(`${file.project}/${file.env}`) ?? []), file]);
  return [...groups.values()].flatMap((group) => {
    const keep = backupsToKeep(group.map(({ name }) => name.slice(0, -'.age'.length)));
    return group.filter(({ name }) => !keep.has(name.slice(0, -'.age'.length)));
  });
}

// The copies not on your machine yet; exists(path) tells.
export const toPull = (remote, dest, exists) => remote.filter((file) => !exists(localPath(dest, file)));

// The sftp batch that fetches them, each to <file>.part; the script renames a file once its get went through.
export function getBatch(files, dest) {
  if (dest.includes('"')) throw new Error('the folder of the copies must not hold a double quote');
  return `${files.map((file) => `get "${file.path}" "${localPath(dest, file).replaceAll('\\', '/')}.part"`).join('\n')}\n`;
}

// The newest copy of each project and environment, and its age in whole hours, from the time in its name. A copy dated
// in the future does not count; one a few minutes ahead, by clock drift, is 0 hours old.
export function copyAges(files, now) {
  const newest = new Map();
  for (const file of files.filter((one) => !isFuture(one, now))) {
    const key = `${file.project}/${file.env}`;
    const time = backupTime(file.name.slice(0, -'.age'.length));
    if (!newest.has(key) || newest.get(key).time < time) newest.set(key, { ...file, time });
  }
  return [...newest.values()]
    .sort((a, b) => `${a.project}/${a.env}`.localeCompare(`${b.project}/${b.env}`))
    .map(({ project, env, name, time }) => ({ project, env, name, hours: Math.max(0, Math.floor((now - time) / 3_600_000)) }));
}

// The PowerShell that registers the task of Windows: every day at 09:00 and at each sign-in, and as soon as it can
// when the machine was off at that time. It runs as you, while you are signed in.
export function taskScript({ node, script, host, dest, at = '09:00' }) {
  if (!HOST.test(host)) throw new Error(`the host must be the name of an SSH host, such as ao-backup: ${JSON.stringify(host)}`);
  for (const [what, value] of [['node', node], ['script', script], ['dest', dest]]) {
    if (value.includes('"')) throw new Error(`${what} must not hold a double quote`);
  }
  const quote = (text) => `'${text.replaceAll("'", "''")}'`;
  return [
    `$action = New-ScheduledTaskAction -Execute ${quote(node)} -Argument ${quote(`"${script}" pull --host ${host} --dest "${dest}"`)}`,
    `$daily = New-ScheduledTaskTrigger -Daily -At ${quote(at)}`,
    '$logon = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME',
    '$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 30)',
    `Register-ScheduledTask -TaskName ${quote(TASK_NAME)} -Description 'ai-orchestrator: pull the encrypted copies of the database backups' -Action $action -Trigger $daily, $logon -Settings $settings -Force | Out-Null`,
    '',
  ].join('\n');
}
