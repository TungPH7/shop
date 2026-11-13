import { fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Vitest chạy bằng pipeline Vite/esbuild RIÊNG, KHÔNG phải compiler của Next
// (Turbopack/SWC) -> phải tự khai:
//   - react(): transform JSX/TSX cho test.
//   - resolve.tsconfigPaths: đọc `paths` trong tsconfig (folder 02) -> resolve alias `~`.
// ⭐ Guide Vitest CHÍNH THỨC của Next vẫn dùng plugin `vite-tsconfig-paths`, NHƯNG
// Vite (qua Vitest 4.1.9) đã hỗ trợ NATIVE qua `resolve.tsconfigPaths: true` và
// runtime tự nhắc gỡ plugin -> bỏ plugin = bớt 1 dep + bớt transitive `tsconfck`
// (đang deprecated). Đã verify alias `~` vẫn resolve trong test (xem verify.md).
export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
    alias: {
      // `server-only` (npm) ném lỗi khi import ngoài Next server bundle (Node/Vitest không có
      // react-server condition) → trỏ về stub no-op để test được DAL/http client (folder 11).
      'server-only': fileURLToPath(new URL('./src/testing/stubs/server-only.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    // Cung cấp env HỢP LỆ cho mọi test: test nào (gián tiếp) import `~/config/env`
    // đều qua validate. env.test.ts ghi đè bằng vi.stubEnv để thử cả nhánh hợp lệ
    // lẫn fail. (Vitest KHÔNG tự nạp `.env.*` như Next → phải khai ở đây.)
    env: {
      API_URL: 'https://api.example.test',
      // Origin site cho test SEO (sitemap/robots/metadata helper đọc clientEnv.NEXT_PUBLIC_SITE_URL).
      NEXT_PUBLIC_SITE_URL: 'https://site.example.test',
      // ≥32 ký tự để qua validate AUTH_SECRET (folder 15). Test session-seal cũng dùng
      // CHÍNH giá trị này để tự dẫn khoá khi dựng token hết-hạn/sai-khoá.
      AUTH_SECRET: 'test-secret-at-least-32-characters-long',
    },
    // globals:false (mặc định) -> test import { test, expect } from 'vitest' tường
    // minh (khớp ví dụ chính thức Next) -> không cần khai types toàn cục.
    globals: false,
    setupFiles: ['./src/testing/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
    clearMocks: true,
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      // The default reporters plus lcov: the CI of ai-orchestrator reads coverage/lcov.info to measure the lines a PR
      // changes.
      reporter: ['text', 'html', 'clover', 'json', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      // ⭐ Loại trừ phần KHÔNG unit-test được có ý nghĩa → % phản ánh LOGIC đã test, không phải
      // boilerplate (triết lý Fowler/Google Testing: coverage tìm chỗ chưa test, KHÔNG phải điểm chất
      // lượng). Server-first: route shell/page/layout + async Server Component + boot/middleware là
      // "lãnh địa E2E" (folder 24), KHÔNG unit-test được (docs Next) → loại khỏi mẫu số unit:
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/testing/**',
        'src/**/*.d.ts',
        // route shell/page/layout/error/sitemap/robots/og — async RSC + Next conventions → E2E. src/app/api/** stays in:
        // a route handler is a plain function a unit test calls, and the CI of ai-orchestrator needs every file a PR
        // changes in coverage/lcov.info (SHOP-1).
        'src/app/*locale*/**',
        'src/app/*.{ts,tsx}',
        'src/instrumentation.ts', // boot glue (nhánh E2E cover) — không unit-worthy
        'src/proxy.ts', // middleware next-intl — E2E cover (curl/Playwright)
      ],
      // ⭐ Ngưỡng = SÀN chống-tụt (ratchet), đặt DƯỚI baseline đo thực (folder 25; folder 05 hoãn tới
      // đây). Server-first có unit-% THẤP hơn SPA sibling BẢN CHẤT: nhiều logic nằm ở async RSC do E2E
      // phủ, không tính vào unit. Baseline đo (sau exclude trên): stmts 73.8 / branches 61.6 / funcs
      // 77.4 / lines 73.5. Sàn dưới baseline vài điểm; `branches` để rộng hơn (nhánh phòng-thủ
      // error/guard/normalize nhiều, phần lớn do E2E/edge phủ + branch-coverage vốn nhiễu nhất).
      // Enforce ở CI qua `pnpm test:coverage` (folder 25). KHÔNG chạy đua tăng số (chống gaming).
      thresholds: {
        statements: 70,
        branches: 55,
        functions: 72,
        lines: 70,
      },
    },
  },
});
