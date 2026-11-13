import { useProfile } from '@/features/auth/api/get-profile';
import { useLogin } from '@/features/auth/api/login';
import { useLogout } from '@/features/auth/api/logout';
import { useAccessToken } from '@/features/auth/hooks/use-access-token';
import { type User } from '@/features/auth/model/auth';

export interface UseAuthResult {
  user: User | null;
  isAuthenticated: boolean;
  /** True only while verifying an existing token (GET /profile in flight). */
  isLoading: boolean;
  login: ReturnType<typeof useLogin>;
  logout: ReturnType<typeof useLogout>;
}

// Facade over the auth mechanism (token store + profile query + mutations).
// Components depend on this, not on Query/axios/localStorage, so the auth
// implementation stays swappable — same seam idea as the store facades (folder 09).
// `isAuthenticated` is derived from a successfully fetched profile, not mere token
// presence (a stale/invalid token fails the profile fetch).
export function useAuth(): UseAuthResult {
  const hasToken = useAccessToken() !== null;
  const { data: user, isLoading } = useProfile();
  const login = useLogin();
  const logout = useLogout();
  return {
    user: user ?? null,
    isAuthenticated: user !== undefined,
    isLoading: hasToken && isLoading,
    login,
    logout,
  };
}
