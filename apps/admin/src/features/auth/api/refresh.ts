import axios from 'axios';

import { authTokensSchema } from '@/features/auth/model/auth';
import { env } from '@/config/env';
import { getRefreshToken, setTokens } from '@/lib/auth/token-storage';

// Token refresh uses a BARE axios call (not the shared `api` client) on purpose:
// the shared client's 401 interceptor is what TRIGGERS a refresh, so routing the
// refresh through it would recurse. This is wired into the api layer via
// `configureApiAuth` (folder 07 seam) — see app/configure-auth.ts.
export async function refreshAuthTokens(): Promise<void> {
  const refreshToken = getRefreshToken();
  if (refreshToken === null) {
    throw new Error('No refresh token available');
  }
  const response = await axios.post<unknown>(
    `${env.apiUrl}/auth/refresh-token`,
    { refreshToken },
    { headers: { 'Content-Type': 'application/json' } },
  );
  setTokens(authTokensSchema.parse(response.data));
}
