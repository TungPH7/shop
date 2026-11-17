import { http, HttpResponse } from 'msw';
import { createMemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';

import { ProtectedRoute } from '@/features/auth/components/protected-route';
import { RequireModule } from '@/features/auth/components/require-module';
import { clearTokens, setTokens } from '@/lib/auth/token-storage';
import { server } from '@/testing/msw/server';
import { renderWithRouter, screen } from '@/testing/render';

// Composed as in routes.tsx: ProtectedRoute waits for the profile, then RequireModule checks it.
function buildRouter() {
  return createMemoryRouter(
    [
      {
        element: <ProtectedRoute />,
        children: [
          {
            element: <RequireModule module="role" />,
            children: [{ index: true, element: <p>admin area</p> }],
          },
        ],
      },
      { path: '/access-denied', element: <p>access denied page</p> },
    ],
    { initialEntries: ['/'] },
  );
}

function profileWithModules(...modules: string[]) {
  return HttpResponse.json({
    id: 1,
    email: 'test@example.com',
    name: 'Tester',
    role: {
      id: 1,
      name: 'admin',
      permissions: modules.map((module, index) => ({
        id: index + 1,
        name: `list ${module}`,
        path: `/${module}`,
        method: 'GET',
        module,
      })),
    },
  });
}

describe('RequireModule (route-level RBAC)', () => {
  afterEach(() => {
    clearTokens();
  });

  it('redirects to the access denied page when the user holds no permission of the module', async () => {
    server.use(http.get('*/profile', () => profileWithModules('product')));
    setTokens({ accessToken: 'a', refreshToken: 'r' });

    renderWithRouter(buildRouter());

    expect(await screen.findByText('access denied page')).toBeInTheDocument();
    expect(screen.queryByText('admin area')).not.toBeInTheDocument();
  });

  it('renders the page once the profile grants a permission of the module', async () => {
    server.use(http.get('*/profile', () => profileWithModules('product', 'role')));
    setTokens({ accessToken: 'a', refreshToken: 'r' });

    renderWithRouter(buildRouter());

    expect(await screen.findByText('admin area')).toBeInTheDocument();
  });
});
