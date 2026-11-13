import { expect, test } from 'vitest';

import { renderWithProviders, screen } from '~/testing/render';

import { HomeView } from './home-view';

// HomeView = Server Component ĐỒNG BỘ → RTL render được (harness bọc NextIntlClientProvider).

test('hiển thị tên site (brand, KHÔNG dịch) ở heading cấp 1', () => {
  renderWithProviders(<HomeView />);
  expect(screen.getByRole('heading', { level: 1, name: 'tungph7 codebase' })).toBeInTheDocument();
});

test('render chuỗi đã dịch tiếng Anh (mặc định) + plural "languages"', () => {
  renderWithProviders(<HomeView />);
  expect(
    screen.getByText('Phase 1.1 — Server-first core foundation (UI-agnostic).'),
  ).toBeInTheDocument();
  expect(screen.getByText('Current language (from URL): en')).toBeInTheDocument();
  expect(screen.getByText('2 languages supported')).toBeInTheDocument(); // count=2 → 'other'
});

test('đổi sang tiếng Việt khi provider locale=vi', () => {
  renderWithProviders(<HomeView />, { locale: 'vi' });
  expect(
    screen.getByText('Phase 1.1 — Nền tảng lõi server-first (không phụ thuộc UI).'),
  ).toBeInTheDocument();
  expect(screen.getByText('Ngôn ngữ hiện tại (từ URL): vi')).toBeInTheDocument();
  expect(screen.getByText('Hỗ trợ 2 ngôn ngữ')).toBeInTheDocument();
});
