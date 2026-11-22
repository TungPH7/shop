import { Suspense } from 'react';

import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { JsonLd } from '~/components/seo/json-ld';
import { Breadcrumb } from '~/components/ui/breadcrumb';
import { categoryDescriptionOf, categoryTitleOf } from '~/features/category/model/category-seo';
import { getStoreCategory } from '~/features/category/server/get-categories';
import { ProductResults } from '~/features/product/components/product-results';
import { ProductResultsSkeleton } from '~/features/product/components/product-results-skeleton';
import type { ProductQuery, ProductSource } from '~/features/product/model/product-query';
import { getStoreProducts } from '~/features/product/server/get-products';
import { localizedUrl } from '~/lib/seo/alternates';
import { buildPageMetadata } from '~/lib/seo/metadata';
import { breadcrumbLd } from '~/lib/seo/structured-data';

type Params = Promise<{ locale: string; slug: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** The first 24 products, the newest first: the list as the page first opens, and its first cache entry. */
const FIRST_LOAD: ProductQuery = { q: '', sort: 'newest', page: 1 };

/** The products of the category, at the slug the api stored, whatever case the path has (AC18). */
const sourceOf = (slug: string): ProductSource => ({ kind: 'category', slug });

/**
 * Metadata of S5 (SPEC of SHOP-81, section SEO, S5; AC18):
 * - `<title>`: the first tier that fits 60 characters with the suffix of the template of the root layout, which still
 *   adds it (no `title.absolute`);
 * - the meta description: sentence 1, then sentence 2 when both fit 160 characters;
 * - canonical and hreflang `vi`, `en` and `x-default` at the stored slug, with no parameter, whatever the path has;
 * - a category with no product on sale (AC15): `noindex, nofollow`, and no canonical nor hreflang. The page knows it
 *   from its first 24 products the newest first, the same cache entry as the page in its default order, so no other
 *   request goes to the api.
 *
 * The name is text: the Metadata API of Next escapes it (NFR10). No category at the slug, or one hidden or deleted since
 * its name was read: `notFound()`, as the page. An error of the api is thrown, never a 404 (NFR20).
 */
export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, slug } = await params;
  const category = await getStoreCategory(slug);
  if (!category) notFound();
  const products = await getStoreProducts(FIRST_LOAD, sourceOf(category.slug));
  if (!products) notFound();
  const t = await getTranslations({ locale, namespace: 'Category' });
  const { name } = category;

  return buildPageMetadata({
    locale,
    title: categoryTitleOf(name, [t('titleLong', { name }), t('titleShort', { name })]),
    description: categoryDescriptionOf(
      t('metaDescription1', { name }),
      t('metaDescription2', { name }),
    ),
    pathname: `/categories/${category.slug}`,
    index: products.totalItems > 0,
  });
}

/**
 * S5 (`/[locale]/categories/[slug]`, design.md of SHOP-81), thin: routing and composition of `category` (the name, the
 * breadcrumb) with `product` (the sort, the grid, Load more), plan of SHOP-81, Architecture Decisions 9. The slug is
 * known only at request time, and the category and its products are read with `cacheLife('catalog')`, dynamic holes:
 * so `params`, `searchParams` and the api are read only inside the `<Suspense>`, and `next build` never calls the api
 * (NFR6). The `<main>` takes the width of the frame, for a grid of up to 4 columns, as S4.
 *
 * On a page load, the Proxy answers 404 before this page runs for a category the api does not have (AC16); the
 * `notFound()` here serves a client navigation.
 */
export default function CategoryPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  return (
    <main className="products-page">
      <Suspense fallback={<CategoryPageSkeleton />}>
        <CategoryView params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

/**
 * The category: its JSON-LD `BreadcrumbList` and its breadcrumb from the same crumbs, Trang chủ › ‹name› with absolute
 * URLs in the locale of the path at the stored slug (S5.2, AC18); its name as the only h1 (S5.3); then its products.
 * `JsonLd` turns `<` into `<`, so a name holding `</script>` cannot close the block (NFR10).
 */
async function CategoryView({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const category = await getStoreCategory(slug);
  if (!category) notFound();
  const [tSeo, tBreadcrumb] = await Promise.all([
    getTranslations({ locale, namespace: 'Seo' }),
    getTranslations({ locale, namespace: 'Breadcrumb' }),
  ]);

  const crumbs = [
    { name: tSeo('home'), url: localizedUrl(locale, '/') },
    { name: category.name, url: localizedUrl(locale, `/categories/${category.slug}`) },
  ];

  return (
    <>
      <JsonLd data={breadcrumbLd(crumbs)} />
      <Breadcrumb items={crumbs} label={tBreadcrumb('label')} />
      <h1 className="category-title">{category.name}</h1>
      <ProductResults searchParams={searchParams} source={sourceOf(category.slug)} />
    </>
  );
}

/**
 * What S5 shows while it reads the category: the place of the breadcrumb and of the title, which wait for the name, so
 * the grid is not pushed down when they come (SEO section, S5, Core Web Vitals); then the place of the sort and 8
 * skeleton cards (S5.5, loading).
 */
function CategoryPageSkeleton() {
  return (
    <>
      <div className="category-skeleton" aria-hidden="true">
        <span className="skeleton category-skeleton__breadcrumb" />
        <span className="skeleton category-skeleton__title" />
      </div>
      <ProductResultsSkeleton search={false} />
    </>
  );
}
