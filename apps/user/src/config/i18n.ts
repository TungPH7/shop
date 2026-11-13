/**
 * SSOT locale — dựng ở folder 08, thu gọn ở folder 09.
 *
 * Giữ HẰNG SỐ locale + 1 guard `isLocale`. Các helper định tuyến/thương lượng viết tay
 * ở folder 08 (`resolveLocale`/`hasLocalePrefix`/`localizePathname`) đã được next-intl
 * thay (middleware lo thương lượng+redirect, `Link` lo tiền tố) → gỡ bỏ để khỏi dead-code.
 *
 * ⚠️ next-intl 4.13 KHÔNG export `hasLocale` ở entry chính (thêm ở bản sau) → ta tự
 * validate bằng `isLocale` (đồng thời giữ SSOT tự chủ, không lệ thuộc API có thể đổi).
 * Hằng số này nạp vào `~/i18n/routing.ts` (`defineRouting`) → next-intl + app dùng CHUNG.
 */
export const locales = ['en', 'vi'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'en';

/** Type guard: thu hẹp `string` → `Locale` (validate param URL / `requestLocale`). */
export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}
