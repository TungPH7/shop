import { getTranslations } from 'next-intl/server';

import { UserIcon } from '~/components/ui/icons';
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
 * Chưa đăng nhập → link "Đăng nhập"; đã đăng nhập → link Tài khoản, role và nút Đăng xuất. Nằm cuối viên tiện ích của
 * thanh điều hướng S4.1 (SHOP-11): mỗi điều khiển là `.nav-btn` có biểu tượng (aria-hidden) và chữ; dưới 1024 px chỉ
 * hiện biểu tượng, chữ và role ẩn bằng CSS nhưng vẫn là tên cho trình đọc màn hình (components.css, Page frame).
 */
export async function AuthStatus() {
  const t = await getTranslations('Auth');
  const user = await getCurrentUser();

  if (!user) {
    return (
      <Link className="nav-btn" href="/login" title={t('signIn')}>
        <UserIcon className="nav-btn__icon" />
        <span className="nav-btn__label">{t('signIn')}</span>
      </Link>
    );
  }
  return (
    <span className="nav-account">
      <Link className="nav-btn" href="/account" title={t('account')}>
        <UserIcon className="nav-btn__icon" />
        <span className="nav-btn__label">{t('account')}</span>
      </Link>
      <span className="nav-account__role">{t('signedInAs', { role: user.role })}</span>
      <LogoutButton label={t('signOut')} />
    </span>
  );
}
