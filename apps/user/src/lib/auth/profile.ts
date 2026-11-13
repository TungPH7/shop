import { z } from 'zod';

/**
 * DTO TỐI THIỂU cho `GET /profile` (kỷ luật folder 11: validate ở biên, chỉ giữ field DÙNG). Backend
 * trả nhiều hơn (phoneNumber, avatar, status, role.id, permission.id/name/description…) — Zod object
 * non-strict BỎ field thừa → DTO gọn + chịu được drift. Đủ cho hiển thị + RBAC: id/email/name +
 * role.name + permissions{module,path,method}.
 */
const permissionSchema = z.object({
  module: z.string(),
  path: z.string(),
  method: z.string(),
});

export const profileSchema = z.object({
  id: z.number(),
  email: z.email(),
  name: z.string(),
  // ⭐ folder 16: form sửa hồ sơ cần prefill `phoneNumber`/`avatar` → DTO mở rộng thêm 2 field
  // (vẫn "tối thiểu" = chỉ field app DÙNG; backend trả nhiều hơn, Zod non-strict bỏ phần thừa).
  phoneNumber: z.string(),
  avatar: z.string().nullable(),
  role: z.object({
    name: z.string(),
    permissions: z.array(permissionSchema),
  }),
});

export type Permission = z.infer<typeof permissionSchema>;
export type AuthUser = z.infer<typeof profileSchema>;
