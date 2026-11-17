import { useCallback } from 'react';

import { useProfile } from '@/features/auth/api/get-profile';
import { hasModule as checkModule } from '@/features/auth/lib/permission';
import { type Permission } from '@/features/auth/model/auth';

export interface UsePermissionResult {
  hasModule: (module: string) => boolean;
}

// Stable empty reference so the callback below doesn't churn when logged out.
const NO_PERMISSIONS: readonly Permission[] = [];

// Reads permissions from the cached profile and delegates to the pure predicate.
export function usePermission(): UsePermissionResult {
  const { data: user } = useProfile();
  const permissions = user?.role.permissions;

  const hasModule = useCallback(
    (module: string) => checkModule(permissions ?? NO_PERMISSIONS, module),
    [permissions],
  );

  return { hasModule };
}
