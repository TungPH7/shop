import { type MetadataRoute } from 'next';
import { connection } from 'next/server';

import { defaultLocale } from '~/config/i18n';
import type { CategorySitemapEntry } from '~/features/category/model/category';
import { getCategorySitemapEntries } from '~/features/category/server/get-categories';
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
 * pages of the categories follow them (AC19 of SHOP-81): only visible categories with a product on sale, as the api
 * gives them, each with the later of its last edit and the last edit of its products on sale as `lastmod`, and like a
 * product no `priority` nor `changeFrequency`. The static pages keep no `lastModified`: they have no date of their own.
 *
 * `connection()` before the read: the sitemap is rendered at request time, never in the prerender, so `next build` never
 * calls the api. The products and the categories come from the DAL with `cacheLife('catalog')`, read side by side, so a
 * product or a category hidden or deleted leaves the sitemap within 60 s (NFR7, NFR21; NFR6 of SHOP-81). An error of
 * the api is thrown, and Next answers 500 rather than a sitemap short of products or categories (NFR26; NFR20 of
 * SHOP-81).
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

function categoryEntry({ slug, updatedAt }: CategorySitemapEntry): MetadataRoute.Sitemap[number] {
  const { url, alternates } = addressesOf(`/categories/${slug}`);
  return { url, lastModified: updatedAt, alternates };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection();
  const [products, categories] = await Promise.all([
    getSitemapEntries(),
    getCategorySitemapEntries(),
  ]);

  const pages = INDEXABLE_ROUTES.map(({ href, changeFrequency, priority }) => {
    const { url, alternates } = addressesOf(href);
    return { url, changeFrequency, priority, alternates };
  });
  return [...pages, ...products.map(productEntry), ...categories.map(categoryEntry)];
}
