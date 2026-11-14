// The database of a project (project-scaffold part 3, spec 2.4; plan, decisions 5 and 6): one PostgreSQL container for
// each environment, with the alias db on the network of the environment. The deployer makes it once, before the apps
// that need it; a deploy or a rollback of the apps never swaps, stops or removes it, since it carries no ao.app label.
// Like the apps, it runs with no capability, no new privilege and no published port, and as the user postgres, which a
// new volume lets write, since docker fills a new volume from the image with its owners (T2). Its variables come from
// /etc/ao/secrets/<project>/<environment>.db.env, as names in the arguments and values in its environment only.
import { setTimeout as pause } from 'node:timers/promises';
import { ensureNetwork, network } from './docker.mjs';

export const DEFAULT_DB_MEMORY = '256m';
const IMAGE = /^[a-z0-9][a-z0-9._/-]*(:[A-Za-z0-9._-]+)?@sha256:[0-9a-f]{64}$/;
const VARIABLE = /^[A-Z_][A-Z0-9_]*$/;
const MEMORY = /^[1-9][0-9]{0,4}[mg]$/;
const READY_TRIES = 30;
const READY_PAUSE = 2_000;

function allowed(kind, value, test) {
  if (typeof value !== 'string' || !test(value)) throw new Error(`${kind} ${JSON.stringify(value)} is not allowed in a docker argument`);
  return value;
}

// The name of the container and of its volume.
export const databaseName = (project, env) => `${network(project, env)}-db`;

// Runs the database. initDir: the folder of init scripts on the VPS, for a new volume only.
export function databaseRunArgs({ project, env, image, names, memory = DEFAULT_DB_MEMORY, initDir }) {
  const name = databaseName(project, env);
  const cap = allowed('memory', memory, (value) => MEMORY.test(value));
  const init = initDir === undefined ? [] : ['--volume', `${allowed('init folder', initDir, (value) => value.startsWith('/') && !value.split('/').includes('..'))}:/docker-entrypoint-initdb.d:ro`];
  return [
    'run', '--detach', '--name', name, '--network', network(project, env), '--network-alias', 'db',
    '--restart', 'unless-stopped', '--security-opt', 'no-new-privileges', '--cap-drop', 'ALL', '--user', 'postgres',
    '--memory', cap, '--memory-swap', cap,
    '--label', `ao.project=${project}`, '--label', `ao.env=${env}`, '--label', 'ao.role=database',
    '--volume', `${name}:/var/lib/postgresql/data`, ...init,
    ...names.flatMap((variable) => ['--env', allowed('variable', variable, (value) => VARIABLE.test(value))]),
    allowed('image', image, (value) => IMAGE.test(value)),
  ];
}

// Makes sure the database of an environment runs, and answers. database: the database block of deploy.yaml; secrets:
// the variables of its .db.env; prepareInit(): copies the init scripts of the commit to the VPS and resolves to their
// folder, asked only for a new volume. Resolves to { created, started, init? }; rejects when it does not answer.
export async function ensureDatabase({ run, project, env, database, secrets, prepareInit, sleep = pause }) {
  const name = databaseName(project, env);
  const ready = async () => {
    for (let i = 0; i < READY_TRIES; i++) {
      try {
        await run(['exec', name, 'pg_isready', '-U', 'postgres', '-q']);
        return;
      } catch {
        await sleep(READY_PAUSE);
      }
    }
    throw new Error(`${name} did not answer pg_isready within ${(READY_TRIES * READY_PAUSE) / 1000} s`);
  };

  let state = null;
  try {
    state = (await run(['container', 'inspect', '--format', '{{.State.Status}}', name])).trim();
  } catch {
    state = null;
  }
  if (state === 'running') return { created: false, started: false };
  if (state !== null) {
    await run(['start', name]);
    await ready();
    return { created: false, started: true };
  }

  // A new volume gets the init scripts of the commit; a volume that is there keeps its data as it is.
  let fresh = false;
  try {
    await run(['volume', 'inspect', name]);
  } catch {
    fresh = true;
  }
  const initDir = fresh && database.init ? await prepareInit() : undefined;
  await ensureNetwork(run, project, env);
  await run(databaseRunArgs({ project, env, image: database.image, names: Object.keys(secrets), ...(database.memory && { memory: database.memory }), ...(initDir && { initDir }) }), { env: secrets });
  await ready();
  return { created: true, started: false, init: Boolean(initDir) };
}
