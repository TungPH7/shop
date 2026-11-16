'use client';

import { useSyncExternalStore } from 'react';

import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';

import { MonitorIcon, MoonIcon, SunIcon } from '~/components/ui/icons';

// 3 lựa chọn next-themes cấp khi `enableSystem`. `as const` → union literal khớp ĐÚNG key
// namespace 'Theme' (light/dark/system) nên `t(value)` type-safe (không phải `string`
// động — next-intl chặn key động, bài học folder 16).
const THEME_OPTIONS = ['light', 'dark', 'system'] as const;

const THEME_ICONS = { light: SunIcon, dark: MoonIcon, system: MonitorIcon } as const;

// "Đã hydrate chưa?" — SSR-safe, KHÔNG dùng useEffect+setState (React Compiler + react-hooks
// cấm `set-state-in-effect`, folder 20). `useSyncExternalStore` với server-snapshot=false /
// client-snapshot=true: React render `false` lúc SSR + first hydrate rồi tự re-render `true`
// SAU hydrate — KHÔNG cảnh báo mismatch (hook sinh ra ĐÚNG cho việc đọc client-only state).
const subscribeNoop = () => () => {};
function useHydrated() {
  return useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );
}

/**
 * Đổi theme: ba nút Sáng, Tối, Hệ thống trong viên tiện ích của thanh điều hướng S4.1 (SHOP-11), mẫu y hệt
 * LanguageSwitcher. Mỗi nút có biểu tượng (aria-hidden) và chữ: dưới 1024 px chỉ hiện biểu tượng, chữ ẩn bằng CSS nhưng
 * vẫn là tên của nút (components.css, Page frame). Client Component (`useTheme` cần localStorage/matchMedia phía client).
 *
 * Vì sao gate `hydrated`: next-themes chỉ biết theme SAU khi đọc localStorage (phía client)
 * → ở server `theme` = undefined. Nếu phản ánh active-state (`aria-pressed`) NGAY thì
 * server-HTML ≠ client-HTML → cảnh báo hydrate trên từng nút (`suppressHydrationWarning`
 * chỉ áp 1 cấp ở <html>/<body>, không tới nút). Gate cho first render khớp server (chưa
 * active) rồi bật active sau hydrate. An toàn static shell: không đọc request-time (như
 * LanguageSwitcher/WebVitals).
 */
export function ThemeSwitcher() {
  const t = useTranslations('Theme');
  const { theme, setTheme } = useTheme();
  const hydrated = useHydrated();

  return (
    <div className="nav-group" role="group" aria-label={t('label')}>
      {THEME_OPTIONS.map((value) => {
        const Icon = THEME_ICONS[value];
        return (
          <button
            key={value}
            type="button"
            className="nav-btn"
            title={t(value)}
            aria-pressed={hydrated && theme === value}
            onClick={() => {
              setTheme(value);
            }}
          >
            <Icon className="nav-btn__icon" />
            <span className="nav-btn__label">{t(value)}</span>
          </button>
        );
      })}
    </div>
  );
}
