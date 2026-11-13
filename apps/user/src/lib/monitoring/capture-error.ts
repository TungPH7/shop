import { normalizeError } from '~/lib/errors/normalize-error';
import { captureException } from '~/lib/monitoring/monitoring';

// `source` = nơi bắt được lỗi → giúp triage biết lỗi đến từ đâu (server vs client boundary nào).
export type ErrorSource =
  | 'instrumentation' // SERVER: onRequestError (render RSC / Route Handler / Server Action / proxy)
  | 'react-error-boundary' // CLIENT: app/[locale]/error.tsx
  | 'global-error'; // CLIENT: app/global-error.tsx (root layout sập)

export interface ErrorContext extends Record<string, unknown> {
  source?: ErrorSource;
}

/**
 * Điểm VÀO DUY NHẤT để báo một lỗi tới monitoring. Mọi nơi bắt lỗi (instrumentation server, error
 * boundary client) gọi hàm này → swap vendor (Sentry) = đổi transport ở `configureMonitoring`,
 * call-site KHÔNG đổi (đúng lời hứa "seam" từ folder 12/17).
 *
 * ⭐ Khác sibling React SPA (chỉ delegate thẳng): ở đây chạy `normalizeError` (folder 17) TRƯỚC để
 * PHÂN LOẠI lỗi về domain (`AppError.kind`: not_found / unauthorized / rate_limited / unexpected…)
 * rồi đính `kind` vào context. Nhờ vậy log/Sentry có nhãn triage NHẤT QUÁN với taxonomy folder 17,
 * và `normalizeError` đảm bảo KHÔNG nuốt lỗi (luôn trả `AppError`, giữ `cause`). Hàm này fire-and-
 * forget (không ném tiếp) — chỉ báo cáo; quyết định hiển thị/redirect là việc của boundary/page.
 */
export function captureError(error: unknown, context: ErrorContext = {}): void {
  const appError = normalizeError(error);
  captureException(appError, { ...context, kind: appError.kind });
}
