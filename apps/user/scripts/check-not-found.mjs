#!/usr/bin/env node
// Checks the product not found page S6 on the build of user, as Production serves it (AC26; plan of SHOP-7,
// Architecture Decisions 9; review of PR #51, SHOP-58). Next 16.4.6 renders /[locale]/product-not-found one way under
// `next dev` and another in the build (see src/app/[locale]/product-not-found/page.tsx), and the E2E tests run on
// `next dev` only, so this script runs the build itself.
//
// It builds the app (skip with --no-build to reuse .next), starts a stub api that answers 404 to the HEAD of every
// product, starts `next start` against it, and loads three product pages as a browser does: a slug no product has, in
// Vietnamese and in English, and a path with a dot, as a link pasted with the full stop of a sentence, which the Proxy
// answers without asking the api. Each must answer HTTP 404 with S6 in the language of the path. It needs Node only,
// stops what it started, and picks free ports, so it runs next to the apps of other lanes.
// Run it with: pnpm --filter ./apps/user run check:not-found [--no-build]
import { execFileSync, spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

const appDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const nextBin = createRequire(join(appDir, 'package.json')).resolve('next/dist/bin/next');
const messages = (locale) =>
  JSON.parse(readFileSync(join(appDir, 'messages', `${locale}.json`), 'utf8')).ProductNotFound;

const PAGES = [
  { path: '/vi/products/khong-co-san-pham-nay', locale: 'vi' },
  { path: '/en/products/no-such-product', locale: 'en' },
  { path: '/vi/products/ao-thun.', locale: 'vi' },
];

/** A port no one listens on now. */
async function freePort() {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  await new Promise((resolve) => server.close(resolve));
  return port;
}

/** The api of the check: no product, so `HEAD /api/products/{slug}` answers 404; it records what it was asked. */
async function startStubApi() {
  const asked = [];
  const server = createServer((request, response) => {
    asked.push(`${request.method} ${request.url}`);
    response.writeHead(404, { 'Content-Type': 'application/json' });
    response.end(request.method === 'HEAD' ? undefined : '{"code":"PRODUCT_NOT_FOUND"}');
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { server, asked, url: `http://127.0.0.1:${server.address().port}` };
}

async function waitUntilUp(url, child) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`next start stopped with code ${child.exitCode}`);
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (response.ok) return;
    } catch {
      // Not up yet.
    }
    await sleep(500);
  }
  throw new Error(`next start did not answer ${url} within 60 s`);
}

function build() {
  console.log('Building user (next build)…');
  // As `pnpm run build`, whose name src/config/env/server.ts reads: the build has no secret, and the env of the server
  // is checked when it starts. NEXT_PUBLIC_SITE_URL keeps its default, the origin of Production, as in the deployed image.
  execFileSync(process.execPath, [nextBin, 'build'], {
    cwd: appDir,
    stdio: 'inherit',
    env: { ...process.env, npm_lifecycle_event: 'build' },
  });
}

async function main() {
  if (!process.argv.includes('--no-build')) build();

  const api = await startStubApi();
  const port = await freePort();
  const origin = `http://localhost:${port}`;
  const output = [];
  const next = spawn(process.execPath, [nextBin, 'start', '-p', String(port)], {
    cwd: appDir,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      NODE_ENV: 'production',
      API_URL: api.url,
      // A key of this run only, for the env check of the server: no cookie is sealed here.
      AUTH_SECRET: randomBytes(48).toString('base64url'),
    },
  });
  next.stdout.on('data', (chunk) => output.push(String(chunk)));
  next.stderr.on('data', (chunk) => output.push(String(chunk)));

  const failures = [];
  try {
    await waitUntilUp(`${origin}/en`, next);
    for (const { path, locale } of PAGES) {
      const copy = messages(locale);
      const response = await fetch(`${origin}${path}`, {
        headers: { 'Sec-Fetch-Dest': 'document', Accept: 'text/html' },
        redirect: 'manual',
        signal: AbortSignal.timeout(15_000),
      });
      const html = await response.text();
      const problems = [];
      if (response.status !== 404) problems.push(`status ${response.status}, not 404`);
      if (!html.includes(`<html lang="${locale}"`)) problems.push(`no <html lang="${locale}">`);
      for (const text of [copy.title, copy.description, copy.viewAll]) {
        if (!html.includes(text.replaceAll("'", '&#x27;')) && !html.includes(text)) {
          problems.push(`no "${text}"`);
        }
      }
      if (problems.length) failures.push(`${path}: ${problems.join('; ')}`);
      else console.log(`ok   ${path}: 404 with S6 in ${locale}`);
    }
    // The path with a dot is no slug: the Proxy answers it without asking the api.
    if (api.asked.some((line) => line.includes('ao-thun.'))) {
      failures.push('/vi/products/ao-thun.: the Proxy asked the api for a slug with a dot');
    }
  } catch (error) {
    failures.push(String(error));
  } finally {
    next.kill();
    api.server.close();
  }

  if (failures.length) {
    for (const failure of failures) console.error(`FAIL ${failure}`);
    console.error(`\nOutput of next start:\n${output.join('')}`);
    process.exit(1);
  }
  console.log('S6 answers 404 on the build.');
}

await main();
