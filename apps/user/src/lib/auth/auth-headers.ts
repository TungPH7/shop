import 'server-only';

import { getSession } from '~/lib/auth/session';

/**
 * Header `Authorization: Bearer …` cho lời gọi backend CẦN xác thực (DAL mutation, getProfile).
 *
 * ⭐ Seam attach-token (folder 11/12): đọc cookie phiên NGOÀI `use cache` (luật cô lập folder 10)
 * rồi trả header để caller truyền vào `init.headers` của http client — client chỉ FORWARD, KHÔNG
 * tự đọc cookie. Chưa đăng nhập → `{}` (không header) → backend trả 401 (defense-in-depth).
 */
export async function authHeaders(): Promise<Record<string, string>> {
  const session = await getSession();
  return session ? { Authorization: `Bearer ${session.accessToken}` } : {};
}
