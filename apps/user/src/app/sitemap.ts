import { type MetadataRoute } from 'next';

import { defaultLocale } from '~/config/i18n';
import { getPathname } from '~/i18n/navigation';
import { localizedPathnames } from '~/lib/seo/alternates';
import { absoluteUrl } from '~/lib/seo/site-url';

/**
 * `app/sitemap.ts` (folder 21) → Next serve `/sitemap.xml`. CHỈ liệt kê trang CÔNG KHAI (indexable);
 * trang noindex (login/account/forbidden/demo) KHÔNG vào sitemap. KHÔNG fetch backend (giữ sitemap
 * tĩnh + tránh phụ thuộc backend/rate-limit lúc build — bài học folder 11/13).
 *
 * ⭐ i18n: MỖI trang = MỘT `<url>` với `loc` = URL locale MẶC ĐỊNH + `alternates.languages` liệt kê
 * mọi locale (Next emit `<xhtml:link rel="alternate" hreflang>` — chuẩn sitemap i18n của Google).
 * URL phải TUYỆT ĐỐI (sitemap KHÔNG qua metadataBase) → ghép qua `absoluteUrl`.
 *
 * Bỏ `lastModified` để sitemap giữ TĨNH (cached) — thêm khi trang có mốc "cập nhật" thật.
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

export default function sitemap(): MetadataRoute.Sitemap {
  return INDEXABLE_ROUTES.map(({ href, changeFrequency, priority }) => {
    const languages = Object.fromEntries(
      Object.entries(localizedPathnames(href)).map(([locale, path]) => [locale, absoluteUrl(path)]),
    );
    return {
      url: absoluteUrl(getPathname({ locale: defaultLocale, href })),
      changeFrequency,
      priority,
      alternates: { languages },
    };
  });
}
