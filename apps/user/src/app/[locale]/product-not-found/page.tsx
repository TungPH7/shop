import type { Metadata } from 'next';

import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'ProductNotFound' });
  return { title: t('title') };
}

/**
 * Where the Proxy rewrites a page load of a product the api does not have (AC26; plan of SHOP-7, Architecture Decisions
 * 9). The page only calls `notFound()`, already when it is prerendered, so the route answers HTTP 404 and its
 * not-found boundary shows S6; a `notFound()` in the product detail page itself comes after its shell went out with 200.
 */
export default function ProductNotFoundPage(): never {
  notFound();
}
