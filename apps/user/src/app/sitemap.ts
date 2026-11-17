import { type MetadataRoute } from 'next';
import { connection } from 'next/server';

import { defaultLocale } from '~/config/i18n';
import type { SitemapEntry } from '~/features/product/model/product';
import { getSitemapEntries } from '~/features/product/server/get-sitemap-entries';
import { getPathname } from '~/i18n/navigation';
import { localizedPathnames } from '~/lib/seo/alternates';
import { absoluteUrl } from '~/lib/seo/site-url';

/**
 * `app/sitemap.ts` (folder 21) → Next serve `/sitemap.xml`. CHỈ liệt kê trang CÔNG KHAI (indexable);
 * trang noindex (login/account/forbidden/demo) KHÔNG vào sitemap.
 *
 * ⭐ i18n: MỖI trang = MỘT `<url>` với `loc` = URL locale MẶC ĐỊNH + `alternates.languages` liệt kê
 * mọi locale (Next emit `<xhtml:link rel="alternate" hreflang>` — chuẩn sitemap i18n của Google).
 * URL phải TUYỆT ĐỐI (sitemap KHÔNG qua metadataBase) → ghép qua `absoluteUrl`.
 *
 * The pages of the products on sale follow the public pages (US6c, AC28), each with its last edit as `lastmod`. The
 * static pages keep no `lastModified`: they have no date of their own.
 *
 * `connection()` before the read: the sitemap is rendered at request time, never in the prerender, so `next build` never
 * calls the api. The products come from the DAL with `cacheLife('catalog')`, so a product hidden or deleted leaves the
 * sitemap within 60 s (NFR7, NFR21). An error of the api is thrown, and Next answers 500 rather than a sitemap short of
 * products (NFR26).
 */
type RouteEntry = {
  href: string;
  changeFrequency: NonNullable<MetadataRoute.Sitemap[number]['changeFrequency']>;
  priority: number;
};

const INDEXABLE_ROUTES: RouteEntry[] = [
  { href: '/', changeFrequency: 'weekly', priority: 1 },
  { href: '/about', changeFrequency: 'monthly', priority: 0.6 },
  { href: '/products', changeFrequency: 'daily', priority: 0.8 },
];

/** The URL of `href` in the default locale, and its URL in every locale for hreflang. */
function addressesOf(href: string) {
  const languages = Object.fromEntries(
    Object.entries(localizedPathnames(href)).map(([locale, path]) => [locale, absoluteUrl(path)]),
  );
  return {
    url: absoluteUrl(getPathname({ locale: defaultLocale, href })),
    alternates: { languages },
  };
}

function productEntry({ slug, updatedAt }: SitemapEntry): MetadataRoute.Sitemap[number] {
  const { url, alternates } = addressesOf(`/products/${slug}`);
  return { url, lastModified: updatedAt, alternates };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection();
  const products = await getSitemapEntries();

  const pages = INDEXABLE_ROUTES.map(({ href, changeFrequency, priority }) => {
    const { url, alternates } = addressesOf(href);
    return { url, changeFrequency, priority, alternates };
  });
  return [...pages, ...products.map(productEntry)];
}
