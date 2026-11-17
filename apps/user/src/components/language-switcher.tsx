'use client';

import { useLocale, useTranslations } from 'next-intl';

import { locales } from '~/config/i18n';
import { getPathname } from '~/i18n/navigation';
import { pathWithoutLocale } from '~/i18n/routing';

/**
 * Đổi ngôn ngữ: hai nút VI và EN trong viên tiện ích của thanh điều hướng S4.1 (SHOP-11), class `.nav-btn` của
 * components.css. Là một `role=group`, không phải `<nav>`: đây là nút, và trang chỉ có một nav chính.
 * Client Component (cần `onClick` + đọc locale/pathname phía client).
 *
 * The path is read when a button is pressed, from the address bar, not with usePathname while rendering: the switcher
 * is in the bar of every page, and on a route with a dynamic param unknown at build time that hook suspends the
 * prerender, which fails the build under cacheComponents (SHOP-41). The buttons stay in the static shell.
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

  return (
    <div className="nav-group" role="group" aria-label={t('label')}>
      {locales.map((locale) => (
        <button
          key={locale}
          type="button"
          className="nav-btn nav-btn--text"
          disabled={locale === activeLocale}
          aria-current={locale === activeLocale}
          onClick={() => {
            // Full reload (KHÔNG router.replace) chống chớp trắng theme — xem JSDoc trên.
            // getPathname thêm tiền tố locale (localePrefix 'always'): '/about' → '/vi/about'.
            const href = pathWithoutLocale(window.location.pathname, activeLocale);
            window.location.replace(getPathname({ href, locale }));
          }}
        >
          {locale.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
