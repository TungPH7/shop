import { z } from 'zod';

/**
 * Model AUTH (tầng thuần: schema + type, testable nhất). File Server Action (`'use server'`) chỉ
 * export hàm async → schema/type/hằng phải ở file thường như này (giống `product-actions.ts`).
 */

/**
 * Input đăng nhập — SHARE client↔server (kỷ luật folder 13). Khớp `LoginBodySchema` backend
 * (pick email + password từ `UserSchema`). Phát CODE trung tính (`{ error: 'code' }`) → UI map i18n.
 * Password chỉ cần non-empty ở client (KHÔNG ép độ dài — tránh lộ chính sách mật khẩu; backend là
 * chốt cuối). Email rỗng cũng trượt `z.email` → code `invalid_email` (đủ cho UX đăng nhập).
 */
export const loginInputSchema = z.object({
  email: z.email({ error: 'invalid_email' }),
  password: z.string().min(1, { error: 'required' }),
});
export type LoginInput = z.infer<typeof loginInputSchema>;

/**
 * Response `POST /auth/login` (= `LoginResSchema` backend): 2 JWT do NestJS ký. Validate ở biên
 * (folder 11) → kiểu chắc chắn trước khi niêm phong vào cookie.
 */
export const loginResponseSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
});

/**
 * Envelope `{ message }` của backend (logout trả `MessageResSchema`). Định nghĩa FEATURE-LOCAL
 * (không import từ feature `product`) — mỗi feature validate biên của riêng nó (cô lập feature,
 * folder 06/11); trùng shape với product là tình cờ, KHÔNG phải để dùng chung.
 */
export const messageResponseSchema = z.object({
  message: z.string(),
});

/** Lý do đăng nhập thất bại — đủ để client map i18n, KHÔNG lộ field nào sai (chống dò tài khoản). */
export type LoginFailureReason = 'validation' | 'credentials' | 'rateLimited' | 'unknown';

/** State cho `useActionState(loginAction)` — union phân biệt + serializable (đi qua dây server↔client). */
export type LoginState =
  | { status: 'idle' }
  | { status: 'error'; reason: 'validation'; fieldErrors: Record<string, string> }
  | { status: 'error'; reason: Exclude<LoginFailureReason, 'validation'> };

export const initialLoginState: LoginState = { status: 'idle' };
