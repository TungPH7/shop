import { type Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Suspense } from 'react';

import { AccountDetails } from '~/features/auth/components/account-details';
import { buildPageMetadata } from '~/lib/seo/metadata';

/** Trang tài khoản = riêng tư → noindex (folder 21). Title đã dịch; KHÔNG khai hreflang. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Account' });
  return buildPageMetadata({ locale, title: t('title'), pathname: '/account', index: false });
}

/**
 * Trang tài khoản (được bảo vệ). Shell tĩnh (`setRequestLocale` giữ prerender) + `<Suspense>` quanh
 * `AccountDetails` — phần đọc cookie/`/profile` là DYNAMIC nên phải ở Suspense (bài học Stage B/folder
 * 10). `requireUser` bên trong → chưa đăng nhập thì redirect /login.
 */
export default async function AccountPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Account');

  return (
    <main>
      <h1>{t('title')}</h1>
      <Suspense fallback={<p role="status">{t('loading')}</p>}>
        <AccountDetails />
      </Suspense>
    </main>
  );
}
