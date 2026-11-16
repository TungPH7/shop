import AxeBuilder from '@axe-core/playwright';
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

import {
  adminApi,
  createProduct,
  deleteProduct,
  deleteStaleProducts,
  type CreatedProduct,
} from './support/products';

// a11y E2E — quét WCAG bằng axe-core trong TRÌNH DUYỆT THẬT. Bổ trợ (KHÔNG thay) `jsx-a11y` lúc lint:
// lint bắt lỗi TĨNH trong JSX; axe bắt lỗi ĐỘNG cần DOM/CSS thật (contrast, thứ tự heading, tên khả truy
// cập sau render). Đây là giá trị riêng của E2E: jsdom không tính được style/contrast.
//
// Chỉ tag WCAG 2.0/2.1 mức A & AA — bỏ 'best-practice' để tránh nhiễu khuyến nghị không bắt buộc (vd
// "mọi nội dung nên nằm trong landmark"). Đây là chuẩn tuân thủ phổ biến của enterprise.
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

function scan(page: Page) {
  return new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
}

test.describe('accessibility (axe, WCAG A/AA)', () => {
  test('trang chủ không vi phạm', async ({ page }) => {
    await page.goto('/en');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    const { violations } = await scan(page);
    expect(violations).toEqual([]);
  });

  test('trang About không vi phạm', async ({ page }) => {
    await page.goto('/en/about');
    await expect(page.getByRole('heading', { level: 1, name: 'About' })).toBeVisible();
    const { violations } = await scan(page);
    expect(violations).toEqual([]);
  });

  // The design system of SHOP-10 in both themes (Checkpoint "Design system" of the plan of SHOP-7). The theme follows
  // the system by default, so emulating prefers-color-scheme picks it, and next-themes puts .dark on <html>.
  for (const colorScheme of ['light', 'dark'] as const) {
    for (const [name, path] of [
      ['home page', '/vi'],
      ['About page', '/vi/about'],
    ] as const) {
      test(`the ${name} has no violation in the ${colorScheme} theme`, async ({ page }) => {
        await page.emulateMedia({ colorScheme });
        await page.goto(path);
        await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
        const html = expect(page.locator('html'));
        await (colorScheme === 'dark' ? html : html.not).toHaveClass(/\bdark\b/);
        const { violations } = await scan(page);
        expect(violations).toEqual([]);
      });
    }
  }

  // The products page S4 of SHOP-25, in both languages and both themes, on the real api: a card with every part (the
  // original price, "-16%" and the out of stock badge over the tile) and a plain one, deleted when done (NFR23). The
  // catalog is cached for up to 25 s (NFR7), so the test reloads until it shows them.
  test.describe('products page S4', () => {
    // One worker for the four tests, so they share the two products rather than make them once per worker.
    test.describe.configure({ mode: 'default' });
    let api: APIRequestContext;
    const created: CreatedProduct[] = [];

    test.beforeAll(async () => {
      api = await adminApi();
      await deleteStaleProducts(api);
      created.push(await createProduct(api, { name: 'Áo khoác gió', price: 450000 }));
      created.push(
        await createProduct(api, {
          name: 'Áo thun cổ tròn',
          price: 1250000,
          compareAtPrice: 1500000,
          availability: 'OUT_OF_STOCK',
        }),
      );
    });

    test.afterAll(async () => {
      for (const product of created) await deleteProduct(api, product.id);
      await api.dispose();
    });

    for (const locale of ['vi', 'en'] as const) {
      for (const colorScheme of ['light', 'dark'] as const) {
        test(`S4 has no violation in ${locale}, ${colorScheme} theme`, async ({ page }) => {
          await page.emulateMedia({ colorScheme });
          const discounted = page.locator('main .product-card', { hasText: created[1]!.name });
          await expect(async () => {
            await page.goto(`/${locale}/products`);
            await expect(discounted).toBeVisible({ timeout: 2_000 });
          }).toPass({ timeout: 60_000 });
          const html = expect(page.locator('html'));
          await (colorScheme === 'dark' ? html : html.not).toHaveClass(/\bdark\b/);

          const { violations } = await scan(page);
          expect(violations).toEqual([]);
        });
      }
    }
  });

  // The navigation bar of SHOP-11 under 768px: two rows, icon buttons for the theme and the account.
  for (const colorScheme of ['light', 'dark'] as const) {
    test(`the home page at 320px has no violation in the ${colorScheme} theme`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 320, height: 800 });
      await page.emulateMedia({ colorScheme });
      await page.goto('/vi');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      const { violations } = await scan(page);
      expect(violations).toEqual([]);
    });
  }
});
