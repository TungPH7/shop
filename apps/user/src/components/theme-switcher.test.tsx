import { beforeEach, describe, expect, test, vi } from 'vitest';

import { renderWithProviders, screen } from '~/testing/render';

// next-themes cần ThemeProvider + localStorage/matchMedia (môi trường client thật) → mock
// `useTheme` để unit-test LOGIC switcher (hành vi đổi theme thật cover ở Lớp 3 browser).
// `vi.hoisted` để `setTheme` sẵn khi factory mock chạy; `currentTheme` đổi được giữa các test.
const { setTheme } = vi.hoisted(() => ({ setTheme: vi.fn() }));
let currentTheme: string | undefined = 'system';
vi.mock('next-themes', () => ({
  useTheme: () => ({ theme: currentTheme, setTheme }),
}));

import { ThemeSwitcher } from './theme-switcher';

describe('ThemeSwitcher', () => {
  beforeEach(() => {
    setTheme.mockClear();
    currentTheme = 'system';
  });

  test('render đủ 3 nút theme, dịch nhãn (en)', () => {
    renderWithProviders(<ThemeSwitcher />, { locale: 'en' });
    expect(screen.getByRole('button', { name: 'Light' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dark' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'System' })).toBeInTheDocument();
  });

  test('sau hydrate, nút theme hiện tại có aria-pressed=true', async () => {
    renderWithProviders(<ThemeSwitcher />, { locale: 'en' });
    // useHydrated (useSyncExternalStore) trả true trong jsdom → 'System' (currentTheme) active.
    expect(
      await screen.findByRole('button', { name: 'System', pressed: true }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Light', pressed: false })).toBeInTheDocument();
  });

  test('bấm nút → setTheme(value tương ứng)', async () => {
    const { user } = renderWithProviders(<ThemeSwitcher />, { locale: 'en' });
    await user.click(screen.getByRole('button', { name: 'Dark' }));
    expect(setTheme).toHaveBeenCalledWith('dark');
  });

  test('nhãn group dịch theo locale (vi)', () => {
    renderWithProviders(<ThemeSwitcher />, { locale: 'vi' });
    expect(screen.getByRole('group', { name: 'Giao diện' })).toBeInTheDocument();
  });
});
