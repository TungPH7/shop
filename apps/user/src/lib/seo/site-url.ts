import { clientEnv } from '~/config/env/client';

/**
 * Origin CÔNG KHAI của site (đã bỏ dấu `/` cuối) — nguồn DUY NHẤT cho mọi URL tuyệt đối SEO
 * (sitemap.xml, robots.txt, JSON-LD). `metadataBase` (root layout) lo việc ghép URL tuyệt đối
 * cho các field trong `Metadata` nên ở ĐÓ chỉ cần path tương đối; sitemap/robots/JSON-LD KHÔNG
 * qua metadataBase nên phải tự ghép absolute qua helper này.
 */
export const siteUrl = clientEnv.NEXT_PUBLIC_SITE_URL.replace(/\/$/, '');

/** Ghép path tương đối → URL TUYỆT ĐỐI dựa trên `siteUrl`. */
export function absoluteUrl(path: string): string {
  return `${siteUrl}${path.startsWith('/') ? path : `/${path}`}`;
}
