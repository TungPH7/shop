import { useMutation, useQueryClient } from '@tanstack/react-query';

import { authKeys } from '@/features/auth/api/auth-keys';
import { api } from '@/lib/api/api';
import { clearTokens, getRefreshToken } from '@/lib/auth/token-storage';

// Best-effort server logout (revoke the refresh token). Local cleanup runs in
// `onSettled` regardless, so the user is logged out even if the request fails.
export function logout(): Promise<unknown> {
  return api.post('/auth/logout', { refreshToken: getRefreshToken() });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: logout,
    onSettled: () => {
      clearTokens(); // → useAccessToken flips → profile query disables
      queryClient.removeQueries({ queryKey: authKeys.all });
    },
  });
}
