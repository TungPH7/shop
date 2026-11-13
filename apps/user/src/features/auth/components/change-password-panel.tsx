import { getTranslations } from 'next-intl/server';

import { ChangePasswordForm } from '~/features/auth/components/change-password-form';
import { requireUser } from '~/lib/auth/guards';

/**
 * Wrapper server cho form đổi mật khẩu: `requireUser()` chỉ để GUARD (chưa đăng nhập → redirect /login);
 * form KHÔNG cần prefill nên không dùng giá trị trả về. Map label + code lỗi ở server → form client.
 * Đặt trong `<Suspense>` ở page (requireUser đọc cookie ⇒ dynamic).
 */
export async function ChangePasswordPanel() {
  await requireUser();
  const t = await getTranslations('ChangePasswordForm');
  const tv = await getTranslations('Validation');

  return (
    <ChangePasswordForm
      labels={{
        password: t('password'),
        newPassword: t('newPassword'),
        confirmNewPassword: t('confirmNewPassword'),
        submit: t('submit'),
        submitting: t('submitting'),
        saved: t('saved'),
      }}
      errorMessages={{
        required: tv('required'),
        too_long: tv('too_long'),
        password_too_short: tv('password_too_short'),
        password_mismatch: tv('password_mismatch'),
        authError: t('authError'),
        unknownError: t('unknownError'),
      }}
    />
  );
}
