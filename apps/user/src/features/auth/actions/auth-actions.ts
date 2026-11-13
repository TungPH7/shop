'use server';

import { getLocale } from 'next-intl/server';

import { initialLoginState, loginInputSchema, type LoginState } from '~/features/auth/model/auth';
import { login } from '~/features/auth/server/login';
import { logout } from '~/features/auth/server/logout';
import { createSession, deleteSession, getSession } from '~/lib/auth/session';
import { isApiError } from '~/lib/http/api-error';
import { getFieldErrorCodes } from '~/lib/validation/format-zod-error';
import { redirect } from '~/i18n/navigation';

/**
 * `'use server'` → mọi export là Server Action (endpoint POST công khai → KHÔNG tin input).
 *
 * loginAction — pipeline xác thực: **validate → DAL login → createSession (niêm phong cookie) →
 * redirect**. Lỗi-dự-kiến (sai input / sai mật khẩu / rate-limit) TRẢ state cho `useActionState`
 * hiển thị; KHÔNG ném qua boundary. Thành công thì `redirect()` (ném NEXT_REDIRECT) → không trả state.
 */
export async function loginAction(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginInputSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  });
  if (!parsed.success) {
    return { status: 'error', reason: 'validation', fieldErrors: getFieldErrorCodes(parsed.error) };
  }

  let tokens;
  try {
    tokens = await login(parsed.data);
  } catch (error) {
    if (isApiError(error)) {
      if (error.status === 429) return { status: 'error', reason: 'rateLimited' };
      // Mọi 4xx khác (401 sai mật khẩu / 404 email không tồn tại / 422…) → 'credentials':
      // KHÔNG nói rõ field nào sai (chống dò tài khoản — account enumeration).
      if (error.status !== undefined && error.status >= 400 && error.status < 500) {
        return { status: 'error', reason: 'credentials' };
      }
    }
    return { status: 'error', reason: 'unknown' };
  }

  await createSession(tokens);
  redirect({ href: '/', locale: await getLocale() }); // thành công → về trang chủ (AuthStatus hiện trạng thái)
  // next-intl `redirect` ném NEXT_REDIRECT (dòng dưới KHÔNG chạy lúc runtime) nhưng TS suy ra kiểu
  // trả `void` (không phải `never`) → cần return để đủ kiểu Promise<LoginState> cho useActionState.
  return initialLoginState;
}

/**
 * logoutAction — best-effort thu hồi token ở backend rồi LUÔN xoá cookie phía ta + redirect.
 * Dùng qua `<form action={logoutAction}>` (LogoutButton) → nhận FormData (bỏ qua).
 */
export async function logoutAction(): Promise<void> {
  const session = await getSession();
  if (session) {
    try {
      await logout(session);
    } catch {
      // best-effort: refresh token có thể đã hết hạn / đã dùng → vẫn đăng xuất phía frontend.
    }
  }
  await deleteSession();
  redirect({ href: '/', locale: await getLocale() });
}
