import { type Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { Link } from '~/i18n/navigation';
import { buildPageMetadata } from '~/lib/seo/metadata';

/** Trang 403 = tiện ích → noindex (folder 21). Title đã dịch; KHÔNG khai hreflang. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Forbidden' });
  return buildPageMetadata({ locale, title: t('title'), pathname: '/forbidden', index: false });
}

/**
 * Trang 403 — đích redirect của `requireModule` khi user đăng nhập nhưng THIẾU quyền. Hoàn toàn TĨNH
 * (không đọc cookie) → prerender bình thường.
 */
export default async function ForbiddenPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Forbidden');

  return (
    <main>
      <h1>{t('title')}</h1>
      <p>{t('description')}</p>
      <Link href="/">{t('home')}</Link>
    </main>
  );
}
