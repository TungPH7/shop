// Dependency-injection seam between the API layer and authentication.
//
// The API layer must NOT import the auth feature or the Redux store (that would
// invert the dependency direction and create import cycles). Instead, the auth
// module (folder 10) calls `configureApiAuth(...)` once at startup to wire in:
//   - how to read the current access token,
//   - how to refresh the session,
//   - what to do when auth is unrecoverable.
// Until then, the no-op bridge means requests simply go out without a token.

export interface ApiAuthBridge {
  /** Current access token, or null when unauthenticated. */
  getAccessToken: () => string | null;
  /** Refresh the session; resolve when a new token is in place, reject to force logout. */
  refreshTokens: () => Promise<void>;
  /** Called when auth cannot be recovered (refresh failed / unavailable). */
  onUnauthorized: () => void;
}

const noopBridge: ApiAuthBridge = {
  getAccessToken: () => null,
  refreshTokens: () => Promise.reject(new Error('No auth bridge configured')),
  onUnauthorized: () => undefined,
};

let bridge: ApiAuthBridge = noopBridge;

/** Wire the API layer to the real auth implementation (called by folder 10). */
export function configureApiAuth(next: Partial<ApiAuthBridge>): void {
  bridge = { ...noopBridge, ...next };
}

export function getApiAuth(): ApiAuthBridge {
  return bridge;
}

/** Reset to the no-op bridge — used by tests and teardown. */
export function resetApiAuth(): void {
  bridge = noopBridge;
}
