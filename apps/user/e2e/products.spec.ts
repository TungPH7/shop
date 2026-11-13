import { expect, test } from '@playwright/test';

// E2E CÓ BACKEND (MSW-in-server, folder 24) — chứng minh render ASYNC Server Component của DAL, điều
// unit/integration KHÔNG phủ được (async RSC chỉ E2E cover). Data đến từ store MSW chạy TRONG process
// Next → toàn bộ đường BFF server-first (DAL `use cache` → http client → "backend") thực thi thật.
test.describe('products (backend mock qua MSW-in-server)', () => {
  test('render danh sách sản phẩm fetch phía SERVER', async ({ page }) => {
    await page.goto('/en/products');
    await expect(page.getByRole('heading', { level: 1, name: 'Products' })).toBeVisible();

    // Tên sản phẩm đến từ store MSW → DAL (`getProducts`, `use cache`) đã fetch "backend" ở SERVER rồi
    // ProductResults (async RSC) render + stream vào. `E2E Widget`/`E2E Gadget` KHÔNG bị test xoá đụng.
    await expect(page.getByText('E2E Widget')).toBeVisible();
    await expect(page.getByText('E2E Gadget')).toBeVisible();

    // Giá format VND deterministic (model thuần, không Intl): 199000 → "199.000 ₫".
    await expect(page.getByText('199.000 ₫')).toBeVisible();
  });

  test('badge đếm sản phẩm: client → Route Handler /api → DAL', async ({ page }) => {
    await page.goto('/en/products');
    // ProductCountBadge dùng TanStack Query (client) gọi `/api/products/count` → Route Handler → DAL →
    // MSW. Chứng minh đường BFF phía CLIENT (khác first-load do RSC lo). Không pin số CHÍNH XÁC vì store
    // dùng chung server có thể đã bớt 1 do test xoá — chỉ cần badge hiện "Total products: <số>".
    await expect(page.getByText(/Total products:\s*\d+/)).toBeVisible();
  });
});
