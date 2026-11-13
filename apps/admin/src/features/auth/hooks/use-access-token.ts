import { useSyncExternalStore } from 'react';

import { getAccessToken, subscribeTokens } from '@/lib/auth/token-storage';

// Reactive read of the access token. localStorage is not reactive within a tab,
// so we bridge it into React with useSyncExternalStore + the token-storage
// pub/sub: components re-render when login/logout changes the token. The third
// arg (server snapshot) returns null — there is no token during SSR/Node.
export function useAccessToken(): string | null {
  return useSyncExternalStore(subscribeTokens, getAccessToken, getAccessToken);
}
