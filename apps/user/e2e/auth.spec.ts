import { expect, test, type Page } from '@playwright/test';

// On an environment (Development, Staging) the tests run against its URL, not the apps started here (SHOP-5).
const isLocal = (url?: string) => url?.startsWith('http://localhost') === true;

// E2E AUTH (MSW-in-server, folder 15 + 24) — login THẬT qua Server Action → niêm phong cookie phiên
// bằng jose → AuthStatus + RBAC element-level (`<Can>`). Mock trả token ADMIN + `/profile` có quyền xoá.
// Chứng minh cả pipeline auth server-first trong trình duyệt THẬT (unit chỉ test rời từng mảnh: seal,
// action, permissions). Cookie `__Host-session` là Secure → Chromium chấp nhận trên http://localhost
// (secure-context), giống ghi chú ở lib/auth/session.ts.

async function login(page: Page): Promise<void> {
  await page.goto('/en/login');
  await page.getByLabel('Email').fill('admin@e2e.test');
  await page.getByLabel('Password').fill('any-password'); // mock chấp nhận mọi mật khẩu
  // Nút submit tên "Sign in" (button) — phân biệt với link "Sign in" của AuthStatus (role khác).
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/en$/); // loginAction redirect về '/' theo locale hiện tại.
}

test.describe('auth: login, RBAC, logout', () => {
  // These tests need the MSW mock of the old NestJS auth API, which only the apps started here have.
  // The login Epic replaces them.
  test.skip(({ baseURL }) => !isLocal(baseURL), 'reason: old auth API mock, login Epic (SHOP-5)');
  // Reset store MSW-in-server TRƯỚC mỗi test (và mỗi retry) → test xoá bên dưới luôn thấy `E2E Deletable`
  // dù Playwright dùng chung 1 server cho cả run (folder 25). `request` = APIRequestContext (dùng baseURL).
  test.beforeEach(async ({ request }) => {
    await request.post('/api/e2e/reset');
  });

  test('login → hiển thị trạng thái đăng nhập (ADMIN)', async ({ page }) => {
    await login(page);
    // AuthStatus (server, đọc getCurrentUser từ cookie) stream vào layout → role lấy từ claim token.
    await expect(page.getByText('Signed in (ADMIN)')).toBeVisible();
  });

  test('đã đăng nhập → nút Xoá hiện trên /products (<Can> + RBAC server)', async ({ page }) => {
    await login(page);
    await page.goto('/en/products');
    await expect(page.getByText('E2E Widget')).toBeVisible();
    // <Can> gọi getProfile (mock có quyền DELETE) → nút Xoá render. Anon/thiếu quyền → ẩn (defense: backend
    // vẫn chốt độc lập). Có nhiều dòng → chỉ cần ≥1 nút Delete hiện.
    await expect(page.getByRole('button', { name: 'Delete' }).first()).toBeVisible();
  });

  test('xoá sản phẩm E2E: mutation → updateTag → re-render SERVER', async ({ page }) => {
    await login(page);
    await page.goto('/en/products');
    const row = page.locator('li').filter({ hasText: 'E2E Deletable' });
    await expect(row).toBeVisible();

    await row.getByRole('button', { name: 'Delete' }).click();
    // deleteProductAction: validate → re-authz (getCurrentUser) → DAL delete (MSW splice store) →
    // updateTag('products') → render kế đọc lại getProducts → danh sách KHÔNG còn dòng đó.
    // Timeout 20s (KHÔNG mặc định 5s): response của Server Action mang theo re-render read-your-writes
    // (getProducts + <Can>/getProfile mỗi dòng) → trên CI runner 2-core nguội có thể >5s (bài học folder 25).
    await expect(page.getByText('E2E Deletable')).toHaveCount(0, { timeout: 20_000 });
  });

  test('logout → quay lại "Sign in"', async ({ page }) => {
    await login(page);
    await page.goto('/en');
    await expect(page.getByText('Signed in (ADMIN)')).toBeVisible();
    await page.getByRole('button', { name: 'Sign out' }).click();
    // logoutAction xoá cookie + redirect '/' → AuthStatus render lại thành link "Sign in".
    await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible();
  });
});
