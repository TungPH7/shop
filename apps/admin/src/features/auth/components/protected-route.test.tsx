import { createMemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';

import { ProtectedRoute } from '@/features/auth/components/protected-route';
import { clearTokens, setTokens } from '@/lib/auth/token-storage';
import { renderWithRouter, screen } from '@/testing/render';

function buildRouter() {
  return createMemoryRouter(
    [
      { element: <ProtectedRoute />, children: [{ index: true, element: <p>secret content</p> }] },
      { path: '/login', element: <p>login page</p> },
    ],
    { initialEntries: ['/'] },
  );
}

describe('ProtectedRoute', () => {
  afterEach(() => {
    clearTokens();
  });

  it('redirects to /login when unauthenticated', async () => {
    renderWithRouter(buildRouter());
    expect(await screen.findByText('login page')).toBeInTheDocument();
    expect(screen.queryByText('secret content')).not.toBeInTheDocument();
  });

  it('renders the protected content once the profile loads (authenticated)', async () => {
    setTokens({ accessToken: 'a', refreshToken: 'r' }); // default MSW /profile returns a user
    renderWithRouter(buildRouter());
    expect(await screen.findByText('secret content')).toBeInTheDocument();
  });
});
