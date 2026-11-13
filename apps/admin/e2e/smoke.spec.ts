import { expect, test } from '@playwright/test';

// Smoke: the app boots, navigation works, and language switches at runtime — the
// real browser end-to-end (folder 14 i18n re-render proven in a real DOM). These
// flows hit no backend, so they are stable without API mocking.
test.describe('app smoke', () => {
  test('loads the home page with primary navigation', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1, name: 'tungph7 codebase' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Primary' })).toBeVisible();
  });

  test('navigates to the About page', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'About' }).click();
    await expect(page).toHaveURL(/\/about$/);
  });

  test('switches language at runtime (en → vi)', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'Home' })).toBeVisible();

    await page.getByLabel('Language').selectOption('vi');

    await expect(page.getByRole('link', { name: 'Trang chủ' })).toBeVisible();
  });
});
