import { Suspense } from 'react';

import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { JsonLd } from '~/components/seo/json-ld';
import { ProductResults } from '~/features/product/components/product-results';
import { localizedUrl } from '~/lib/seo/alternates';
import { buildPageMetadata } from '~/lib/seo/metadata';
import { breadcrumbLd } from '~/lib/seo/structured-data';

/** Metadata trang Products (folder 21): title/description đã dịch + canonical/hreflang cho `/products`. */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Products' });
  return buildPageMetadata({
    locale,
    title: t('metaTitle'),
    description: t('metaDescription'),
    pathname: '/products',
  });
}

/**
 * S4 (`/[locale]/products`), thin: routing and composition. The static shell, in the prerender, holds the title S4.2
 * and the BreadcrumbList; the results read `searchParams` at request time, so they sit in a `<Suspense>`, which stays
 * empty until US5a (SHOP-25).
 *
 * `searchParams` (a Promise in Next 16) is not awaited here but passed down, so only the part inside the `<Suspense>`
 * is dynamic.
 */
export default async function ProductsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('Products');
  const tSeo = await getTranslations('Seo');

  return (
    <main>
      {/* BreadcrumbList JSON-LD (folder 21): Trang chủ › Sản phẩm, in the static shell. */}
      <JsonLd
        data={breadcrumbLd([
          { name: tSeo('home'), url: localizedUrl(locale, '/') },
          { name: t('title'), url: localizedUrl(locale, '/products') },
        ])}
      />
      <h1>{t('title')}</h1>
      <Suspense fallback={null}>
        <ProductResults searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
