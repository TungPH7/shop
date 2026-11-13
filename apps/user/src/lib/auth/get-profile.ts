import 'server-only';

import { cache } from 'react';

import { profileSchema, type AuthUser } from '~/lib/auth/profile';
import { getSession } from '~/lib/auth/session';
import { httpGet } from '~/lib/http/client';

/**
 * DAL hồ sơ người dùng — `GET /profile` (`@ApiBearerAuth`) → user + role + permissions. `server-only`.
 *
 * ⭐ Bọc `cache()` (React): DEDUP trong CÙNG một request → nhiều `<Can>` + guard trên một trang chỉ
 * gọi `/profile` MỘT lần (quan trọng vì backend rate-limit). Ngoài request (vd unit test) cache không
 * gom → mỗi lần gọi là một fetch độc lập (không rò state giữa test).
 *
 * ⭐ Đọc cookie ⇒ request-time (NGOÀI `use cache`). Chưa đăng nhập → trả null KHÔNG gọi backend (khỏi
 * 401 vô ích). Lỗi (401 hết hạn / network / lệch schema) → null (coi như chưa có hồ sơ), KHÔNG ném.
 */
export const getProfile = cache(async (): Promise<AuthUser | null> => {
  const session = await getSession();
  if (!session) return null;
  try {
    return await httpGet('/profile', profileSchema, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
    });
  } catch {
    return null;
  }
});
