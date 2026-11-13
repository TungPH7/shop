import 'server-only';

import { loginResponseSchema, type LoginInput } from '~/features/auth/model/auth';
import { type SessionTokens } from '~/lib/auth/session-seal';
import { httpPost } from '~/lib/http/client';

/**
 * DAL đăng nhập (BFF) — `POST /auth/login` (public) → `{ accessToken, refreshToken }`. `server-only`.
 * Validate response ở biên (folder 11). KHÔNG set cookie ở đây (DAL không set được cookie); Server
 * Action gọi `createSession` sau khi nhận token.
 */
export function login(input: LoginInput): Promise<SessionTokens> {
  return httpPost('/auth/login', loginResponseSchema, {
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}
