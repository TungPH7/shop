import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';

import { clientEnv } from '~/config/env/client';
import { locales } from '~/config/i18n';
import { siteConfig } from '~/lib/site-config';

/**
 * Nội dung trang chủ — Server Component ĐỒNG BỘ (no `async`) nên:
 *  - dùng `useTranslations`/`useLocale` của next-intl NGAY trong Server Component (không
 *    cần "use client"); async page thì phải dùng `getTranslations` (xem `page.tsx`);
 *  - unit-test được bằng RTL (async RSC thì không) — harness bọc `NextIntlClientProvider`.
 *
 * KHÔNG chứa `<Link>` (cần router context) → test khỏi phải mock router. Đúng chiều
 * shared → features → app: chỉ chạm tầng SHARED (`~/config/*`, `~/lib/*`).
 */
export function HomeView() {
  const t = useTranslations('Home');
  const locale = useLocale();

  return (
    <main>
      {/* ⭐ Folder 20 — hero next/image ẢNH LOCAL (public/). `priority`: ảnh above-the-fold (LCP) → preload,
          KHÔNG lazy. width/height tường minh + .hero-banner (width:100%/height:auto) → giữ tỉ lệ = 0 CLS.
          SVG → next/image TỰ đặt `unoptimized` (vector không cần resize); phục vụ từ 'self' (hợp CSP). */}
      <Image
        src="/images/hero.svg"
        alt={t('heroAlt')}
        width={1200}
        height={400}
        priority
        className="hero-banner"
      />
      <h1>{siteConfig.name}</h1>
      <p>{t('tagline')}</p>
      <p>{t('currentLanguage', { locale })}</p>
      {/* ICU plural + số: en có 'one'/'other', vi chỉ 'other' (1 dạng số nhiều). */}
      <p>{t('localesSupported', { count: locales.length })}</p>
      <p>
        {t('apiUrlLabel')} <code>{clientEnv.NEXT_PUBLIC_API_URL}</code>
      </p>
      <p>
        {t('environmentLabel')} <code>{clientEnv.NODE_ENV}</code>
      </p>
    </main>
  );
}
