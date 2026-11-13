import { Navigate, Outlet } from 'react-router';

import { useAuth } from '@/features/auth/hooks/use-auth';
import { paths } from '@/config/paths';

// Route-level guard: requires an authenticated user. While an existing token is
// being verified (GET /profile in flight) we wait instead of bouncing to /login,
// so a logged-in user who reloads is not flashed the login page.
export function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <p role="status">Checking your session…</p>;
  }
  if (!isAuthenticated) {
    return <Navigate to={paths.login.getHref()} replace />;
  }
  return <Outlet />;
}
