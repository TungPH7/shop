import { NextResponse } from 'next/server';

/**
 * Route Handler CHỈ dành cho E2E (folder 24/25) — reset store MSW-in-server về seed ban đầu để MỖI test
 * (và mỗi retry Playwright) khởi đầu tất định. Playwright dùng CHUNG một tiến trình `next start` cho cả
 * run (`reuseExistingServer:false` chỉ fresh mỗi lần chạy, KHÔNG mỗi retry) → không reset thì test xoá làm
 * hụt fixture ở lần sau (retry không thể pass). Gọi từ `beforeEach` trong e2e/auth.spec.ts.
 *
 * ⭐ Gate + DYNAMIC import (giống instrumentation.ts): chỉ khi `E2E_API_MOCKING==='1'` (cờ CHỈ có ở
 * webServer của Playwright — xem playwright.config) mới nạp `e2e-handlers` (kéo theo `msw`). build/dev/
 * prod THẬT → trả 404 và KHÔNG bao giờ nạp code mock vào bundle. `NEXT_RUNTIME` không set ở đây nên đọc
 * `process.env.E2E_API_MOCKING` trực tiếp là hợp lệ (cờ hạ tầng, không phải app config vào schema env).
 */
export async function POST(): Promise<NextResponse> {
  if (process.env.E2E_API_MOCKING !== '1') {
    return new NextResponse('Not found', { status: 404 });
  }
  const { resetE2eStore } = await import('~/testing/msw/e2e-handlers');
  resetE2eStore();
  return NextResponse.json({ ok: true });
}
