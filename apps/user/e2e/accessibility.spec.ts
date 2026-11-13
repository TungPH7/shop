import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

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

  test('trang Products (mocked) không vi phạm — quét sau khi stream xong', async ({ page }) => {
    await page.goto('/en/products');
    // Chờ dynamic-hole (ProductResults) stream xong → axe quét CẢ cây đã render, không chỉ shell tĩnh.
    await expect(page.getByText('E2E Widget')).toBeVisible();
    const { violations } = await scan(page);
    expect(violations).toEqual([]);
  });
});
