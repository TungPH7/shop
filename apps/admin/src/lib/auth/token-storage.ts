// Client-side token store. Access + refresh tokens live in localStorage so the
// API layer (folder 07) can attach the Bearer header and refresh on 401.
//
// A tiny pub/sub is exposed so React can react to login/logout via
// `useSyncExternalStore` — localStorage is not reactive within the same tab, so
// without this the UI would not update until the next navigation.
//
// Tradeoff: localStorage is readable by any script → exposed to XSS. The hardened
// alternative is an httpOnly refresh cookie (needs backend support; the api layer
// already supports `withCredentials`). Documented for the deploy phase.

const ACCESS_KEY = 'tungph7.auth.access';
const REFRESH_KEY = 'tungph7.auth.refresh';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

const listeners = new Set<() => void>();

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null; // storage unavailable (SSR / private mode)
  }
}

export function getAccessToken(): string | null {
  return read(ACCESS_KEY);
}

export function getRefreshToken(): string | null {
  return read(REFRESH_KEY);
}

export function setTokens(tokens: AuthTokens): void {
  try {
    localStorage.setItem(ACCESS_KEY, tokens.accessToken);
    localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
  } catch {
    // non-fatal: in-memory session for this tab only
  }
  emit();
}

export function clearTokens(): void {
  try {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  } catch {
    // ignore
  }
  emit();
}

function emit(): void {
  for (const listener of listeners) listener();
}

/** Subscribe to token changes (login/logout). Returns an unsubscribe fn. */
export function subscribeTokens(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
