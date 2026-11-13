import { type Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Suspense } from 'react';

import { ChangePasswordPanel } from '~/features/auth/components/change-password-panel';
import { ProfileEditPanel } from '~/features/auth/components/profile-edit-panel';
import { buildPageMetadata } from '~/lib/seo/metadata';

/** Trang sửa hồ sơ = riêng tư → noindex (folder 21). Title đã dịch; KHÔNG khai hreflang. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'ProfileForm' });
  return buildPageMetadata({ locale, title: t('title'), pathname: '/account/edit', index: false });
}

/**
 * Trang sửa hồ sơ (được bảo vệ). Shell tĩnh + `<Suspense>` quanh `ProfileEditPanel` (đọc cookie/`/profile`
 * ⇒ dynamic — bài học folder 15). `requireUser` bên trong → chưa đăng nhập thì redirect /login.
 */
export default async function AccountEditPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('ProfileForm');
  const tc = await getTranslations('ChangePasswordForm');

  return (
    <main>
      <h1>{t('title')}</h1>
      <Suspense fallback={<p role="status">{t('loading')}</p>}>
        <ProfileEditPanel />
      </Suspense>

      <h2>{tc('title')}</h2>
      <Suspense fallback={<p role="status">{tc('loading')}</p>}>
        <ChangePasswordPanel />
      </Suspense>
    </main>
  );
}
