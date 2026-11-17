#!/usr/bin/env node
// Checks the Caddyfile of the admin image as a proxy (SHOP-56): on every environment Caddy of the VPS ends TLS and calls
// this Caddy over the Docker network with X-Forwarded-Proto: https. The api, with server.forward-headers-strategy native,
// takes its scheme from that header and compares it with the Origin of the browser; when the header reached it as http,
// it took every same-origin POST for a cross-origin one and answered 403 "Invalid CORS request".
//
// The script runs, on a Docker network of its own, the Caddy image of apps/admin/Dockerfile with apps/admin/Caddyfile,
// a stub api behind it that answers with the forwarded headers it got, and a client in place of Caddy of the VPS. It
// checks the three headers the api reads: X-Forwarded-Proto and X-Forwarded-Host reach it as Caddy of the VPS sent
// them, and X-Forwarded-For keeps the address of the browser first, with the address of Caddy of the VPS appended, as
// a proxy appends the one that called it. It needs Docker only, and removes what it made. The job caddy-proxy of
// .github/workflows/ci.yml runs it on every PR and push (SHOP-57). Run it with: pnpm --filter ./apps/admin run check:caddy
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const appDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const caddyfile = join(appDir, 'Caddyfile');

// The image of the last stage of the Dockerfile, so the check runs the Caddy the deploy runs.
const froms = [...readFileSync(join(appDir, 'Dockerfile'), 'utf8').matchAll(/^FROM\s+(\S+)/gm)].map(
  (m) => m[1],
);
const image = froms.at(-1);

const tag = `ao-check-caddy-${process.pid}`;
const net = tag;
const api = `${tag}-api`;
const admin = `${tag}-admin`;

const docker = (args, options = {}) =>
  execFileSync('docker', args, {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    ...options,
  }).trim();

// The log of a container, for a failed check. Caddy writes its log, and the error that stops it, to stderr, which
// `docker logs` passes on as its own stderr: both streams are read, so CI shows why Caddy did not start (review of
// PR #47, SHOP-61).
function logsOf(name) {
  const { stdout, stderr, error } = spawnSync('docker', ['logs', name], { encoding: 'utf8' });
  if (error) return `no log of ${name}: ${error.message}`;
  const log = [stdout, stderr]
    .map((text) => (text ?? '').trim())
    .filter(Boolean)
    .join('\n');
  return `--- docker logs ${name} ---\n${log || '(empty)'}`;
}

// The stub api: it shows the headers the api would read, as Tomcat's RemoteIpValve reads them, as field=value pairs
// split by |.
const STUB = [
  '{',
  '\tadmin off',
  '\tauto_https off',
  '}',
  ':3001 {',
  '\trespond "proto={header.X-Forwarded-Proto}|fhost={header.X-Forwarded-Host}|for={header.X-Forwarded-For}|host={host}"',
  '}',
].join('\n');

// An IPv4 address, such as the one Docker gives the client container, which Caddy appends to X-Forwarded-For.
const IP = String.raw`\d{1,3}(?:\.\d{1,3}){3}`;

// The fields of the answer of the stub api: { proto, fhost, for, host }.
const fieldsOf = (body) =>
  Object.fromEntries(
    body.split('|').map((pair) => {
      const at = pair.indexOf('=');
      return [pair.slice(0, at), pair.slice(at + 1)];
    }),
  );

function cleanup() {
  for (const name of [admin, api]) {
    try {
      docker(['rm', '--force', name]);
    } catch {
      // Not created.
    }
  }
  try {
    docker(['network', 'rm', net]);
  } catch {
    // Not created.
  }
}

// Whether the admin Caddy still runs. Caddy exits at once when it cannot load the Caddyfile; a container that cannot
// be inspected any more does not run either.
function adminRunning() {
  try {
    return docker(['inspect', '--format', '{{.State.Running}}', admin]) === 'true';
  } catch {
    return false;
  }
}

// GET /api/... through the admin Caddy from a container on the network, as Caddy of the VPS calls it. The admin Caddy
// may not listen yet at the first call: try again half a second after a failed call, up to 20 times. Each call starts a
// client container, which takes seconds, so the 20 calls can take minutes: before each one the script stops at once
// when the admin Caddy no longer runs, and the log of Caddy then shows why (review of PR #56, SHOP-62).
async function through(headers) {
  const args = ['run', '--rm', '--network', net, image, 'wget', '-qO-'];
  for (const [name, value] of Object.entries(headers)) args.push('--header', `${name}: ${value}`);
  args.push(`http://${admin}:5173/api/admin/products`);
  let last;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (!adminRunning()) {
      const after = last ? `, after ${attempt} call(s): ${last.stderr || last.message}` : '';
      throw new Error(`the admin Caddy is not running${after}`);
    }
    try {
      return docker(args);
    } catch (error) {
      last = error;
      await sleep(500);
    }
  }
  throw new Error(`no answer through the admin Caddy: ${last?.stderr || last?.message}`);
}

// Each expected field is a string the field must equal, or a pattern it must match. In the first case Host differs
// from X-Forwarded-Host, so the check sees which of the two Caddy passed on as X-Forwarded-Host.
const cases = [
  {
    name: 'keeps X-Forwarded-Proto, X-Forwarded-Host and X-Forwarded-For of Caddy of the VPS',
    headers: {
      Host: 'admin.internal',
      'X-Forwarded-Proto': 'https',
      'X-Forwarded-Host': 'shop-admin.example',
      'X-Forwarded-For': '203.0.113.7',
    },
    expect: {
      proto: 'https',
      fhost: 'shop-admin.example',
      for: new RegExp(`^203\\.0\\.113\\.7, ${IP}$`),
      host: 'admin.internal',
    },
  },
  {
    name: 'sets the forwarded headers itself when no proxy sent them',
    headers: { Host: 'shop-admin.example' },
    expect: {
      proto: 'http',
      fhost: 'shop-admin.example',
      for: new RegExp(`^${IP}$`),
      host: 'shop-admin.example',
    },
  },
];

// The fields of the answer that differ from what the case expects, one line each.
function mismatches(body, expect) {
  const got = fieldsOf(body);
  return Object.entries(expect)
    .filter(([field, want]) =>
      want instanceof RegExp ? !want.test(got[field] ?? '') : got[field] !== want,
    )
    .map(([field, want]) => `     ${field}: expected ${want}, got ${got[field] ?? '(none)'}`);
}

let failed = 0;
try {
  cleanup();
  docker(['network', 'create', net]);
  docker([
    'run',
    '--detach',
    '--name',
    api,
    '--network',
    net,
    '--network-alias',
    'api',
    '--env',
    `STUB=${STUB}`,
    image,
    'sh',
    '-c',
    'printf "%s" "$STUB" > /tmp/Caddyfile && exec caddy run --config /tmp/Caddyfile --adapter caddyfile',
  ]);
  docker([
    'create',
    '--name',
    admin,
    '--network',
    net,
    image,
    'caddy',
    'run',
    '--config',
    '/etc/caddy/Caddyfile',
    '--adapter',
    'caddyfile',
  ]);
  docker(['cp', caddyfile, `${admin}:/etc/caddy/Caddyfile`]);
  docker(['start', admin]);

  for (const { name, headers, expect } of cases) {
    const body = await through(headers);
    const wrong = mismatches(body, expect);
    if (wrong.length === 0) {
      console.log(`ok   ${name}`);
    } else {
      failed += 1;
      console.log(`FAIL ${name}\n${wrong.join('\n')}\n     answer: ${body}`);
    }
  }
} catch (error) {
  failed += 1;
  console.error(error.stderr || error.message);
} finally {
  if (failed) console.error(logsOf(admin));
  cleanup();
}

console.log(failed ? `${failed} check(s) failed (${image})` : `all checks passed (${image})`);
process.exit(failed ? 1 : 0);
