import { useCallback } from 'react';

import { useProfile } from '@/features/auth/api/get-profile';
import {
  hasModule as checkModule,
  hasPermission as checkPermission,
} from '@/features/auth/lib/permission';
import { type Permission } from '@/features/auth/model/auth';

export interface UsePermissionResult {
  hasPermission: (method: string, path: string) => boolean;
  hasModule: (module: string) => boolean;
}

// Stable empty reference so the callbacks below don't churn when logged out.
const NO_PERMISSIONS: readonly Permission[] = [];

// Reads permissions from the cached profile and delegates to the pure predicates.
export function usePermission(): UsePermissionResult {
  const { data: user } = useProfile();
  const permissions = user?.role.permissions;

  const hasPermission = useCallback(
    (method: string, path: string) => checkPermission(permissions ?? NO_PERMISSIONS, method, path),
    [permissions],
  );
  const hasModule = useCallback(
    (module: string) => checkModule(permissions ?? NO_PERMISSIONS, module),
    [permissions],
  );

  return { hasPermission, hasModule };
}
