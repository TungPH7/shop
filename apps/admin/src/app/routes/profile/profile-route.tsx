import { useAuth } from '@/features/auth/hooks/use-auth';

export function ProfileRoute() {
  const { user, logout } = useAuth();
  // ProtectedRoute guarantees a user reaches here; this also narrows the type.
  if (!user) return null;

  return (
    <section>
      <h2>Profile</h2>
      <p>Email: {user.email}</p>
      <p>Role: {user.role.name}</p>
      <p>Permissions: {user.role.permissions.length}</p>

      <p>
        <button type="button" onClick={() => logout.mutate()} disabled={logout.isPending}>
          {logout.isPending ? 'Signing out…' : 'Sign out'}
        </button>
      </p>
    </section>
  );
}
