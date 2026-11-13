// Query-key factory for auth (hierarchical, like productKeys). `all` lets logout
// drop every auth-scoped cache entry at once.
export const authKeys = {
  all: ['auth'] as const,
  profile: () => [...authKeys.all, 'profile'] as const,
};
