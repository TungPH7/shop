import { expect, test } from '@playwright/test';

// Smoke E2E (KHÔNG cần backend) — chứng minh điều unit/integration KHÔNG với tới: app BOOT thật trong
// Chromium, render Ở SERVER (RSC/PPR), điều hướng, và đổi ngôn ngữ runtime. Các flow này thuần
// shell/client (home/about/i18n) nên ổn định mà không cần mock API.
test.describe('smoke: server render, điều hướng, i18n', () => {
  test('trang chủ render ở SERVER + redirect locale', async ({ page }) => {
    // `/` → proxy (next-intl middleware) phát hiện locale (Playwright locale 'en-US' → 'en') → 307 → `/en`.
    await page.goto('/');
    await expect(page).toHaveURL(/\/en$/);

    // ⭐ Bằng chứng SERVER-render (không phải client-only): tiêu đề nằm trong HTML tài liệu ĐẦU TIÊN
    // (static shell PPR do server phát), TRƯỚC hydrate. jsdom/RTL (unit) không kiểm được điều này.
    const response = await page.goto('/en');
    expect(response?.status()).toBe(200);
    const html = (await response?.text()) ?? '';
    expect(html).toContain('tungph7 codebase');

    await expect(page.getByRole('heading', { level: 1, name: 'tungph7 codebase' })).toBeVisible();
  });

  test('điều hướng sang trang About', async ({ page }) => {
    await page.goto('/en');
    await page.getByRole('link', { name: /About/ }).click();
    await expect(page).toHaveURL(/\/en\/about$/);
    await expect(page.getByRole('heading', { level: 1, name: 'About' })).toBeVisible();
  });

  test('đổi ngôn ngữ runtime en → vi (full-reload, folder 22)', async ({ page }) => {
    await page.goto('/en');
    // LanguageSwitcher = <nav aria-label="Language"> gồm nút EN (đang active, disabled) + VI. Đổi locale
    // = FULL RELOAD cố ý (window.location.replace) chống chớp trắng theme (folder 22) → Playwright thấy
    // như một navigation bình thường.
    await page.getByRole('button', { name: 'VI' }).click();
    await expect(page).toHaveURL(/\/vi$/);
    // Chuỗi đã dịch + interpolation ICU cho locale MỚI → i18n chạy đúng ở server sau khi đổi ngôn ngữ.
    await expect(page.getByText('Ngôn ngữ hiện tại (từ URL): vi')).toBeVisible();
  });
});
