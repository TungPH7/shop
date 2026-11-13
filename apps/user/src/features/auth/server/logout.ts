import 'server-only';

import { messageResponseSchema } from '~/features/auth/model/auth';
import { type SessionTokens } from '~/lib/auth/session-seal';
import { httpPost } from '~/lib/http/client';

/**
 * DAL đăng xuất (BFF) — `POST /auth/logout` (`@ApiBearerAuth`): cần Bearer access token + body
 * `{ refreshToken }` → backend thu hồi refresh token + đánh dấu device đã logout. `server-only`.
 *
 * Best-effort: Server Action vẫn xoá cookie phía ta KỂ CẢ khi gọi này lỗi (refresh token có thể đã
 * hết hạn / đã dùng) → người dùng luôn đăng xuất được ở phía frontend.
 */
export function logout(tokens: SessionTokens): Promise<{ message: string }> {
  return httpPost('/auth/logout', messageResponseSchema, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokens.accessToken}`,
    },
    body: JSON.stringify({ refreshToken: tokens.refreshToken }),
  });
}
