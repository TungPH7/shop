import { type Permission } from '@/features/auth/model/auth';

// Pure RBAC predicate over a permission list. Framework-free so it's trivial to
// unit-test; the hook and the route guard are thin wrappers around it (the actual
// decision logic lives here, not in components).

/** Route-level: does the user hold ANY permission in this module? */
export function hasModule(permissions: readonly Permission[], module: string): boolean {
  return permissions.some((permission) => permission.module === module);
}
