import { Suspense } from 'react';

import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';

import { JsonLd } from '~/components/seo/json-ld';
import { ProductResults } from '~/features/product/components/product-results';
import { RefreshProductsButton } from '~/features/product/components/refresh-products-button';
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
 * Trang `/[locale]/products` — MỎNG (app/ = routing + composition). Shell TĨNH (PPR): tiêu đề + intro
 * + nút làm mới. Phần phụ thuộc `searchParams` (lọc/sắp/phân trang — folder 13) là ĐỘNG → tách
 * `ProductResults` + bọc `<Suspense>` (giữ shell prerender, đúng mẫu dynamic-hole folder 10).
 *
 * ⭐ `searchParams` (Next 16 = Promise) KHÔNG await ở đây mà truyền XUỐNG `ProductResults` await BÊN
 * TRONG → page không bị kéo thành fully-dynamic; chỉ phần kết quả nằm trong Suspense là động.
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
      {/* BreadcrumbList JSON-LD (folder 21): Trang chủ › Sản phẩm. Ở STATIC SHELL (không phụ thuộc data
          fetch) → nằm trong HTML prerender (khác ItemList trong ProductResults = stream theo data). */}
      <JsonLd
        data={breadcrumbLd([
          { name: tSeo('home'), url: localizedUrl(locale, '/') },
          { name: t('title'), url: localizedUrl(locale, '/products') },
        ])}
      />
      <h1>{t('title')}</h1>
      <p>{t('intro')}</p>
      {/* Server Action = request-time (uncached) → KHÔNG để trong static shell ngoài Suspense
          (cacheComponents báo "blocking-route" ở dev). Bọc Suspense riêng → stream độc lập, shell vẫn
          tĩnh, no-JS vẫn nhận form trong HTML đã stream. (DeleteProductButton đã nằm trong Suspense của
          ProductResults nên không vướng.) */}
      <Suspense fallback={null}>
        <RefreshProductsButton label={t('refresh')} doneLabel={t('refreshed')} />
      </Suspense>
      <Suspense fallback={<p role="status">{t('loading')}</p>}>
        <ProductResults searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
