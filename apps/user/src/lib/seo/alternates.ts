import { type Metadata } from 'next';

import { defaultLocale, isLocale, locales } from '~/config/i18n';
import { getPathname } from '~/i18n/navigation';
import { absoluteUrl } from '~/lib/seo/site-url';

/**
 * Map MỌI locale → pathname (tương đối, đã có tiền tố locale) cho một href logic.
 * Dùng `getPathname` của next-intl (KHÔNG nối `/${locale}${href}` tay) → đúng theo `routing`
 * và tự đúng kể cả khi sau này khai localized pathnames (vd `/vi/san-pham`).
 */
export function localizedPathnames(href: string): Record<string, string> {
  const map: Record<string, string> = {};
  for (const locale of locales) {
    map[locale] = getPathname({ locale, href });
  }
  return map;
}

/**
 * `alternates` cho `generateMetadata` của một trang:
 *  - `canonical` = URL của CHÍNH locale hiện tại (chống nội dung trùng giữa các locale);
 *  - `languages` = mọi locale + `x-default` (Google dùng cho người dùng không khớp ngôn ngữ nào).
 *
 * Trả PATH TƯƠNG ĐỐI — `metadataBase` (root layout) sẽ ghép thành URL tuyệt đối + emit thẻ
 * `<link rel="canonical">` / `<link rel="alternate" hreflang>`.
 */
export function localizedAlternates(localeInput: string, href: string): Metadata['alternates'] {
  const currentLocale = isLocale(localeInput) ? localeInput : defaultLocale;
  return {
    canonical: getPathname({ locale: currentLocale, href }),
    languages: {
      ...localizedPathnames(href),
      'x-default': getPathname({ locale: defaultLocale, href }),
    },
  };
}

/**
 * URL TUYỆT ĐỐI (kèm tiền tố locale) cho một href logic — dùng nơi cần absolute KHÔNG qua metadataBase:
 * JSON-LD (breadcrumb `item`, ItemList `url`), og:url tay… `metadataBase` chỉ áp cho field trong
 * `Metadata`, KHÔNG áp cho chuỗi ta tự nhúng vào JSON-LD.
 */
export function localizedUrl(localeInput: string, href: string): string {
  const currentLocale = isLocale(localeInput) ? localeInput : defaultLocale;
  return absoluteUrl(getPathname({ locale: currentLocale, href }));
}
