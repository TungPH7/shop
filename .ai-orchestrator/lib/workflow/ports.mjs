// The ports of a lane (parallel-runs spec 5.2): a run in slot k moves every port of the apps of project.yaml by
// k × runs.port_step, and so do the localhost URLs one app gives another. ao-step passes the offset as AO_PORT_OFFSET,
// which the Playwright config of the project reads, and names the ports in the prompt of the run. Pure.

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

// The words added to the prompt of a run when more than one run may go at once.
export function portsNote(rows, offset) {
  if (rows.length === 0) return null;
  const list = rows.map(({ name, port, variable }) => `${name} on ${port} (${variable}=${port})`).join(', ');
  return `Other runs may work next to this one on this machine. Your apps use their own ports, the defaults moved by ${offset} (AO_PORT_OFFSET=${offset}): ${list}. Start an app with its port set that way, point one app at another by these ports, never the defaults, and run Playwright with AO_PORT_OFFSET as it is, so it starts and tests these.`;
}

// How many runs may go at once: runs.lanes_max, lowered by AO_AGENTS_AT_ONCE when set to a smaller whole number.
export function runsAtOnce(lanesMax, env = {}) {
  const lowered = Number(env.AO_AGENTS_AT_ONCE);
  return Number.isInteger(lowered) && lowered >= 1 ? Math.min(lanesMax, lowered) : lanesMax;
}
