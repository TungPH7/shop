import { type AppError } from '~/lib/errors/app-error';

/**
 * `Result<T, E>` — mô hình hoá lỗi **DỰ KIẾN** (đã lường trước, phục hồi được) thành GIÁ TRỊ trả về
 * thay vì `throw`.
 *
 * Hai cách báo lỗi, đừng trộn:
 *  - **`throw`** = lỗi THẬT/bất ngờ (network, 5xx, bug, lệch schema) → để error boundary (`error.tsx`/
 *    `global-error.tsx`) bắt.
 *  - **`Result` (return)** = lỗi DỰ KIẾN trong luồng nghiệp vụ (vd 429 khi spam refresh) → caller xử lý
 *    tại chỗ (hiện thông báo, giữ giao diện) mà KHÔNG làm sập cây render.
 *
 * Discriminated union theo cờ `ok` → TypeScript tự thu hẹp: `if (result.ok)` ⇒ có `value`, ngược lại có
 * `error`. Mặc định `E = AppError` (taxonomy domain — xem `./app-error`).
 */
export type Result<T, E = AppError> = { ok: true; value: T } | { ok: false; error: E };

/** Bọc giá trị thành công. */
export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

/** Bọc lỗi dự kiến. */
export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

/** Type guard nhánh thành công (khi cần thu hẹp ngoài câu lệnh `if (result.ok)`). */
export function isOk<T, E>(result: Result<T, E>): result is { ok: true; value: T } {
  return result.ok;
}

/** Type guard nhánh lỗi. */
export function isErr<T, E>(result: Result<T, E>): result is { ok: false; error: E } {
  return !result.ok;
}
