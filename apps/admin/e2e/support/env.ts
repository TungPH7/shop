// Where the E2E tests of admin run (TW5 of docs/specs/SHOP-7/spec.md). On an environment, Development or Staging,
// Playwright points baseURL at its URL; here, at the app it starts on localhost. A test that only works against the
// apps started here, such as one that mocks the API in the browser, skips with `test.skip(!isLocal(baseURL), …)`.
export const isLocal = (url?: string): boolean => url?.startsWith('http://localhost') === true;
