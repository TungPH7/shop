import { readFileSync } from 'node:fs';
import { defineConfig, devices, type Project } from '@playwright/test';
import { parse } from 'yaml';

// The E2E tests of Shop (ai-orchestrator, project-scaffold part 2, spec 2.4). The apps come from
// .ai-orchestrator/project.yaml, so an app that ao-kit add brings needs no change here:
// - each public app is a project of Playwright that runs the tests in <its path>/e2e/;
// - the tests in e2e/ at the root go through the first public app;
// - every app is started here with its dev command, on its port, until its health path answers.
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
const localUrl = (app: App) => `http://localhost:${app.port.default}`;
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

const projects: Project[] = open.flatMap(([name, app], i) => projectsOf(name, `${app.path}/e2e`, app, remoteUrl(name, i === 0)));
if (open.length > 0) projects.push(...projectsOf('shared', 'e2e', open[0][1], remoteUrl(open[0][0], true)));

export default defineConfig({
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: { trace: 'on-first-retry' },
  projects,
  webServer: apps.map(([, app]) => ({
    command: app.dev,
    url: `${localUrl(app)}${app.health}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: { ...(app.env ?? {}), [app.port.env]: String(app.port.default) },
  })),
});
