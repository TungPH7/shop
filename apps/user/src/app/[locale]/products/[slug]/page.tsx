import { Suspense } from 'react';

import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { JsonLd } from '~/components/seo/json-ld';
import { Breadcrumb, type BreadcrumbItem, BreadcrumbSkeleton } from '~/components/ui/breadcrumb';
import { ProductDetail, ProductDetailSkeleton } from '~/features/product/components/product-detail';
import { descriptionOf, metaDescriptionOf } from '~/features/product/model/product';
import { getStoreProduct } from '~/features/product/server/get-product';
import { localizedUrl } from '~/lib/seo/alternates';
import { buildPageMetadata } from '~/lib/seo/metadata';
import { breadcrumbLd, productLd } from '~/lib/seo/structured-data';
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
      <Suspense fallback={<ProductPageSkeleton />}>
        <StoreProductView params={params} />
      </Suspense>
    </main>
  );
}

/**
 * What S8 shows while it reads the product: the place of the breadcrumb, then the skeleton of the card, so the card is not
 * pushed down when the breadcrumb comes (SPEC of SHOP-81, section SEO, S8, Core Web Vitals).
 */
function ProductPageSkeleton() {
  return (
    <>
      <BreadcrumbSkeleton />
      <ProductDetailSkeleton />
    </>
  );
}

/** The crumb of the category of a product, at its page in the locale of the path (AC20). */
function categoryCrumb(
  locale: string,
  { name, slug }: { name: string; slug: string },
): BreadcrumbItem {
  const href = `/categories/${slug}`;
  return { name, url: localizedUrl(locale, href), href };
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
  const [t, tBreadcrumb] = await Promise.all([
    getTranslations({ locale, namespace: 'Seo' }),
    getTranslations({ locale, namespace: 'Breadcrumb' }),
  ]);
  const url = localizedUrl(locale, `/products/${product.slug}`);

  // The breadcrumb of S8.2 of SHOP-81 and its JSON-LD BreadcrumbList, from the same crumbs (SPEC of SHOP-81, Code
  // Style): Trang chủ › ‹category› › ‹product› (AC20), or Trang chủ › ‹product› when the api gives no category, as for
  // a product with none or with a hidden one (AC21). The category comes from the product itself, with no request of its
  // own, so the trail never differs from the rest of the page (NFR6). The Product block stays a block of its own.
  const crumbs: BreadcrumbItem[] = [
    { name: t('home'), url: localizedUrl(locale, '/'), href: '/' },
    ...(product.category ? [categoryCrumb(locale, product.category)] : []),
    { name: product.name, url, href: `/products/${product.slug}` },
  ];

  return (
    <>
      <JsonLd
        data={productLd({
          name: product.name,
          description: descriptionOf(product.description) ?? t('siteDescription'),
          url,
          price: product.price,
          inStock: product.availability === 'IN_STOCK',
        })}
      />
      <JsonLd data={breadcrumbLd(crumbs)} />
      {/* Above the back link "← Sản phẩm" of S8.3, the first element of ProductDetail. */}
      <Breadcrumb items={crumbs} label={tBreadcrumb('label')} />
      <ProductDetail product={product} />
    </>
  );
}
