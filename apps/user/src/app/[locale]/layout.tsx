import type { Metadata } from 'next';
import { Suspense, type ReactNode } from 'react';

import { NextIntlClientProvider } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';

import { JsonLd } from '~/components/seo/json-ld';
import { LanguageSwitcher } from '~/components/language-switcher';
import { ThemeProvider } from '~/components/theme-provider';
import { ThemeSwitcher } from '~/components/theme-switcher';
import { WebVitals } from '~/components/web-vitals';
import { sans } from '~/config/fonts';
import { defaultLocale, isLocale, type Locale, locales } from '~/config/i18n';
import { AuthStatus } from '~/features/auth/components/auth-status';
import { SiteFooter } from '~/features/site/components/site-footer';
import { getCopyrightYear } from '~/features/site/model/get-copyright-year';
import { siteUrl } from '~/lib/seo/site-url';
import { organizationLd, webSiteLd } from '~/lib/seo/structured-data';
import { siteConfig } from '~/lib/site-config';

import '~/styles/tokens.css';
import '~/app/globals.css';

// Map locale app → cặp og:locale (định dạng OG `ll_CC`). Đủ cho 2 locale; thêm locale → thêm dòng.
const OG_LOCALES: Record<Locale, { current: string; alternate: string[] }> = {
  en: { current: 'en_US', alternate: ['vi_VN'] },
  vi: { current: 'vi_VN', alternate: ['en_US'] },
};

// SSG: sinh sẵn trang tĩnh cho từng locale.
export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

/**
 * Metadata GỐC (folder 21) — Next merge NÔNG từ gốc xuống nên đây là mặc định cho MỌI trang con:
 *  - `metadataBase`: origin site → field URL tương đối (canonical/hreflang/og) tự ghép thành tuyệt đối;
 *  - `title.template` `%s · siteName` + `title.default`: trang con chỉ cần đặt title ngắn ("About") →
 *    ra "About · tungph7 codebase"; trang không đặt title thì rơi về `default`;
 *  - `description`/`openGraph`/`twitter` ĐÃ DỊCH theo locale. ⭐ Dùng `getTranslations({locale})` với
 *    locale TƯỜNG MINH → metadata vẫn PRERENDER tĩnh (không kéo request-time, giữ `◐` PPR — docs Next +
 *    next-intl). Ảnh OG KHÔNG khai tay: lấy tự động từ `opengraph-image.tsx` (file convention).
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Seo' });
  const og = OG_LOCALES[isLocale(locale) ? locale : defaultLocale];

  return {
    metadataBase: new URL(siteUrl),
    title: { default: siteConfig.name, template: `%s · ${siteConfig.name}` },
    description: t('siteDescription'),
    applicationName: siteConfig.name,
    openGraph: {
      type: 'website',
      siteName: siteConfig.name,
      locale: og.current,
      alternateLocale: og.alternate,
    },
    twitter: { card: 'summary_large_image' },
  };
}

/**
 * ROOT LAYOUT trong segment [locale] (KHÔNG có app/layout.tsx riêng). Folder 09:
 * - validate locale bằng `isLocale` (next-intl 4.13 chưa export `hasLocale`) → notFound;
 * - `setRequestLocale` cho RSC đọc locale khi RENDER TĨNH (gọi ở MỌI layout+page tĩnh);
 * - `NextIntlClientProvider` (v4 tự kế thừa locale+messages từ getRequestConfig) → client
 *   component (LanguageSwitcher) dùng `useTranslations`/`useLocale` được.
 */
export default async function LocaleLayout({
  children,
  params,
}: Readonly<{ children: ReactNode; params: Promise<{ locale: string }> }>) {
  const { locale } = await params; // ⚠️ Next 16: params là Promise → await
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  // Năm bản quyền qua `use cache` (folder 10): current-time không đọc trực tiếp lúc prerender.
  const copyrightYear = await getCopyrightYear();

  return (
    <html lang={locale} className={sans.variable} suppressHydrationWarning>
      <body suppressHydrationWarning>
        {/* JSON-LD SITE-WIDE (folder 21): thực thể Organization + WebSite. Constant, language-neutral
            → an toàn ở static shell dưới cacheComponents (không đọc request-time, giống WebVitals). */}
        <JsonLd data={organizationLd()} />
        <JsonLd data={webSiteLd()} />
        {/* RUM Web Vitals (folder 18): client island trả null → đẩy Core Web Vitals vào seam
            Analytics. Không đọc dữ liệu request-time → an toàn ở static shell dưới cacheComponents. */}
        <WebVitals />
        {/* ThemeProvider (next-themes, folder 22) bọc NGOÀI: client provider KHÔNG đọc
            request-time / KHÔNG Math.random → an toàn static shell (giữ PPR `◐`). Đặt
            ngoài NextIntlClientProvider để ThemeSwitcher có CẢ theme + i18n context. */}
        <ThemeProvider>
          <NextIntlClientProvider>
            {/* AuthStatus đọc cookie phiên ⇒ DYNAMIC → bọc Suspense để giữ static shell (PPR). */}
            <Suspense fallback={null}>
              <AuthStatus />
            </Suspense>
            <LanguageSwitcher />
            <ThemeSwitcher />
            {children}
            {/* app → feature: composition root ghép feature `site`. */}
            <SiteFooter year={copyrightYear} />
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
