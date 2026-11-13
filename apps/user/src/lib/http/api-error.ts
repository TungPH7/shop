// Một hình lỗi DUY NHẤT, chuẩn hoá cho cả app. DAL + UI bắt `ApiError`, không bao giờ chạm
// chi tiết của transport (fetch/Response) — giữ transport là implementation detail sau boundary.
// (Mirror ApiError của guide React nhưng BỎ axios: server-first dùng native fetch.)

export type ApiErrorKind =
  | 'network' // không có response (offline/DNS/connection refused)
  | 'timeout' // request bị huỷ do timeout
  | 'validation' // body không khớp schema ở boundary (hoặc không phải JSON)
  | 'http' // server trả status không-2xx
  | 'unknown';

export interface ApiErrorOptions {
  kind: ApiErrorKind;
  message: string;
  /** HTTP status, set khi `kind === 'http'`. */
  status?: number | undefined;
  /** Mã lỗi nghiệp vụ từ body, khi backend gửi. */
  code?: string | undefined;
  /** Payload thô / Zod issues — để log/debug, KHÔNG dùng làm copy cho UI. */
  details?: unknown;
  /** Lỗi gốc đã được chuẩn hoá. */
  cause?: unknown;
}

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number | undefined;
  readonly code: string | undefined;
  readonly details: unknown;

  constructor(options: ApiErrorOptions) {
    super(options.message, { cause: options.cause });
    this.name = 'ApiError';
    this.kind = options.kind;
    this.status = options.status;
    this.code = options.code;
    this.details = options.details;
  }

  /** 401/403 — caller có thể redirect login hoặc hiện màn "không có quyền". */
  get isAuthError(): boolean {
    return this.status === 401 || this.status === 403;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}
