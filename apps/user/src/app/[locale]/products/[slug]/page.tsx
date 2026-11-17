import { Suspense } from 'react';

import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { JsonLd } from '~/components/seo/json-ld';
import { ProductDetail, ProductDetailSkeleton } from '~/features/product/components/product-detail';
import { descriptionOf, metaDescriptionOf } from '~/features/product/model/product';
import { getStoreProduct } from '~/features/product/server/get-product';
import { localizedUrl } from '~/lib/seo/alternates';
import { buildPageMetadata } from '~/lib/seo/metadata';
import { productLd } from '~/lib/seo/structured-data';
import { siteConfig } from '~/lib/site-config';

type Params = Promise<{ locale: string; slug: string }>;

/**
 * Metadata of S5 (US6c, AC27):
 * - `<title>` "‹name› | ‹site›", absolute, since the template `%s · ‹site›` of the root layout would not give it;
 * - the meta description is the first 160 characters of the description, its line breaks folded, or the sentence of the
 *   site when the product has none. The Metadata API of Next escapes it (NFR11);
 * - canonical and hreflang `vi`, `en` and `x-default` at the stored slug, whatever case the path has.
 *
 * It reads `params` and the product, so it runs at request time and streams with the product view; the product comes
 * from the same cache entry as the view's. No product: `notFound()`, as the page. An error of the api is thrown, never a
 * 404 (NFR26).
 */
export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, slug } = await params;
  const product = await getStoreProduct(slug);
  if (!product) notFound();
  const t = await getTranslations({ locale, namespace: 'Seo' });

  return {
    ...buildPageMetadata({
      locale,
      title: product.name,
      description: metaDescriptionOf(product.description) ?? t('siteDescription'),
      pathname: `/products/${product.slug}`,
    }),
    title: { absolute: `${product.name} | ${siteConfig.name}` },
  };
}

/**
 * S5 (`/[locale]/products/[slug]`), thin: routing and composition. The slug is known only at request time, and the
 * product is read with `cacheLife('catalog')`, a dynamic hole (plan of SHOP-7, Architecture Decisions 8): so `params`
 * and the product are read only inside the `<Suspense>`, and `next build` never calls the api. The static shell is the
 * frame of the layout, this `<main>` and the skeleton.
 *
 * No product at the slug: `notFound()`. On a page load the Proxy of US6b (SHOP-24) answers 404 before this page runs,
 * since the status is sent with the shell; this `notFound()` serves a client navigation. An error of the api is thrown
 * to the error boundary, never a 404 (NFR26).
 */
export default function ProductPage({ params }: { params: Params }) {
  return (
    <main className="product-page">
      <Suspense fallback={<ProductDetailSkeleton />}>
        <StoreProductView params={params} />
      </Suspense>
    </main>
  );
}

/**
 * The product, and its JSON-LD `Product` (AC27): the full description, or the sentence of the site when it has none
 * (`descriptionOf`, the rule of the meta description too); the address at the stored slug in the locale of the path.
 * Rendered through `JsonLd`, which turns `<` into `\u003c`, so a description holding `</script>` cannot close the
 * block (NFR11).
 */
async function StoreProductView({ params }: { params: Params }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const product = await getStoreProduct(slug);
  if (!product) notFound();
  const t = await getTranslations({ locale, namespace: 'Seo' });

  return (
    <>
      <JsonLd
        data={productLd({
          name: product.name,
          description: descriptionOf(product.description) ?? t('siteDescription'),
          url: localizedUrl(locale, `/products/${product.slug}`),
          price: product.price,
          inStock: product.availability === 'IN_STOCK',
        })}
      />
      <ProductDetail product={product} />
    </>
  );
}
