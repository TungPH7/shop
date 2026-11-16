// Where the E2E tests of admin run (TW5 of docs/specs/SHOP-7/spec.md). On an environment, Development or Staging,
// Playwright points baseURL at its URL; here, at the app it starts on localhost. A test that only works against the
// apps started here, such as one that mocks the API in the browser, skips itself through Playwright's test.skip when
// `isLocal(baseURL)` is false, and gives a `reason:` in the message of that skip, as the policy job asks.
export const isLocal = (url?: string): boolean => url?.startsWith('http://localhost') === true;
