import { type ReactNode } from 'react';

import { usePermission } from '@/features/auth/hooks/use-permission';

// Element-level RBAC guard: render children only when the user holds the
// method+path permission; otherwise render nothing (e.g. hide a delete button).
export function Can({
  method,
  path,
  children,
}: {
  method: string;
  path: string;
  children: ReactNode;
}) {
  const { hasPermission } = usePermission();
  return hasPermission(method, path) ? <>{children}</> : null;
}
