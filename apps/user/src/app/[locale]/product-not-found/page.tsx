import { Suspense } from 'react';

import { notFound } from 'next/navigation';

/**
 * Where the Proxy rewrites a page load of a product the api does not have (AC26; plan of SHOP-7, Architecture Decisions
 * 9). The page only calls `notFound()`, so the route answers HTTP 404 and the not-found boundary of this segment shows
 * S6; a `notFound()` in the product detail page itself comes after its shell went out with 200.
 *
 * Next 16.4.6 renders this route two ways, and each needs the call in a different place (checked by hand, SHOP-24):
 * - `next build` prerenders it. Called inside a `<Suspense>`, the prerender completes with the layout, keeps 404 and
 *   stores S6. Called at once, the prerender stops at the shell and Next stores its error document with the generic
 *   `[locale]/not-found.tsx` instead.
 * - `next dev` renders it on each request and sends the shell before the `<Suspense>`, so the call inside it leaves
 *   200; called at once, it answers 404 with S6, as the build does.
 */
export default function ProductNotFoundPage() {
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
