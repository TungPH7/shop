import { RateLimitError } from '~/lib/errors/app-error';
import { err, ok, type Result } from '~/lib/errors/result';

/**
 * Mô phỏng một thao tác CÓ THỂ thất bại theo cách **DỰ KIẾN** (vd backend rate-limit). Trả `Result`
 * thay vì `throw` → caller xử lý nhánh `err` TẠI CHỖ (giữ trang sống), khác lỗi THẬT (`throw` → error
 * boundary). Hàm THUẦN (no I/O) → unit-test trực tiếp; cùng tinh thần với luồng 429 ở `product-results`.
 */
export function simulateLookup(shouldFail: boolean): Result<string, RateLimitError> {
  if (shouldFail) {
    return err(new RateLimitError('Simulated rate limit'));
  }
  return ok('lookup-ok');
}
