import { Suspense } from 'react';

import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';

/**
 * The title of S6 (SPEC of SHOP-81, section SEO, S6): "Không tìm thấy danh mục", for the template of the root layout to
 * add its suffix. No canonical, no hreflang and no JSON-LD; no `noindex` by hand, since Next sets it for the 404.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'CategoryNotFound' });
  return { title: t('title') };
}

/**
 * Where the Proxy rewrites a page load of a category the api does not have (AC16; plan of SHOP-81, Architecture
 * Decisions 10), as `/[locale]/product-not-found` does for a product (SHOP-24). The page only calls `notFound()`, so
 * the route answers HTTP 404 and the not-found boundary of this segment shows S6.
 *
 * Next 16.4.6 renders this route two ways, and each needs the call in a different place (see product-not-found):
 * `next build` prerenders it, and the call inside a `<Suspense>` keeps 404 and stores S6; `next dev` renders it on each
 * request, and the call at once answers 404 with S6.
 */
export default function CategoryNotFoundPage() {
  if (process.env.NODE_ENV === 'development') notFound();
  return (
    <Suspense fallback={null}>
      <NotFoundSignal />
    </Suspense>
  );
}

/** Throws the 404 of the route from inside the boundary: a component, since notFound() works by throwing in render. */
function NotFoundSignal(): never {
  notFound();
}
