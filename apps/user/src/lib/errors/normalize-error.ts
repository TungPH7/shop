import {
  type AppError,
  ForbiddenError,
  isAppError,
  NotFoundError,
  RateLimitError,
  UnauthorizedError,
  UnexpectedError,
  ValidationError,
} from '~/lib/errors/app-error';
import { type ApiError, isApiError } from '~/lib/http/api-error';

/**
 * Chuẩn hoá MỘT giá trị bắt được trong `catch` (kiểu `unknown`) → `AppError` domain.
 *
 * Đây là NƠI DUY NHẤT biết map transport (`ApiError`) + throwable bất kỳ → lỗi nghiệp vụ → call-site
 * chỉ cần `catch (e: unknown) { const err = normalizeError(e); … }` rồi rẽ theo `err.kind`/`instanceof`.
 *
 * Nguyên tắc **KHÔNG NUỐT LỖI**: hàm LUÔN trả `AppError` (không bao giờ `null`/`undefined`), và đính
 * lỗi gốc vào `cause` để log/triage. "Không phân loại được" ⇒ `UnexpectedError` (an toàn: sẽ được
 * ném tiếp cho error boundary, không âm thầm biến mất).
 */
export function normalizeError(error: unknown): AppError {
  if (isAppError(error)) {
    return error; // đã là lỗi domain → giữ nguyên (không bọc 2 lần)
  }
  if (isApiError(error)) {
    return fromApiError(error);
  }
  if (error instanceof Error) {
    return new UnexpectedError(error.message, { cause: error });
  }
  // throw một giá trị không phải Error (string/object/…): vẫn không nuốt — giữ ở cause.
  return new UnexpectedError('An unexpected error occurred', { cause: error });
}

/**
 * Map `ApiError` (transport) → `AppError` (nghiệp vụ) theo `kind`/`status`.
 * - HTTP có status → tra bảng status (404→NotFound, 401→Unauthorized, 403→Forbidden, 400/422→
 *   Validation, 429→RateLimit; còn lại → Unexpected).
 * - `network`/`timeout`/`validation`(lệch schema = LỖI CỦA TA, không phải input user)/`unknown` →
 *   đều là lỗi THẬT → `UnexpectedError`.
 */
function fromApiError(error: ApiError): AppError {
  if (error.kind === 'http') {
    switch (error.status) {
      case 400:
      case 422:
        return new ValidationError(error.message, { cause: error });
      case 401:
        return new UnauthorizedError(error.message, { cause: error });
      case 403:
        return new ForbiddenError(error.message, { cause: error });
      case 404:
        return new NotFoundError(error.message, { cause: error });
      case 429:
        return new RateLimitError(error.message, { cause: error });
      default:
        return new UnexpectedError(error.message, { cause: error });
    }
  }
  return new UnexpectedError(error.message, { cause: error });
}
