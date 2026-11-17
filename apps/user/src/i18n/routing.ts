import { defineRouting } from 'next-intl/routing';

import { defaultLocale, locales } from '~/config/i18n';

/**
 * Cấu hình định tuyến i18n của next-intl — nạp locale từ SSOT `~/config/i18n`.
 * `routing` là nguồn dùng chung cho: middleware (`proxy.ts`), navigation wrappers
 * (`navigation.ts`), và `getRequestConfig` (`request.ts`).
 *
 * `localePrefix` mặc định = 'always' (mọi locale đều có tiền tố: `/en`, `/vi`) — khớp
 * cấu trúc `app/[locale]` của folder 08.
 *
 * Constraint: pathWithoutLocale below cuts the prefix '/<locale>' by hand, so it holds only while `localePrefix` is
 * 'always' with the locale itself as the prefix, and there are no `pathnames` (one path for every locale) and no
 * `domains`. Change it with this config; routing.test.ts fails when the config changes.
 */
export const routing = defineRouting({
  locales,
  defaultLocale,
});

/**
 * The path of the address bar without its locale prefix: '/en/about' → '/about', '/en' → '/'. The language switcher
 * uses it rather than usePathname of next-intl, which suspends the prerender of a route with a dynamic param (SHOP-41).
 */
export function pathWithoutLocale(pathname: string, locale: string): string {
  const prefix = `/${locale}`;
  if (pathname === prefix) return '/';
  return pathname.startsWith(`${prefix}/`) ? pathname.slice(prefix.length) : pathname;
}
