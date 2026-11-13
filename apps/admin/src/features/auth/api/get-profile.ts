import { queryOptions, useQuery } from '@tanstack/react-query';

import { authKeys } from '@/features/auth/api/auth-keys';
import { useAccessToken } from '@/features/auth/hooks/use-access-token';
import { userSchema, type User } from '@/features/auth/model/auth';
import { api } from '@/lib/api/api';

// GET /profile → the authenticated user + role.permissions. Login returns ONLY
// tokens, so the user is fetched separately — this query is the source of truth
// for `isAuthenticated` (a present-but-invalid token fails here).
//
// NOTE: if the backend wraps responses in an envelope (e.g. `{ data: ... }`),
// adjust the schema here. Confirmed against the live backend at folder 15.
export function getProfile(): Promise<User> {
  return api.get('/profile', { schema: userSchema });
}

export function profileQueryOptions() {
  return queryOptions({
    queryKey: authKeys.profile(),
    queryFn: getProfile,
    staleTime: 5 * 60_000,
    retry: false, // the api layer already retries; a 401 here means re-auth
  });
}

// Only fetch when a token exists; reactive via useAccessToken so the profile
// loads right after login and clears after logout.
export function useProfile() {
  const accessToken = useAccessToken();
  return useQuery({ ...profileQueryOptions(), enabled: accessToken !== null });
}
