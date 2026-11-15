import { expect, test } from '@playwright/test';

// Smoke: the app boots, navigation works, and language switches at runtime — the
// real browser end-to-end (folder 14 i18n re-render proven in a real DOM). These
// flows hit no backend, so they are stable without API mocking.
test.describe('app smoke', () => {
  test('loads the home page with the app name and the main navigation', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'tungph7 codebase' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  });

  test('navigates to the About page', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'About' }).click();
    await expect(page).toHaveURL(/\/about$/);
  });

  test('shows only the title S1.2 on the products page', async ({ page }) => {
    await page.goto('/products');

    await expect(page.getByRole('heading', { level: 1, name: 'Products' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(page.getByRole('searchbox')).toHaveCount(0);
  });

  test('has no product detail or edit page of the template', async ({ page }) => {
    await page.goto('/products/p-001');
    await expect(page.getByRole('heading', { name: '404 — Page not found' })).toBeVisible();

    await page.goto('/admin/products/p-001/edit');
    await expect(page.getByRole('heading', { name: '404 — Page not found' })).toBeVisible();
  });

  test('switches language at runtime (en → vi)', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'Home' })).toBeVisible();

    await page.getByLabel('Language').selectOption('vi');

    await expect(page.getByRole('link', { name: 'Trang chủ' })).toBeVisible();
  });

  test('follows the system theme, and keeps a picked theme after a reload', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).not.toHaveAttribute('data-theme');

    await page.getByLabel('Theme').selectOption('dark');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });

  test('puts a stored theme on <html> before any script of the app runs', async ({ page }) => {
    await page.addInitScript({
      content: `localStorage.setItem('tungph7.theme', JSON.stringify({ v: 1, theme: 'dark' }));`,
    });
    // Only theme-init.js may load: with the app scripts blocked, data-theme can only
    // come from the classic script in <head>, which runs before the first paint.
    await page.route('**/*', (route) => {
      const request = route.request();
      const appScript =
        request.resourceType() === 'script' && !request.url().endsWith('/theme-init.js');
      return appScript ? route.abort() : route.continue();
    });

    await page.goto('/');

    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });
});
