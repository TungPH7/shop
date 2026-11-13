import { useMutation, useQueryClient } from '@tanstack/react-query';

import { authKeys } from '@/features/auth/api/auth-keys';
import {
  authTokensSchema,
  type AuthTokens,
  type LoginCredentials,
} from '@/features/auth/model/auth';
import { api } from '@/lib/api/api';
import { setTokens } from '@/lib/auth/token-storage';

// POST /auth/login → tokens only (no user). The user arrives via GET /profile,
// which the profile query refetches once tokens are stored.
export function login(credentials: LoginCredentials): Promise<AuthTokens> {
  return api.post('/auth/login', credentials, { schema: authTokensSchema });
}

export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: login,
    onSuccess: (tokens) => {
      // Persist → useAccessToken flips → the (now enabled) profile query fetches.
      setTokens(tokens);
      void queryClient.invalidateQueries({ queryKey: authKeys.profile() });
    },
  });
}
