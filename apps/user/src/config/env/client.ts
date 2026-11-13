import { createEnv } from '@t3-oss/env-nextjs';
import * as z from 'zod';

/**
 * Env phía CLIENT — an toàn cho bundle trình duyệt: CHỈ biến `NEXT_PUBLIC_*` + `shared`.
 *
 * ⭐ Vì sao TÁCH client/server thành 2 file ở folder 15 (folder 07 gộp 1 file):
 *  - File env GỘP làm lọt **tên** biến server (vd `AUTH_SECRET`) vào bundle client — t3-env
 *    chặn ĐỌC giá trị nhưng tên schema vẫn ở đó. Khi đã có secret nhạy cảm → tách để code
 *    client KHÔNG bao giờ tham chiếu schema server.
 *  - `clientEnv` chỉ chứa biến công khai → import từ Client Component an toàn tuyệt đối.
 *  - `server.ts` `extends: [clientEnv]` → code server vẫn có MỘT `env` đủ cả hai phía.
 */
export const clientEnv = createEnv({
  client: {
    // PUBLIC: bị NHÚNG vào bundle trình duyệt → ai cũng đọc được. KHÔNG để secret.
    NEXT_PUBLIC_API_URL: z.url(),
    // ⭐ Folder 21 (SEO): origin CÔNG KHAI của chính site (vd https://tungph7.com) — nguồn cho
    // `metadataBase`, canonical/hreflang, sitemap.xml, robots.txt, og:url. KHÁC NEXT_PUBLIC_API_URL
    // (đó là backend). Theo MÔI TRƯỜNG (localhost khi dev, domain thật khi prod) → là env, không phải
    // hằng `site-config`. Public (lộ trong HTML) nên dùng tiền tố NEXT_PUBLIC_.
    NEXT_PUBLIC_SITE_URL: z.url(),
  },
  shared: {
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  },
  runtimeEnv: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NODE_ENV: process.env.NODE_ENV,
  },
  emptyStringAsUndefined: true,
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
});
