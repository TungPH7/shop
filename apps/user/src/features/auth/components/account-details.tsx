import { getTranslations } from 'next-intl/server';

import { requireUser } from '~/lib/auth/guards';
import { hasModule } from '~/lib/auth/permissions';
import { Link } from '~/i18n/navigation';

/**
 * Nội dung trang tài khoản — async Server Component. `requireUser()` chặn: chưa đăng nhập → redirect
 * /login. Đặt trong `<Suspense>` ở page (đọc cookie ⇒ dynamic). Hiển thị hồ sơ + minh hoạ predicate
 * `hasModule` (badge "quản lý sản phẩm" cho ADMIN/SELLER — module MANAGE-PRODUCT; ẩn với CLIENT).
 */
export async function AccountDetails() {
  const t = await getTranslations('Account');
  const user = await requireUser();
  const canManageProducts = hasModule(user.role.permissions, 'MANAGE-PRODUCT');

  return (
    <>
      <dl>
        <dt>{t('name')}</dt>
        <dd>{user.name}</dd>
        <dt>{t('email')}</dt>
        <dd>{user.email}</dd>
        <dt>{t('role')}</dt>
        <dd>{user.role.name}</dd>
        <dt>{t('permissions')}</dt>
        <dd>{user.role.permissions.length}</dd>
        {canManageProducts && (
          <>
            <dt>{t('access')}</dt>
            <dd>{t('canManageProducts')}</dd>
          </>
        )}
      </dl>
      <Link href="/account/edit">{t('editProfile')}</Link>
    </>
  );
}
