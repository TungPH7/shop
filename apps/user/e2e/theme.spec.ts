import { expect, test } from '@playwright/test';

// Theming (seam S4, folder 22) là client thuần (CSS variables + class trên <html>) → chạy không cần
// backend. Đây là bằng chứng jsdom KHÔNG cho được: jsdom không tính style, nên chỉ trình duyệt THẬT mới
// thấy việc lật class thực sự REPAINT cả app từ tầng token, và lựa chọn SỐNG SÓT qua reload (persist
// localStorage + inline script anti-FOUC của next-themes chạy trước paint).
test.describe('theming (seam S4)', () => {
  test('đổi light/dark toàn app + giữ qua reload', async ({ page }) => {
    await page.goto('/en');

    const html = page.locator('html');
    const themeGroup = page.getByRole('group', { name: 'Theme' });
    // Closure chạy TRONG trình duyệt (Playwright serialize) — `getComputedStyle`/`document` có sẵn nhờ
    // lib 'dom' trong tsconfig; ở Node (test runner) chúng không tồn tại nhưng closure không chạy ở Node.
    const bodyBackground = () =>
      page.evaluate(() => getComputedStyle(document.body).backgroundColor);

    // Mặc định: chưa có preference lưu + Playwright giả prefers-color-scheme: light → 'system' → light.
    await expect(html).not.toHaveClass(/dark/);
    const lightBackground = await bodyBackground();

    // Đổi sang dark qua ThemeSwitcher headless (3 nút, folder 22).
    await themeGroup.getByRole('button', { name: 'Dark' }).click();
    await expect(html).toHaveClass(/dark/);
    const darkBackground = await bodyBackground();

    // Tầng token thực sự repaint cả app (body background đổi) mà KHÔNG đụng component nào — bản chất của
    // theming bằng CSS variable.
    expect(darkBackground).not.toBe(lightBackground);

    // Lựa chọn giữ qua FULL reload, và inline script gắn lại class TRƯỚC first paint (không chớp sai theme).
    await page.reload();
    await expect(html).toHaveClass(/dark/);

    // Về lại light để xác nhận điều khiển đảo được hoàn toàn.
    await themeGroup.getByRole('button', { name: 'Light' }).click();
    await expect(html).not.toHaveClass(/dark/);
  });
});
