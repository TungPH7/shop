// The ports of a lane (parallel-runs spec 5.2): a run in slot k moves every port of the apps of project.yaml by
// (k + 1) × runs.port_step, and so do the localhost URLs one app gives another. ao-step passes the offset as
// AO_PORT_OFFSET, which the Playwright config of the project reads, and names the ports in the prompt of the run. No run
// takes the defaults: they stay to you in the project folder (review of shop PR #21). Pure.

// The offset of the ports of a run in slot k, from 0.
export const portOffset = (slot, portStep) => (slot + 1) * portStep;

// A localhost URL in a value moved by the offset; other text stays.
export function shiftLocalUrls(value, offset) {
  if (!offset) return value;
  return String(value).replace(/\b(localhost|127\.0\.0\.1):(\d+)/g, (_, host, port) => `${host}:${Number(port) + offset}`);
}

// The ports of the apps for a slot: [{ name, port, variable }]. apps: { name: { port: { env, default } } } of
// project.yaml.
export function lanePorts(apps, offset) {
  return Object.entries(apps ?? {})
    .filter(([, app]) => Number.isInteger(app?.port?.default))
    .map(([name, app]) => ({ name, port: app.port.default + offset, variable: app.port.env }));
}

// The variables of a run in slot k: AO_PORT_OFFSET, and those of runs.lane_env ({ ports, names }) of project.yaml, each
// port moved by the offset and each name ending in -s<k + 1>. The apps and the services they start read them before
// their .env files, so a lane's database in Docker Compose is its own: its project, container, volume and port (review
// of shop PR #21: every lane shared one Postgres). { name: value }.
export function laneEnv(settings, slot, offset) {
  const { ports = {}, names = {} } = settings ?? {};
  return {
    AO_PORT_OFFSET: String(offset),
    ...Object.fromEntries(Object.entries(ports).map(([name, port]) => [name, String(port + offset)])),
    ...Object.fromEntries(Object.entries(names).map(([name, value]) => [name, `${value}-s${slot + 1}`])),
  };
}

// The words added to the prompt of a run whose ports are moved. env: the variables of laneEnv.
export function portsNote(rows, offset, env = {}) {
  if (rows.length === 0) return null;
  const list = rows.map(({ name, port, variable }) => `${name} on ${port} (${variable}=${port})`).join(', ');
  const own = Object.entries(env).filter(([name]) => name !== 'AO_PORT_OFFSET');
  return [
    `Other runs may work next to this one on this machine, and you may run the apps in the project folder. Your apps use their own ports, the defaults moved by ${offset} (AO_PORT_OFFSET=${offset}): ${list}. Start an app with its port set that way, point one app at another by these ports, never the defaults, and run Playwright with AO_PORT_OFFSET as it is, so it starts and tests these. Playwright starts the apps itself and uses no server already on these ports: stop an app you started before you run it.`,
    ...(own.length > 0 ? [`Your environment holds this lane's own services too: ${own.map(([name, value]) => `${name}=${value}`).join(', ')}. Keep them: they come before the .env files, so the database your apps start is this run's own.`] : []),
  ].join(' ');
}

// How many runs may go at once: runs.lanes_max, lowered by AO_AGENTS_AT_ONCE when set to a smaller whole number.
export function runsAtOnce(lanesMax, env = {}) {
  const lowered = Number(env.AO_AGENTS_AT_ONCE);
  return Number.isInteger(lowered) && lowered >= 1 ? Math.min(lanesMax, lowered) : lanesMax;
}
