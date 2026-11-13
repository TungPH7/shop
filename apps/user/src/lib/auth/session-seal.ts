import 'server-only';

import { EncryptJWT, jwtDecrypt } from 'jose';
import * as z from 'zod';

import { env } from '~/config/env/server';

/**
 * Cặp token backend (NestJS ký HS256 bằng secret CỦA NÓ — ta KHÔNG giữ secret đó). Đây là
 * "thông tin đăng nhập" mà ta niêm phong vào cookie phiên.
 */
export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
}

/**
 * Schema cặp token `{ accessToken, refreshToken }`. Dùng cho: (1) validate payload JWE khi mở cookie;
 * (2) validate response `POST /auth/refresh-token` ở biên (refresh-rotation, shared — KHÔNG import từ
 * feature). Login response (feature) có schema riêng (cô lập feature).
 */
export const sessionTokensSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
});

/**
 * Thời hạn phiên = bám theo refresh token backend (~7 ngày). Hết hạn → mở cookie trả null (coi
 * như đăng xuất). Mỗi lần refresh (rotation) sẽ NIÊM PHONG LẠI với 7 ngày mới.
 */
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

/**
 * ⭐ Vì sao MÃ HOÁ (JWE) chứ không chỉ KÝ (JWS): payload chứa accessToken/refreshToken backend
 * = bearer credentials NHẠY CẢM. JWS chỉ chống sửa (payload vẫn đọc được base64); JWE (A256GCM)
 * làm payload TỐI NGHĨA kể cả khi cookie bị rò. httpOnly + Secure + `__Host-` đã chặn JS đọc /
 * đánh cắp cross-site; mã hoá là phòng thủ chiều sâu cho chính giá trị token bên trong.
 *
 * ⭐ Khoá: A256GCM cần khoá 32-BYTE. Ta SHA-256(AUTH_SECRET) → luôn ra đúng 32 byte bất kể độ
 * dài secret đầu vào (chuẩn hoá). `alg:'dir'` = dùng trực tiếp khoá đối xứng (không bọc khoá).
 * Web Crypto (`crypto.subtle`) là global ở Node 24 + runtime Next → chạy được cả server lẫn test.
 */
async function deriveKey(): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(env.AUTH_SECRET));
  return new Uint8Array(digest);
}

/** Niêm phong cặp token thành chuỗi JWE (giá trị đặt vào cookie). */
export async function sealSession(tokens: SessionTokens): Promise<string> {
  return new EncryptJWT({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken })
    .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .encrypt(await deriveKey());
}

/**
 * Mở (giải mã + kiểm hạn) chuỗi JWE. Trả `null` nếu: thiếu, sai khoá / bị giả mạo, hết hạn, hoặc
 * payload sai shape → MỌI lỗi đều coi như "không có phiên" (an toàn, KHÔNG ném ra ngoài).
 */
export async function openSession(sealed: string | undefined): Promise<SessionTokens | null> {
  if (!sealed) return null;
  try {
    const { payload } = await jwtDecrypt(sealed, await deriveKey());
    const parsed = sessionTokensSchema.safeParse(payload);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
