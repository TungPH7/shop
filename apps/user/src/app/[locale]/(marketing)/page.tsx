import type { Metadata } from 'next';

import { getTranslations, setRequestLocale } from 'next-intl/server';

import { HomeView } from '~/features/site/components/home-view';
import { Link } from '~/i18n/navigation';
import { buildPageMetadata } from '~/lib/seo/metadata';

/**
 * Metadata trang chủ (folder 21): title + description ĐÃ DỊCH + canonical/hreflang cho href `/`.
 * `getTranslations({locale})` locale tường minh → prerender tĩnh (giữ `◐`). `buildPageMetadata` lo
 * `alternates` (canonical locale hiện tại + languages en/vi/x-default). Title ghép template gốc:
 * "…· tungph7 codebase".
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Home' });
  return buildPageMetadata({
    locale,
    title: t('metaTitle'),
    description: t('metaDescription'),
    pathname: '/',
  });
}

/**
 * Trang chủ `/[locale]` trong route group `(marketing)` (KHÔNG thêm vào URL). ASYNC page
 * → dùng `getTranslations` (KHÔNG `useTranslations` — hook đó cho component đồng bộ).
 * MỎNG: `setRequestLocale` (SSG) → giao render cho feature `site` (HomeView) + 1 link.
 */
export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Home');

  return (
    <>
      <HomeView />
      <nav>
        {/* next-intl <Link> tự thêm tiền tố locale → /en/about hoặc /vi/about. */}
        <Link href="/about">{t('aboutLink')}</Link> <Link href="/caching">{t('cachingLink')}</Link>{' '}
        <Link href="/products">{t('productsLink')}</Link>{' '}
        <Link href="/error-demo">{t('errorDemoLink')}</Link>
      </nav>
    </>
  );
}
