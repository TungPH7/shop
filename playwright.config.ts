import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig, devices, type Project } from '@playwright/test';
import { parse } from 'yaml';

// The E2E tests of Shop (ai-orchestrator, project-scaffold part 2, spec 2.4). The apps come from
// .ai-orchestrator/project.yaml, so an app that ao-kit add brings needs no change here:
// - each public app is a project of Playwright that runs the tests in <its path>/e2e/;
// - the tests in e2e/ at the root go through the first public app;
// - every app is started here with its dev command, on its port, until its health path answers; on an environment, only
//   when a test is tagged @local (Pilot 3, T4), since an app may need Docker to start, such as a Spring Boot API.
//
// /ao-qa runs the same tests on Development or Staging: E2E_<APP>_URL is the URL of each public app there, such as
// E2E_ADMIN_URL, and E2E_BASE_URL that of the first one. Tests tagged @local still run on the apps started here, since
// only the apps of an environment reach its API. With E2E_HTTP_USER and E2E_HTTP_PASSWORD, Chrome and the request
// fixture send basic auth to the origin of each app only.
//
// Playwright writes the context options into a trace, httpCredentials with the password in clear, so the trace of an
// environment test holds the basic auth of Development or Staging. The kit keeps those traces off Jira; do not upload
// test-results/ anywhere either.
type App = { path: string; dev: string; port: { env: string; default: number }; health: string; public?: boolean; env?: Record<string, string> };

const config = parse(readFileSync('.ai-orchestrator/project.yaml', 'utf8')) as { apps?: Record<string, App> };
const apps = Object.entries(config.apps ?? {});
const open = apps.filter(([, app]) => app.public);
// A run of ao-step in a lane, or next to other runs, gets AO_PORT_OFFSET (parallel-runs spec 5.2): every port of the apps
// it starts moves by it, and so do the localhost URLs one app gives another. Such a run starts its own apps and uses no
// server already on its ports, which would be another run's or one you left running (review of shop PR #21).
const OFFSET = Number(process.env.AO_PORT_OFFSET ?? 0) || 0;
const portOf = (app: App) => app.port.default + OFFSET;
const shift = (value: string) => (OFFSET ? value.replace(/\b(localhost|127\.0\.0\.1):(\d+)/g, (_, host: string, port: string) => `${host}:${Number(port) + OFFSET}`) : value);
const localUrl = (app: App) => `http://localhost:${portOf(app)}`;
const envName = (name: string) => `E2E_${name.toUpperCase().replaceAll('-', '_')}_URL`;
// The URL of a public app on the environment under test, or undefined when the tests run here.
const remoteUrl = (name: string, first: boolean) => process.env[envName(name)] || (first ? process.env.E2E_BASE_URL : undefined) || undefined;
const USER = process.env.E2E_HTTP_USER;
const PASSWORD = process.env.E2E_HTTP_PASSWORD;
const chrome = devices['Desktop Chrome'];

function projectsOf(name: string, testDir: string, app: App, remote: string | undefined): Project[] {
  if (!remote) return [{ name, testDir, use: { ...chrome, baseURL: localUrl(app) } }];
  return [
    { name: `${name}-local`, testDir, grep: /@local/, use: { ...chrome, baseURL: localUrl(app) } },
    {
      name,
      testDir,
      grepInvert: /@local/,
      use: { ...chrome, baseURL: remote, ...(USER && PASSWORD ? { httpCredentials: { username: USER, password: PASSWORD, origin: new URL(remote).origin } } : {}) },
    },
  ];
}

// On an environment, the apps start here only for the tests tagged @local: no such test, no app to start. Every public
// app needs its URL for that; with only some, every app starts here as before, so no project points at a port where
// nothing runs (review of shop PR #10).
const onEnvironment = open.length > 0 && open.every(([name], i) => remoteUrl(name, i === 0) !== undefined);
const specs = (dir: string) => (existsSync(dir) ? readdirSync(dir, { recursive: true, encoding: 'utf8' }).filter((path) => /\.spec\.[cm]?[jt]sx?$/.test(path)).map((path) => join(dir, path)) : []);
// @local as a tag, in a title or in tag: '@local'; not in an address such as user@localhost (review of shop PR #10).
const LOCAL_TAG = /(^|[\s'"`[,(])@local\b/m;
const localTests = [...open.map(([, app]) => `${app.path}/e2e`), 'e2e'].flatMap(specs).some((file) => LOCAL_TAG.test(readFileSync(file, 'utf8')));

const projects: Project[] = open.flatMap(([name, app], i) => projectsOf(name, `${app.path}/e2e`, app, remoteUrl(name, i === 0)));
if (open.length > 0) projects.push(...projectsOf('shared', 'e2e', open[0][1], remoteUrl(open[0][0], true)));

export default defineConfig({
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: { trace: 'on-first-retry' },
  projects,
  webServer: (onEnvironment && !localTests ? [] : apps).map(([, app]) => ({
    command: app.dev,
    url: `${localUrl(app)}${app.health}`,
    reuseExistingServer: !process.env.CI && process.env.AO_PORT_OFFSET === undefined,
    timeout: 120_000,
    env: { ...Object.fromEntries(Object.entries(app.env ?? {}).map(([name, value]) => [name, shift(value)])), [app.port.env]: String(portOf(app)) },
  })),
});
