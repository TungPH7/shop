'use client';

import { useLocale, useTranslations } from 'next-intl';

import { locales } from '~/config/i18n';
import { getPathname, usePathname } from '~/i18n/navigation';

/**
 * Đổi ngôn ngữ — HEADLESS (chỉ `<button>`, không style; consumer tự skin ở Phase 1.2).
 * Client Component (cần `onClick` + đọc locale/pathname phía client).
 *
 * ⭐ Đổi locale = FULL RELOAD CỐ Ý (`window.location.replace`), KHÔNG soft-nav
 * (`router.replace`). Vì sao: soft-nav re-render layout `[locale]` (nơi render `<html>`)
 * trên client → next-themes bị gạt class `.dark` khỏi `<html>` 1 frame rồi gắn lại SAU
 * paint → CHỚP TRẮNG (`--background` rơi về `:root` light = `oklch(1 0 0)`). Nạp lại
 * trang ⇒ blocking script anti-FOUC của next-themes chạy TRƯỚC paint ⇒ `<html>` có
 * `.dark` ngay frame đầu ⇒ hết chớp; đồng thời triệt cảnh báo React-19 "script tag"
 * (không còn client re-render — [02 §4.1]). Đánh đổi: mất SPA-soft-nav cho RIÊNG hành
 * động đổi ngôn ngữ (hiếm → chấp nhận). KHÔNG đổi lại `router.replace` (tái phát chớp
 * trắng). Chi tiết + nguồn: docs 22 §4.2.
 */
export function LanguageSwitcher() {
  const t = useTranslations('LanguageSwitcher');
  const activeLocale = useLocale();
  const pathname = usePathname();

  return (
    <nav aria-label={t('label')}>
      {locales.map((locale) => (
        <button
          key={locale}
          type="button"
          disabled={locale === activeLocale}
          aria-current={locale === activeLocale}
          onClick={() => {
            // Full reload (KHÔNG router.replace) chống chớp trắng theme — xem JSDoc trên.
            // getPathname thêm tiền tố locale (localePrefix 'always'): '/about' → '/vi/about'.
            window.location.replace(getPathname({ href: pathname, locale }));
          }}
        >
          {locale.toUpperCase()}
        </button>
      ))}
    </nav>
  );
}
