import { type Messages } from 'next-intl';
import { getRequestConfig } from 'next-intl/server';

import { defaultLocale, isLocale } from '~/config/i18n';

/**
 * Cấu hình i18n PER-REQUEST cho Server Components — `next.config` trỏ tới file này qua
 * plugin. Mỗi request: xác định locale (validate `isLocale` → fallback default) rồi nạp
 * messages của locale đó. (v4: BẮT BUỘC return `locale`.)
 */
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = requested && isLocale(requested) ? requested : defaultLocale;

  // Nạp ĐỘNG theo locale → mỗi locale 1 chunk, CHỈ chạy ở server. Đường dẫn TƯƠNG ĐỐI là
  // mẫu chính thức next-intl (messages/ ở gốc, ngoài src). Cast `Messages` (kiểu augment
  // từ en.json) vì dynamic `import()` template path bị tsc suy ra `any`.
  const imported = (await import(`../../messages/${locale}.json`)) as { default: Messages };

  return {
    locale,
    messages: imported.default,
  };
});
