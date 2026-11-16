import { expect, test, type Page } from '@playwright/test';

import { isLocal } from './support/env';

// E2E AUTH (MSW-in-server, folder 15 + 24) — login THẬT qua Server Action → niêm phong cookie phiên
// bằng jose → AuthStatus. Mock trả token ADMIN. Chứng minh cả pipeline auth server-first trong trình duyệt
// THẬT (unit chỉ test rời từng mảnh: seal, action). Cookie `__Host-session` là Secure → Chromium chấp
// nhận trên http://localhost (secure-context), giống ghi chú ở lib/auth/session.ts.

async function login(page: Page): Promise<void> {
  await page.goto('/en/login');
  await page.getByLabel('Email').fill('admin@e2e.test');
  await page.getByLabel('Password').fill('any-password'); // mock chấp nhận mọi mật khẩu
  // Nút submit tên "Sign in" (button) — phân biệt với link "Sign in" của AuthStatus (role khác).
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/en$/); // loginAction redirect về '/' theo locale hiện tại.
}

test.describe('auth: login, logout', () => {
  // These tests need the MSW mock of the old NestJS auth API in the server, which only the apps started here have.
  // The login Epic replaces them.
  test.skip(({ baseURL }) => !isLocal(baseURL), 'reason: login Epic');

  test('login → hiển thị trạng thái đăng nhập (ADMIN)', async ({ page }) => {
    await login(page);
    // AuthStatus (server, đọc getCurrentUser từ cookie) stream vào layout → role lấy từ claim token.
    await expect(page.getByText('Signed in (ADMIN)')).toBeVisible();
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
