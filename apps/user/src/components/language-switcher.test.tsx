import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { renderWithProviders, screen } from '~/testing/render';

// Navigation locale-aware cần App Router context THẬT → mock để unit-test LOGIC switcher
// (điều hướng thật cover ở E2E folder 24). Switcher đổi locale = FULL RELOAD CỐ Ý
// (`window.location.replace`) chống chớp trắng theme (docs 22 §4.2) → mock `getPathname`
// (ghép tiền tố locale) + spy `window.location.replace`.
//
// The switcher reads the path only when a button is pressed, from the address bar, never with usePathname: on a route
// with a dynamic param unknown at build time that hook suspends the prerender, and the switcher sits in the bar of every
// page, outside any Suspense boundary (SHOP-41, review of PR #24). The mock fails a test that calls it.
vi.mock('~/i18n/navigation', () => ({
  usePathname: () => {
    throw new Error('LanguageSwitcher must not read the path while it renders');
  },
  getPathname: ({ href, locale }: { href: string; locale: string }) =>
    `/${locale}${href === '/' ? '' : href}`,
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
    pathname: '/en/about',
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

  test('keeps the page below the locale, a page with a dynamic param too', async () => {
    vi.stubGlobal('location', {
      pathname: '/en/products/ao-thun-co-tron',
      replace: locationReplace,
    });
    const { user } = renderWithProviders(<LanguageSwitcher />, { locale: 'en' });

    await user.click(screen.getByRole('button', { name: 'VI' }));

    expect(locationReplace).toHaveBeenCalledWith('/vi/products/ao-thun-co-tron');
  });

  test('goes to the home page of the other locale from the home page', async () => {
    vi.stubGlobal('location', { pathname: '/en', replace: locationReplace });
    const { user } = renderWithProviders(<LanguageSwitcher />, { locale: 'en' });

    await user.click(screen.getByRole('button', { name: 'VI' }));

    expect(locationReplace).toHaveBeenCalledWith('/vi');
  });

  test('aria-label dịch theo locale (vi)', () => {
    renderWithProviders(<LanguageSwitcher />, { locale: 'vi' });
    expect(screen.getByRole('group', { name: 'Ngôn ngữ' })).toBeInTheDocument();
  });

  // The buttons sit in the tools pill of the navigation bar (S4.1, SHOP-11): a group of buttons, not a second
  // navigation landmark next to the main one.
  test('is a group of buttons, not a navigation landmark', () => {
    renderWithProviders(<LanguageSwitcher />, { locale: 'vi' });
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  test('marks the current locale with aria-current', () => {
    renderWithProviders(<LanguageSwitcher />, { locale: 'vi' });
    expect(screen.getByRole('button', { name: 'VI' })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('button', { name: 'EN' })).toHaveAttribute('aria-current', 'false');
  });
});
