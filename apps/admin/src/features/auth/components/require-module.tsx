import { Navigate, Outlet } from 'react-router';

import { usePermission } from '@/features/auth/hooks/use-permission';
import { paths } from '@/config/paths';

// Route-level RBAC guard: requires ANY permission in `module`. Assumes auth was
// already enforced by a parent ProtectedRoute (compose them: ProtectedRoute →
// RequireModule → page).
export function RequireModule({ module }: { module: string }) {
  const { hasModule } = usePermission();

  if (!hasModule(module)) {
    return <Navigate to={paths.accessDenied.getHref()} replace />;
  }
  return <Outlet />;
}
