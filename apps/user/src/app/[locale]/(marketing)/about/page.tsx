import type { Metadata } from 'next';

import { getTranslations, setRequestLocale } from 'next-intl/server';

import { Link } from '~/i18n/navigation';
import { buildPageMetadata } from '~/lib/seo/metadata';

/** Metadata trang About (folder 21): title/description đã dịch + canonical/hreflang cho `/about`. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'About' });
  return buildPageMetadata({
    locale,
    title: t('metaTitle'),
    description: t('metaDescription'),
    pathname: '/about',
  });
}

/**
 * Route thứ hai `/[locale]/about`. ASYNC → `getTranslations`. `<Link href="/">` của
 * next-intl giữ locale → quay về `/en` hoặc `/vi` tuỳ ngôn ngữ hiện tại.
 */
export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('About');

  return (
    <main>
      <h1>{t('title')}</h1>
      <p>{t('description')}</p>
      <p>
        <Link href="/">{t('backHome')}</Link>
      </p>
    </main>
  );
}
