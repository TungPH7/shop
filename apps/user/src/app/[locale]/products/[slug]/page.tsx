import { Suspense } from 'react';

import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { ProductDetail, ProductDetailSkeleton } from '~/features/product/components/product-detail';
import { getStoreProduct } from '~/features/product/server/get-product';

type Params = Promise<{ locale: string; slug: string }>;

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

async function StoreProductView({ params }: { params: Params }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const product = await getStoreProduct(slug);
  if (!product) notFound();
  return <ProductDetail product={product} />;
}
