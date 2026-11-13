import { type Instrumentation } from 'next';

import { configureLoggerSink, logger } from '~/lib/logger/app-logger';
import { captureError } from '~/lib/monitoring/capture-error';

// `instrumentation.ts` (Next App Router) — chạy MỘT LẦN khi server khởi động. Đây là chỗ chính tắc
// để cắm observability phía SERVER (Next docs). KHÔNG cần cờ experimental (ổn định từ Next 15); đặt
// ở `src/` vì ta dùng thư mục src. Tự được Next nạp — không cần khai báo trong `next.config`.

/**
 * Chạy khi server boot. Đây là nơi `register` SDK observability (OTel/Sentry) ở các dự án thật.
 *
 * ⭐ Folder 20 — CẮM pino ở đây: pino là logger Node-only → chỉ nạp khi `NEXT_RUNTIME==='nodejs'` (KHÔNG
 * edge/client). `await import('~/lib/logger/pino-sink')` (dynamic) giữ pino NGOÀI đồ thị module client và
 * chỉ thực thi khi runtime đúng. Đổi sink TRƯỚC boot-log → ngay dòng `server.boot` đã đi qua pino (bằng
 * chứng swap thành công). edge/client KHÔNG chạy nhánh này → giữ `consoleSink` isomorphic (folder 18).
 *
 * ⭐ Folder 24 — BẬT MSW-in-server cho E2E: khi `E2E_API_MOCKING==='1'` (chỉ tiến trình `next start` của
 * Playwright set — xem playwright.config), nạp MSW/node ngay tại đây → nó patch http client Node của
 * CHÍNH process này ⇒ mọi fetch của DAL (server→backend) bị chặn bằng mock tất định. Đây là cách DUY
 * NHẤT mock được data server-render (page.route trình duyệt không thấy fetch phía server). Dynamic import
 * + cờ gate ⇒ build/dev/prod THẬT không bao giờ nạp code test.
 */
export async function register(): Promise<void> {
  // `NEXT_RUNTIME` do Next tiêm ('nodejs' | 'edge') — đánh dấu runtime, KHÔNG phải app config nên
  // không đưa vào schema env (đọc `process.env` trực tiếp ở đây là hợp lệ, hiếm hoi — như `E2E_API_MOCKING`).
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { pinoSink } = await import('~/lib/logger/pino-sink');
    configureLoggerSink(pinoSink);

    if (process.env.E2E_API_MOCKING === '1') {
      const { startE2eApiMocks } = await import('~/testing/msw/e2e-server');
      startE2eApiMocks();
      logger.warn('e2e.api-mocking.enabled');
    }
  }
  logger.info('server.boot', { runtime: process.env.NEXT_RUNTIME ?? 'nodejs' });
}

/**
 * `onRequestError` — Next gọi khi BẮT được lỗi phía SERVER: render RSC, Route Handler, Server
 * Action, proxy. Đây là điểm bắt lỗi server mà SPA sibling KHÔNG thể có. Chuyển thẳng vào seam
 * `captureError` (→ normalizeError → monitoring) kèm ngữ cảnh route để triage.
 *
 * ⚠️ `err` có thể KHÔNG phải instance gốc (React xử lý lại khi lỗi ở RSC) → dùng `digest` để truy
 *    ngược về dòng log lỗi tương ứng (prod che message phía client, chỉ còn digest).
 */
export const onRequestError: Instrumentation.onRequestError = (err, request, context) => {
  const digest =
    typeof err === 'object' && err !== null && 'digest' in err && typeof err.digest === 'string'
      ? err.digest
      : undefined;

  captureError(err, {
    source: 'instrumentation',
    method: request.method,
    path: request.path,
    routeType: context.routeType,
    routePath: context.routePath,
    renderSource: context.renderSource,
    revalidateReason: context.revalidateReason,
    digest,
  });
};
