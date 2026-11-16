import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// On an environment (Development, Staging) the tests run against its URL, not the apps started here (SHOP-5).
const isLocal = (url?: string) => url?.startsWith('http://localhost') === true;

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

  test('trang Products (mocked) không vi phạm — quét sau khi stream xong', async ({
    page,
    baseURL,
  }) => {
    // Needs the MSW mock of the old NestJS product API; the Epic Danh mục sản phẩm replaces it.
    test.skip(!isLocal(baseURL), 'reason: old product API mock (SHOP-5)');
    await page.goto('/en/products');
    // Chờ dynamic-hole (ProductResults) stream xong → axe quét CẢ cây đã render, không chỉ shell tĩnh.
    await expect(page.getByText('E2E Widget')).toBeVisible();
    const { violations } = await scan(page);
    expect(violations).toEqual([]);
  });
});
