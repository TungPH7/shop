/**
 * Cấu hình TĨNH của site (hằng số thương hiệu) — KHÔNG phải biến môi trường.
 *
 * Giá trị env (vd URL backend) đã chuyển sang `~/config/env` (validate bằng Zod,
 * folder 07). File này chỉ giữ những hằng số không đổi theo môi trường.
 */
export const siteConfig = {
  name: 'tungph7 codebase',
} as const;
