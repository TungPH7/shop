import { expect, test } from '@playwright/test';

// The products page S4 until US5a (SHOP-25) brings the catalog: a static shell with the title S4.2 and the
// BreadcrumbList, and none of the product demo of the template, which read and wrote the old NestJS API (TW4, NFR8).
test.describe('products page shell', () => {
  for (const [locale, title, home] of [
    ['vi', 'Sản phẩm', 'Trang chủ'],
    ['en', 'Products', 'Home'],
  ] as const) {
    test(`shows the title S4.2 and the BreadcrumbList in ${locale}`, async ({ page }) => {
      await page.goto(`/${locale}/products`);

      await expect(
        page.getByRole('main').getByRole('heading', { level: 1, name: title }),
      ).toBeVisible();
      await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
      // Playwright does not match text inside <script>, so the JSON-LD blocks are read from the DOM.
      const blocks = await page
        .locator('script[type="application/ld+json"]')
        .evaluateAll((scripts) => scripts.map((script) => script.textContent ?? ''));
      const breadcrumbs = blocks
        .map(
          (block) =>
            JSON.parse(block) as { '@type'?: string; itemListElement?: { name: string }[] },
        )
        .filter((block) => block['@type'] === 'BreadcrumbList');
      expect(breadcrumbs.map((block) => block.itemListElement?.map((item) => item.name))).toEqual([
        [home, title],
      ]);
    });
  }

  test('has none of the product demo of the template', async ({ page }) => {
    await page.goto('/en/products');
    await expect(page.getByRole('heading', { level: 1, name: 'Products' })).toBeVisible();

    const main = page.getByRole('main');
    await expect(main.getByRole('button')).toHaveCount(0);
    await expect(main.getByRole('list')).toHaveCount(0);
    await expect(main.getByText(/Fetched server-side|Total products/)).toHaveCount(0);
  });

  test('has no product count route of the template', async ({ request }) => {
    const response = await request.get('/api/products/count');
    expect(response.status()).toBe(404);
  });
});
