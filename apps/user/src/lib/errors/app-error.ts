// Taxonomy lỗi DOMAIN (tầng nghiệp vụ) — ngữ nghĩa, KHÔNG phụ thuộc transport.
//
// Phân biệt với `ApiError` (`~/lib/http/api-error`): ApiError = tầng TRANSPORT (network/timeout/
// http/validation/unknown — "đường truyền hỏng thế nào"). AppError = tầng NGHIỆP VỤ ("chuyện gì
// sai": không tìm thấy / thiếu quyền / input sai / bị giới hạn tần suất). Nhờ tách 2 tầng, page /
// action / error-boundary rẽ nhánh theo `kind` mà KHÔNG phải nhớ status HTTP.
//
// Cầu nối 2 tầng = `normalizeError` (`./normalize-error`): map ApiError + throwable bất kỳ → AppError.
// Luôn giữ lỗi gốc ở `cause` (Error v2 option) → KHÔNG nuốt lỗi (log/triage được chuỗi nguyên nhân).

export type AppErrorKind =
  | 'not_found' // tài nguyên không tồn tại (HTTP 404)
  | 'unauthorized' // CHƯA xác thực (HTTP 401) → caller có thể đưa về /login
  | 'forbidden' // ĐÃ xác thực nhưng THIẾU quyền (HTTP 403)
  | 'validation' // input không hợp lệ (vd backend trả 400/422)
  | 'rate_limited' // gọi quá nhiều (HTTP 429) — lỗi DỰ KIẾN, phục hồi được sau ít giây
  | 'unexpected'; // còn lại — lỗi THẬT/bất ngờ → ném cho error boundary

export interface AppErrorOptions {
  /** Lỗi gốc đã được chuẩn hoá (ApiError / Error / giá trị throw bất kỳ). */
  cause?: unknown;
}

/**
 * Lớp gốc của mọi lỗi domain. `kind` là discriminant (rẽ nhánh không cần `instanceof` từng lớp).
 * Kế thừa `Error` → vẫn `throw` được + có stack; `cause` nối lỗi gốc để log.
 */
export class AppError extends Error {
  readonly kind: AppErrorKind;

  constructor(kind: AppErrorKind, message: string, options?: AppErrorOptions) {
    super(message, { cause: options?.cause });
    this.name = 'AppError';
    this.kind = kind;
  }
}

/** 404 — không tìm thấy tài nguyên. Trang chi tiết map lỗi này → `notFound()` (→ not-found.tsx). */
export class NotFoundError extends AppError {
  constructor(message = 'Resource not found', options?: AppErrorOptions) {
    super('not_found', message, options);
    this.name = 'NotFoundError';
  }
}

/** 401 — chưa đăng nhập. */
export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required', options?: AppErrorOptions) {
    super('unauthorized', message, options);
    this.name = 'UnauthorizedError';
  }
}

/** 403 — đã đăng nhập nhưng không đủ quyền. */
export class ForbiddenError extends AppError {
  constructor(message = 'Access denied', options?: AppErrorOptions) {
    super('forbidden', message, options);
    this.name = 'ForbiddenError';
  }
}

/** 400/422 — dữ liệu vào không hợp lệ. */
export class ValidationError extends AppError {
  constructor(message = 'Invalid input', options?: AppErrorOptions) {
    super('validation', message, options);
    this.name = 'ValidationError';
  }
}

/** 429 — vượt giới hạn tần suất (lỗi DỰ KIẾN; backend demo dùng chung ~5 req/60s — folder 12). */
export class RateLimitError extends AppError {
  constructor(message = 'Too many requests', options?: AppErrorOptions) {
    super('rate_limited', message, options);
    this.name = 'RateLimitError';
  }
}

/** Mọi thứ còn lại = lỗi THẬT (network/5xx/lệch schema/bug) → để error boundary xử lý. */
export class UnexpectedError extends AppError {
  constructor(message = 'An unexpected error occurred', options?: AppErrorOptions) {
    super('unexpected', message, options);
    this.name = 'UnexpectedError';
  }
}

/** Type guard: thu hẹp `unknown` về `AppError` (dùng trong `catch (e: unknown)`). */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
