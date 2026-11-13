import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { CachingDemo } from '~/features/caching-demo/components/caching-demo';
import { buildPageMetadata } from '~/lib/seo/metadata';

/** Trang demo caching = trang demo → noindex (folder 21). Title đã dịch; KHÔNG khai hreflang. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'CachingDemo' });
  return buildPageMetadata({ locale, title: t('title'), pathname: '/caching', index: false });
}

/**
 * Route demo folder 10: rendering & caching (Cache Components).
 * MỎNG (app/ = routing): `await` locale → `setRequestLocale` (giữ shell prerender tĩnh) → giao
 * feature `caching-demo` render. `generateStaticParams` của `[locale]/layout` đã sinh sẵn en/vi
 * nên `/en/caching` & `/vi/caching` được prerender (shell tĩnh + 1 dynamic hole = PPR).
 */
export default async function CachingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);

  return <CachingDemo />;
}
