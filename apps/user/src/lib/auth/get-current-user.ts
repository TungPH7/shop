import 'server-only';

import { decodeJwt } from 'jose';
import * as z from 'zod';

import { getSession } from '~/lib/auth/session';

/** Định danh phiên tối thiểu cho re-authorization (Server Action) + authz thô theo role. */
export interface SessionUser {
  id: number;
  role: string;
}

/** Claims ta CẦN từ access token backend (NestJS): userId + roleName + hạn (giây). */
const accessClaimsSchema = z.object({
  userId: z.number(),
  roleName: z.string(),
  exp: z.number().optional(),
});

/**
 * ⭐ SEAM re-authorization (mở từ folder 12) — GIỜ ĐÃ NỐI. Mọi Server Action ghi + RSC cần
 * hỏi "ai đang gọi?" đều đi qua ĐÂY (điểm duy nhất).
 *
 * Luồng: `getSession` (mở JWE bằng AUTH_SECRET = XÁC THỰC niêm phong CỦA TA) → `decodeJwt` access
 * token backend lấy claims. KHÔNG verify CHỮ KÝ backend (ta không giữ `ACCESS_TOKEN_SECRET` của
 * nó) — và KHÔNG cần: token tới qua HTTPS rồi được niêm phong trong cookie do CHÍNH TA mã hoá,
 * nên mở ra được nghĩa là chính ta đặt vào (toàn vẹn). Backend mới là tuyến verify chữ ký THẬT ở
 * mỗi request (phòng thủ chiều sâu) — nút bị ẩn / claim ở client KHÔNG phải ranh giới bảo mật.
 *
 * Hết hạn access token → trả null. (RSC lúc render KHÔNG refresh được vì không set được cookie;
 * refresh-rotation chạy ở Server Action / Route Handler — Stage C.)
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await getSession();
  if (!session) return null;

  let claims: unknown;
  try {
    claims = decodeJwt(session.accessToken);
  } catch {
    return null; // token rác / không phải JWT
  }

  const parsed = accessClaimsSchema.safeParse(claims);
  if (!parsed.success) return null;

  const { userId, roleName, exp } = parsed.data;
  if (exp !== undefined && exp * 1000 < Date.now()) return null; // access token đã hết hạn
  return { id: userId, role: roleName };
}
