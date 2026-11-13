import { type Permission } from '~/lib/auth/profile';

/**
 * Vị từ RBAC THUẦN (framework-free → testable nhất) — port từ guide React. Quyền đến TỪ BACKEND (nằm
 * trong `/profile`), KHÔNG hardcode ở FE. FE chỉ ẩn/hiện cho UX; backend mới là chốt THỰC THI mỗi request.
 */

/** Có quyền cho thao tác API cụ thể (method + path khớp permission backend)? — element-level (`<Can>`). */
export function hasPermission(
  permissions: readonly Permission[],
  method: string,
  path: string,
): boolean {
  return permissions.some((p) => p.method === method && p.path === path);
}

/** Có BẤT KỲ quyền nào trong module? — route-level (`requireModule`, thô hơn nhưng bền với đổi path). */
export function hasModule(permissions: readonly Permission[], module: string): boolean {
  return permissions.some((p) => p.module === module);
}
