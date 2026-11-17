import { type APIRequestContext, request } from '@playwright/test';

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

// An empty E2E_USER_URL, as a CI variable left blank, counts as none.
const USER_URL = process.env['E2E_USER_URL'];
export const userUrl =
  USER_URL !== undefined && USER_URL !== '' ? USER_URL : `http://localhost:${3000 + OFFSET}`;

/** A request context on the user app. Dispose of it when done. */
export function userRequest(): Promise<APIRequestContext> {
  const username = process.env['E2E_HTTP_USER'];
  const password = process.env['E2E_HTTP_PASSWORD'];
  return request.newContext({
    baseURL: userUrl,
    ...(username && password
      ? { httpCredentials: { username, password, origin: new URL(userUrl).origin } }
      : {}),
  });
}
