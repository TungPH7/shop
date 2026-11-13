import { type ReactNode } from 'react';

import { getProfile } from '~/lib/auth/get-profile';
import { hasPermission } from '~/lib/auth/permissions';

/**
 * `<Can>` — guard ELEMENT-LEVEL (Server Component, shared → mọi feature dùng được). Render children
 * CHỈ khi user có quyền (method + path) theo `/profile`. Dùng cho nút/đường dẫn thao tác (vd Xoá sản
 * phẩm). Đặt trong vùng đã `<Suspense>` (getProfile đọc cookie ⇒ dynamic).
 *
 * ⚠️ Ẩn ≠ bảo mật: backend vẫn là chốt thực thi mỗi request (defense-in-depth). `<Can>` chỉ dọn UI.
 */
export async function Can({
  method,
  path,
  children,
}: {
  method: string;
  path: string;
  children: ReactNode;
}) {
  const user = await getProfile();
  if (user && hasPermission(user.role.permissions, method, path)) {
    return <>{children}</>;
  }
  return null;
}
