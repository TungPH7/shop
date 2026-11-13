import { defineRouting } from 'next-intl/routing';

import { defaultLocale, locales } from '~/config/i18n';

/**
 * Cấu hình định tuyến i18n của next-intl — nạp locale từ SSOT `~/config/i18n`.
 * `routing` là nguồn dùng chung cho: middleware (`proxy.ts`), navigation wrappers
 * (`navigation.ts`), và `getRequestConfig` (`request.ts`).
 *
 * `localePrefix` mặc định = 'always' (mọi locale đều có tiền tố: `/en`, `/vi`) — khớp
 * cấu trúc `app/[locale]` của folder 08.
 */
export const routing = defineRouting({
  locales,
  defaultLocale,
});
