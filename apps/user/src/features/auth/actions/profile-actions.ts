'use server';

import {
  changePasswordSchema,
  updateProfileSchema,
  type ProfileFormState,
} from '~/features/auth/model/profile-form';
import { changePassword } from '~/features/auth/server/change-password';
import { updateProfile } from '~/features/auth/server/update-profile';
import { getCurrentUser } from '~/lib/auth/get-current-user';
import { isApiError } from '~/lib/http/api-error';
import { getFieldErrorCodes } from '~/lib/validation/format-zod-error';

/**
 * `updateProfileAction` — Server Action cho form RHF sửa hồ sơ.
 *
 * ⭐ RHF (client) validate bằng `updateProfileSchema` cho UX; action **RE-VALIDATE CÙNG schema** ở server
 * (input là `unknown` — client có thể bị vượt qua) = defense-in-depth. → re-authz `getCurrentUser` →
 * delegate DAL `updateProfile`. KHÔNG `redirect` (form ở client tự `router.refresh()` khi success); cũng
 * KHÔNG `revalidateTag` (getProfile là `cache()` REQUEST-SCOPED, không phải `use cache` bền → refresh đủ).
 */
export async function updateProfileAction(input: unknown): Promise<ProfileFormState> {
  const parsed = updateProfileSchema.safeParse(input);
  if (!parsed.success) {
    return { status: 'error', reason: 'validation', fieldErrors: getFieldErrorCodes(parsed.error) };
  }

  const user = await getCurrentUser();
  if (!user) return { status: 'error', reason: 'auth' };

  try {
    await updateProfile(parsed.data);
  } catch (error) {
    if (isApiError(error) && error.isAuthError) return { status: 'error', reason: 'auth' };
    return { status: 'error', reason: 'unknown' };
  }

  return { status: 'success' };
}

/**
 * `changePasswordAction` — cùng pipeline (re-validate cùng `changePasswordSchema` → re-authz → DAL).
 * `unknown` gồm cả trường-hợp **mật khẩu hiện tại sai** (backend từ chối) → copy `unknownError` gợi ý
 * kiểm tra lại mật khẩu hiện tại (không tách reason riêng để giữ gọn + không lộ chi tiết).
 */
export async function changePasswordAction(input: unknown): Promise<ProfileFormState> {
  const parsed = changePasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { status: 'error', reason: 'validation', fieldErrors: getFieldErrorCodes(parsed.error) };
  }

  const user = await getCurrentUser();
  if (!user) return { status: 'error', reason: 'auth' };

  try {
    await changePassword(parsed.data);
  } catch (error) {
    if (isApiError(error) && error.isAuthError) return { status: 'error', reason: 'auth' };
    return { status: 'error', reason: 'unknown' };
  }

  return { status: 'success' };
}
