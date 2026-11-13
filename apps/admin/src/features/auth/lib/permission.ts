import { type Permission } from '@/features/auth/model/auth';

// Pure RBAC predicates over a permission list. Framework-free so they're trivial
// to unit-test; the hooks/guards are thin wrappers around these (the actual
// decision logic lives here, not in components).

/** Element-level: does the user hold the permission for this API operation? */
export function hasPermission(
  permissions: readonly Permission[],
  method: string,
  path: string,
): boolean {
  return permissions.some((permission) => permission.method === method && permission.path === path);
}

/** Route-level: does the user hold ANY permission in this module? */
export function hasModule(permissions: readonly Permission[], module: string): boolean {
  return permissions.some((permission) => permission.module === module);
}
