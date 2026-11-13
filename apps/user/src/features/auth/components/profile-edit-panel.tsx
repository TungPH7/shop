import { getTranslations } from 'next-intl/server';

import { ProfileEditForm } from '~/features/auth/components/profile-edit-form';
import { requireUser } from '~/lib/auth/guards';

/**
 * Wrapper server cho form sửa hồ sơ: `requireUser()` chặn (chưa đăng nhập → redirect /login) + `getProfile`
 * (qua requireUser) → bơm `defaultValues` prefill. Map label + code lỗi sang chuỗi đã dịch Ở SERVER rồi
 * truyền xuống form client (giữ `t()` type-safe). Đặt trong `<Suspense>` ở page (đọc cookie ⇒ dynamic).
 */
export async function ProfileEditPanel() {
  const user = await requireUser();
  const t = await getTranslations('ProfileForm');
  const tv = await getTranslations('Validation');

  return (
    <ProfileEditForm
      defaultValues={{ name: user.name, phoneNumber: user.phoneNumber, avatar: user.avatar ?? '' }}
      labels={{
        name: t('name'),
        phoneNumber: t('phoneNumber'),
        avatar: t('avatar'),
        submit: t('submit'),
        submitting: t('submitting'),
        saved: t('saved'),
      }}
      errorMessages={{
        required: tv('required'),
        too_long: tv('too_long'),
        invalid_phone: tv('invalid_phone'),
        invalid_url: tv('invalid_url'),
        authError: t('authError'),
        unknownError: t('unknownError'),
      }}
    />
  );
}
