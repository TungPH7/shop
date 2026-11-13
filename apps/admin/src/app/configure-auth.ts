import { authKeys } from '@/features/auth/api/auth-keys';
import { refreshAuthTokens } from '@/features/auth/api/refresh';
import { paths } from '@/config/paths';
import { configureApiAuth } from '@/lib/api/auth-bridge';
import { clearTokens, getAccessToken } from '@/lib/auth/token-storage';
import { queryClient } from '@/lib/react-query/query-client';
import { router } from '@/app/router';

// Wire the folder-07 API auth seam to the real auth implementation. Lives in the
// app layer because it composes feature (auth) + shared (api/query/router); the
// api layer itself must never import these (would invert the dependency).
//
// Called ONCE at startup (Vercel `advanced-init-once`) — see main.tsx. The guard
// makes a double call (e.g. React StrictMode / HMR) a no-op.
let configured = false;

export function setupAuth(): void {
  if (configured) return;
  configured = true;

  configureApiAuth({
    getAccessToken,
    refreshTokens: refreshAuthTokens,
    onUnauthorized: () => {
      // Refresh failed / unrecoverable → drop the session and send to login.
      clearTokens();
      queryClient.removeQueries({ queryKey: authKeys.all });
      void router.navigate(paths.login.getHref());
    },
  });
}
