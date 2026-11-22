import { expect, test, type Page } from '@playwright/test';

// The backdrop of the home page (SHOP-87): public/images/home-backdrop.svg as a mask of the --border token, fixed behind
// the content. jsdom neither decodes an image nor computes layout or style, so these checks need a real browser.

const BACKDROP = '.home-backdrop';

const box = async (page: Page, selector: string) => {
  const rect = await page.locator(selector).first().boundingBox();
  if (!rect) throw new Error(`${selector} is not visible`);
  return rect;
};

const backdropColor = (page: Page) =>
  page.locator(BACKDROP).evaluate((element) => getComputedStyle(element).backgroundColor);

test.describe('home page backdrop', () => {
  for (const locale of ['vi', 'en'] as const) {
    test(`covers the window behind the content of /${locale}`, async ({ page }) => {
      await page.goto(`/${locale}`);

      const backdrop = page.locator(BACKDROP);
      await expect(backdrop).toHaveAttribute('aria-hidden', 'true');
      const viewport = page.viewportSize();
      expect(await box(page, BACKDROP)).toEqual({
        x: 0,
        y: 0,
        width: viewport?.width,
        height: viewport?.height,
      });
      await expect(backdrop).toHaveCSS('position', 'fixed');
      await expect(backdrop).toHaveCSS('z-index', '-1');
    });
  }

  test('the SVG loads and decodes', async ({ page }) => {
    await page.goto('/vi');

    const size = await page.evaluate(async () => {
      const image = new Image();
      image.src = '/images/home-backdrop.svg';
      await image.decode();
      return { width: image.naturalWidth, height: image.naturalHeight };
    });
    expect(size).toEqual({ width: 160, height: 160 });
  });

  test('moves nothing on the page: the heading sits where it sits without the backdrop', async ({
    page,
  }) => {
    await page.goto('/vi');
    const withBackdrop = await box(page, 'h1');

    await page.locator(BACKDROP).evaluate((element) => {
      (element as HTMLElement).style.display = 'none';
    });
    expect(await box(page, 'h1')).toEqual(withBackdrop);
  });

  test('takes no click: the links of the page still open', async ({ page }) => {
    await page.goto('/vi');

    await page
      .locator('main + nav')
      .getByRole('link', { name: /Giới thiệu/ })
      .click();
    await expect(page).toHaveURL(/\/vi\/about$/);
  });

  test('takes the line colour of each theme', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/vi');
    await expect(page.locator('html')).not.toHaveClass(/dark/);
    const light = await backdropColor(page);

    await page.emulateMedia({ colorScheme: 'dark' });
    await expect(page.locator('html')).toHaveClass(/dark/);
    const dark = await backdropColor(page);

    expect(light).not.toBe(dark);
    const border = await page.evaluate(() => {
      const probe = document.createElement('div');
      probe.style.backgroundColor = 'var(--border)';
      document.body.append(probe);
      const value = getComputedStyle(probe).backgroundColor;
      probe.remove();
      return value;
    });
    expect(dark).toBe(border);
  });
});
