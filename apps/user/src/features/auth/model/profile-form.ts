import { z } from 'zod';

/**
 * Model form HỒ SƠ (folder 16) — schema thuần, SHARE client (RHF + zodResolver) ↔ server (Server Action
 * re-validate). Khớp `UpdateMeBodySchema` backend (`{ name, phoneNumber, avatar }`). Phát CODE trung tính
 * (`{ error: 'code' }`) → UI map `t('Validation.<code>')` (kỷ luật folder 13).
 */
export const updateProfileSchema = z.object({
  name: z.string().min(1, { error: 'required' }).max(100, { error: 'too_long' }),
  // Backend: 9–15 ký tự HOẶC rỗng. Dùng `.refine` (1 code sạch) thay union (union làm rối code lỗi).
  phoneNumber: z
    .string()
    .refine((v) => v === '' || (v.length >= 9 && v.length <= 15), { error: 'invalid_phone' }),
  // Backend `avatar` nullable string; form cho URL hoặc rỗng. `URL.canParse` có ở Node 24 + browser.
  avatar: z.string().refine((v) => v === '' || URL.canParse(v), { error: 'invalid_url' }),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

/**
 * Response `PUT /profile` = user (không password/totp). Validate ở biên kiểu **tối thiểu** (chỉ cần
 * xác nhận cập nhật thành công) — folder 11.
 */
export const updateProfileResSchema = z.object({
  id: z.number(),
  name: z.string(),
});

/**
 * Đổi mật khẩu — khớp `ChangePasswordBodySchema` backend (`{ password, newPassword 6–100,
 * confirmNewPassword }` + superRefine `newPassword === confirmNewPassword`).
 *
 * ⭐ `superRefine` = validate LIÊN-TRƯỜNG (cross-field): zodResolver chạy nó Ở CLIENT → lệch confirm
 * hiện lỗi TỨC THÌ (bài học chính của Stage B; field-level rule thường không bắt được quan-hệ-2-field).
 * Issue đặt `path: ['confirmNewPassword']` + `message: 'password_mismatch'` (code) → gắn lỗi đúng field.
 */
export const changePasswordSchema = z
  .object({
    password: z.string().min(1, { error: 'required' }),
    newPassword: z.string().min(6, { error: 'password_too_short' }).max(100, { error: 'too_long' }),
    confirmNewPassword: z.string().min(1, { error: 'required' }),
  })
  .superRefine((data, ctx) => {
    if (data.newPassword !== data.confirmNewPassword) {
      ctx.addIssue({ code: 'custom', path: ['confirmNewPassword'], message: 'password_mismatch' });
    }
  });
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

/**
 * Kết quả các action form hồ sơ trả về (DÙNG CHUNG `updateProfileAction` + `changePasswordAction`) —
 * RHF đọc để hiện lỗi field / lỗi form / thành công. KHÔNG có `idle`: form RHF không dùng state-machine
 * `useActionState` (folder 15) — nó gọi action rồi rẽ nhánh theo kết quả (idle thừa sẽ phá narrowing).
 */
export type ProfileFormState =
  | { status: 'success' }
  | { status: 'error'; reason: 'validation'; fieldErrors: Record<string, string> }
  | { status: 'error'; reason: 'auth' | 'unknown' };
