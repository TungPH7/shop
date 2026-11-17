import { readFileSync } from 'node:fs';

import {
  type APIRequestContext,
  type Browser,
  type BrowserContext,
  request,
} from '@playwright/test';
import { parse } from 'yaml';

// Where the E2E tests of admin run (TW5 of docs/specs/SHOP-7/spec.md). On an environment, Development or Staging,
// Playwright points baseURL at its URL; here, at the app it starts on localhost. A test that only works against the
// apps started here, such as one that mocks the API in the browser, skips itself through Playwright's test.skip when
// `isLocal(baseURL)` is false, and gives a `reason:` in the message of that skip, as the policy job asks.
export const isLocal = (url?: string): boolean => url?.startsWith('http://localhost') === true;

// The user app, whose product pages a test of admin checks after a change (AC15):
// E2E_USER_URL on an environment, as playwright.config.ts names the URL of each public
// app; otherwise the user app Playwright starts here, on its port moved by the offset of
// the run. Basic auth goes to its origin only, as playwright.config.ts does.
const OFFSET = Number(process.env['AO_PORT_OFFSET'] ?? 0) || 0;

/**
 * The port of the user app here: its default in .ai-orchestrator/project.yaml, where
 * playwright.config.ts reads it to start the app, moved by the offset of the run.
 */
function localUserPort(): number {
  const project = new URL('../../../../.ai-orchestrator/project.yaml', import.meta.url);
  const config = parse(readFileSync(project, 'utf8')) as {
    apps?: { user?: { port?: { default?: number } } };
  };
  const port = config.apps?.user?.port?.default;
  if (port === undefined) throw new Error(`${project.pathname} names no port for the user app`);
  return port + OFFSET;
}

// An empty E2E_USER_URL, as a CI variable left blank, counts as none.
const USER_URL = process.env['E2E_USER_URL'];
export const userUrl =
  USER_URL !== undefined && USER_URL !== '' ? USER_URL : `http://localhost:${localUserPort()}`;

/** baseURL and the basic auth of the user app, for a request or a browser context. */
function userOptions() {
  const username = process.env['E2E_HTTP_USER'];
  const password = process.env['E2E_HTTP_PASSWORD'];
  return {
    baseURL: userUrl,
    ...(username && password
      ? { httpCredentials: { username, password, origin: new URL(userUrl).origin } }
      : {}),
  };
}

/** A request context on the user app. Dispose of it when done. */
export function userRequest(): Promise<APIRequestContext> {
  return request.newContext(userOptions());
}

/**
 * A browser context on the user app, to read its pages as a customer sees them (AC9,
 * AC11). Close it when done.
 */
export function userContext(browser: Browser): Promise<BrowserContext> {
  return browser.newContext(userOptions());
}
