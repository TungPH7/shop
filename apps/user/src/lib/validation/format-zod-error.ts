import { type ZodError } from 'zod';

/**
 * `ZodError` → map `{ field: <code đầu tiên> }` để UI dịch (folder 13).
 *
 * ⭐ Quyết định folder 13: schema phát ra **CODE ổn định** (locale-agnostic, vd `too_short` qua
 * `{ error: 'too_short' }`), UI map sang chuỗi đã dịch bằng `t('Validation.<code>')` (nhất quán
 * `reason` codes folder 12 — tầng schema KHÔNG dính i18n).
 *
 * Duyệt `error.issues` (mỗi issue có `path` + `message`; `message` CHÍNH LÀ code ta đặt) → lấy code
 * ĐẦU TIÊN mỗi field top-level (UI thường hiện 1 lỗi/field). Lỗi mức-form (path rỗng) / field lồng
 * bỏ qua ở demo này — Zod 4 còn `z.flattenError`/`z.treeifyError` cho ca phức tạp (→ folder 16 forms).
 */
export function getFieldErrorCodes(error: ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = issue.path[0];
    if (typeof field === 'string' && !(field in result)) {
      result[field] = issue.message;
    }
  }
  return result;
}
