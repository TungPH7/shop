import { type MetadataRoute } from 'next';

import { absoluteUrl, siteUrl } from '~/lib/seo/site-url';

/**
 * `app/robots.ts` (folder 21) → Next serve `/robots.txt`.
 *
 * ⭐ Chỉ `disallow: /api/*` (BFF endpoints — không phải nội dung để index). KHÔNG disallow các trang
 * riêng tư (login/account/...) ở đây: robots `Disallow` chỉ CHẶN CRAWL, KHÔNG gỡ khỏi index — muốn
 * "đừng index" thì để Google CRAWL ĐƯỢC rồi đọc `<meta robots noindex>` (đã đặt qua `buildPageMetadata
 * index:false`). Disallow một URL đã lỡ index còn khiến Google không thấy thẻ noindex → mắc kẹt.
 *
 * `host` + `sitemap` dùng URL TUYỆT ĐỐI (origin công khai từ env).
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/api/'] },
    sitemap: absoluteUrl('/sitemap.xml'),
    host: siteUrl,
  };
}
