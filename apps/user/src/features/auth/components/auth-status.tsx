import { getTranslations } from 'next-intl/server';

import { LogoutButton } from '~/features/auth/components/logout-button';
import { getCurrentUser } from '~/lib/auth/get-current-user';
import { Link } from '~/i18n/navigation';

/**
 * Widget trạng thái đăng nhập — Server Component đọc `getCurrentUser` (cookie phiên) ở MỖI request.
 *
 * ⚠️ Đọc cookie ⇒ DYNAMIC (request-time) → ở layout PHẢI bọc `<Suspense>`: shell tĩnh vẫn prerender,
 * widget này stream vào như một "lỗ động" (mô hình PPR — bài học folder 10/14). Không bọc → cả site
 * thành dynamic (mất static shell).
 *
 * Chưa đăng nhập → link "Đăng nhập"; đã đăng nhập → role + nút Đăng xuất. (Email/tên đầy đủ + quyền
 * = `getProfile`, Stage C.)
 */
export async function AuthStatus() {
  const t = await getTranslations('Auth');
  const user = await getCurrentUser();

  if (!user) {
    return <Link href="/login">{t('signIn')}</Link>;
  }
  return (
    <span>
      <Link href="/account">{t('account')}</Link> · {t('signedInAs', { role: user.role })}{' '}
      <LogoutButton label={t('signOut')} />
    </span>
  );
}
