import { expect, test, type Page } from '@playwright/test';

// The page frame of user (SHOP-11): the navigation bar S4.1 and the footer S4.11 of docs/specs/SHOP-7/design.md. jsdom
// computes no layout, so the rows of the bar and the horizontal scroll are only seen in a real browser.

type Box = { top: number; bottom: number };

async function bar(page: Page) {
  const box = async (selector: string): Promise<Box> => {
    const rect = await page.locator(selector).boundingBox();
    if (!rect) throw new Error(`${selector} is not visible`);
    return { top: Math.round(rect.y), bottom: Math.round(rect.y + rect.height) };
  };
  return {
    name: await box('.pill--brand'),
    links: await box('.site-nav__links'),
    tools: await box('.site-nav__tools'),
  };
}

const hasHorizontalScroll = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);

test.describe('page frame: navigation bar S4.1 and footer S4.11', () => {
  test('the main navigation links Home, Products and About, and marks the current page', async ({
    page,
  }) => {
    await page.goto('/vi/about');

    const nav = page.getByRole('navigation', { name: 'Điều hướng chính' });
    await expect(nav.getByRole('link')).toHaveText(['Trang chủ', 'Sản phẩm', 'Giới thiệu']);
    await expect(nav.getByRole('link', { name: 'Giới thiệu' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(nav.locator('[aria-current]')).toHaveCount(1);

    await nav.getByRole('link', { name: 'Trang chủ' }).click();
    await expect(page).toHaveURL(/\/vi$/);
    await expect(nav.getByRole('link', { name: 'Trang chủ' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  test('the bar holds the account, the language and the theme controls', async ({ page }) => {
    await page.goto('/en');

    const banner = page.getByRole('banner');
    await expect(banner.getByRole('link', { name: 'tungph7 codebase' })).toBeVisible();
    await expect(banner.getByRole('group', { name: 'Language' }).getByRole('button')).toHaveText([
      'EN',
      'VI',
    ]);
    await expect(banner.getByRole('group', { name: 'Theme' }).getByRole('button')).toHaveText([
      'Light',
      'Dark',
      'System',
    ]);
    await expect(banner.getByRole('link', { name: 'Sign in' })).toBeVisible();
  });

  test('the footer shows the copyright line', async ({ page }) => {
    await page.goto('/vi');

    await expect(page.getByRole('contentinfo')).toContainText(
      'tungph7 codebase. All rights reserved.',
    );
  });

  for (const width of [768, 1024, 1440]) {
    test(`from 768px the bar is one row (${width}px)`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/vi');

      const { name, links, tools } = await bar(page);
      expect(links.top).toBe(name.top);
      expect(tools.top).toBe(name.top);
      expect(await hasHorizontalScroll(page)).toBe(false);
    });
  }

  for (const width of [320, 390, 767]) {
    for (const path of ['/vi', '/en/about']) {
      test(`under 768px the bar is two rows, with no horizontal scroll (${width}px, ${path})`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 800 });
        await page.goto(path);
        await page.evaluate(() => document.fonts.ready);

        const { name, links, tools } = await bar(page);
        // Row 1: the site name and the tools; row 2: the navigation, below both. No menu hides it.
        expect(tools.top).toBe(name.top);
        expect(links.top).toBeGreaterThanOrEqual(Math.max(name.bottom, tools.bottom));
        await expect(
          page.getByRole('navigation', { name: /Điều hướng chính|Main navigation/ }),
        ).toBeVisible();
        expect(await hasHorizontalScroll(page)).toBe(false);
      });
    }
  }

  test('under 1024px the theme and account controls are icons that keep their names', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto('/vi');

    const dark = page
      .getByRole('group', { name: 'Giao diện' })
      .getByRole('button', { name: 'Tối' });
    await expect(dark.locator('svg')).toBeVisible();
    await expect(dark.locator('.nav-btn__label')).toHaveCSS('position', 'absolute');
    await dark.click();
    await expect(page.locator('html')).toHaveClass(/\bdark\b/);
    await expect(page.getByRole('link', { name: 'Đăng nhập' })).toBeVisible();
  });
});
