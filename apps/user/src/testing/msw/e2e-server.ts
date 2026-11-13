import { setupServer } from 'msw/node';

import { e2eHandlers } from '~/testing/msw/e2e-handlers';

/**
 * MSW server (Node) cho E2E — dựng TRONG process Next qua `instrumentation.ts` khi `E2E_API_MOCKING=1`
 * (folder 24). Tách khỏi `server.ts` (dùng cho Vitest) để không đụng handlers/onUnhandledRequest của test.
 *
 * ⭐ `onUnhandledRequest: 'bypass'` (KHÁC Vitest dùng `'error'`): trong process Next có những outbound
 * KHÔNG phải backend — ví dụ optimizer `next/image` fetch `picsum.photos` (ảnh card sản phẩm). Bypass =
 * cho chúng đi thẳng mạng thật thay vì làm SẬP server. (Vitest cần `'error'` để bắt test thiếu mock; ở
 * đây ta chỉ muốn chặn ĐÚNG backend, phần còn lại để nguyên.)
 *
 * Idempotent qua cờ `started`: `register()` chỉ chạy 1 lần lúc boot, nhưng phòng HMR/gọi lại.
 */
let started = false;

export function startE2eApiMocks(): void {
  if (started) return;
  const server = setupServer(...e2eHandlers);
  server.listen({ onUnhandledRequest: 'bypass' });
  started = true;
}
