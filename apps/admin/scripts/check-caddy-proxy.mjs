#!/usr/bin/env node
// Checks the Caddyfile of the admin image as a proxy (SHOP-56): on every environment Caddy of the VPS ends TLS and calls
// this Caddy over the Docker network with X-Forwarded-Proto: https. The api, with server.forward-headers-strategy native,
// takes its scheme from that header and compares it with the Origin of the browser; when the header reached it as http,
// it took every same-origin POST for a cross-origin one and answered 403 "Invalid CORS request".
//
// The script runs, on a Docker network of its own, the Caddy image of apps/admin/Dockerfile with apps/admin/Caddyfile,
// a stub api behind it that answers with the forwarded headers it got, and a client in place of Caddy of the VPS. It
// needs Docker only, and removes what it made. Run it with: pnpm --filter ./apps/admin run check:caddy
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
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

// The stub api: it shows the headers the api would read, as Tomcat's RemoteIpValve reads them.
const STUB = [
  '{',
  '\tadmin off',
  '\tauto_https off',
  '}',
  ':3001 {',
  '\trespond "proto={header.X-Forwarded-Proto} host={host}"',
  '}',
].join('\n');

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

// GET /api/... through the admin Caddy from a container on the network, as Caddy of the VPS calls it.
function through(headers) {
  const args = ['run', '--rm', '--network', net, image, 'wget', '-qO-'];
  for (const [name, value] of Object.entries(headers)) args.push('--header', `${name}: ${value}`);
  args.push(`http://${admin}:5173/api/admin/products`);
  let last;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      return docker(args);
    } catch (error) {
      last = error;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500);
    }
  }
  throw new Error(`no answer through the admin Caddy: ${last?.stderr || last?.message}`);
}

const cases = [
  {
    name: 'keeps X-Forwarded-Proto: https of Caddy of the VPS',
    headers: { Host: 'shop-admin.example', 'X-Forwarded-Proto': 'https' },
    expect: 'proto=https host=shop-admin.example',
  },
  {
    name: 'sets X-Forwarded-Proto: http when no proxy sent one',
    headers: { Host: 'shop-admin.example' },
    expect: 'proto=http host=shop-admin.example',
  },
];

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
    const body = through(headers);
    if (body === expect) {
      console.log(`ok   ${name}`);
    } else {
      failed += 1;
      console.log(`FAIL ${name}\n     expected: ${expect}\n     got:      ${body}`);
    }
  }
} catch (error) {
  failed += 1;
  console.error(error.stderr || error.message);
  try {
    console.error(docker(['logs', admin]));
  } catch {
    // No container to show.
  }
} finally {
  cleanup();
}

console.log(failed ? `${failed} check(s) failed (${image})` : `all checks passed (${image})`);
process.exit(failed ? 1 : 0);
