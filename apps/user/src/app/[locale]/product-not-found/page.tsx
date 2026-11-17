import { Suspense } from 'react';

import { setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';

type Params = Promise<{ locale: string }>;

/**
 * Where the Proxy rewrites a page load of a product the api does not have (AC26; plan of SHOP-7, Architecture Decisions
 * 9). The page only calls `notFound()`, already when it is prerendered, so the prerender keeps HTTP 404 and its
 * not-found boundary shows S6; a `notFound()` in the product detail page itself comes after its shell went out with 200.
 *
 * The call sits in a `<Suspense>`: the prerender then completes with the layout, and the boundary of this segment, not
 * the generic `[locale]/not-found.tsx`, renders the not-found UI. Called outside it, the prerender stops at the shell
 * and Next stores its error document with the root not-found instead (checked on `next build`, SHOP-24).
 */
export default async function ProductNotFoundPage({ params }: { params: Params }) {
  const { locale } = await params;
  setRequestLocale(locale);
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
