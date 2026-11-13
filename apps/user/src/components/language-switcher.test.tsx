import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { renderWithProviders, screen } from '~/testing/render';

// Navigation locale-aware cần App Router context THẬT → mock để unit-test LOGIC switcher
// (điều hướng thật cover ở E2E folder 24). Switcher đổi locale = FULL RELOAD CỐ Ý
// (`window.location.replace`) chống chớp trắng theme (docs 22 §4.2) → mock `getPathname`
// (ghép tiền tố locale) + spy `window.location.replace`.
vi.mock('~/i18n/navigation', () => ({
  usePathname: () => '/about',
  getPathname: ({ href, locale }: { href: string; locale: string }) => `/${locale}${href}`,
}));

import { LanguageSwitcher } from './language-switcher';

// `window.location.replace` là method KHÔNG-configurable trong jsdom → `vi.spyOn` không
// redefine được. Thay CẢ object `location` bằng `vi.stubGlobal` (giữ href/origin/pathname
// để không vỡ code khác đọc location), override `replace` bằng spy.
const realLocation = window.location;
const locationReplace = vi.fn();

beforeEach(() => {
  locationReplace.mockClear();
  vi.stubGlobal('location', {
    href: realLocation.href,
    origin: realLocation.origin,
    pathname: realLocation.pathname,
    replace: locationReplace,
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('LanguageSwitcher', () => {
  test('render nút cho mọi locale, vô hiệu hoá locale hiện tại', () => {
    renderWithProviders(<LanguageSwitcher />, { locale: 'en' });
    expect(screen.getByRole('button', { name: 'EN' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'VI' })).toBeEnabled();
  });

  test('bấm locale khác → FULL RELOAD tới path đã thêm tiền tố locale (chống chớp trắng theme)', async () => {
    const { user } = renderWithProviders(<LanguageSwitcher />, { locale: 'en' });
    await user.click(screen.getByRole('button', { name: 'VI' }));
    expect(locationReplace).toHaveBeenCalledWith('/vi/about');
  });

  test('aria-label dịch theo locale (vi)', () => {
    renderWithProviders(<LanguageSwitcher />, { locale: 'vi' });
    expect(screen.getByRole('navigation', { name: 'Ngôn ngữ' })).toBeInTheDocument();
  });
});
