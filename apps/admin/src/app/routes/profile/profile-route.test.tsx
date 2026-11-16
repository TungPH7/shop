import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';

import { ProfileRoute } from '@/app/routes/profile/profile-route';
import { clearTokens, setTokens } from '@/lib/auth/token-storage';
import { server } from '@/testing/msw/server';
import { renderWithProviders, screen } from '@/testing/render';

describe('ProfileRoute', () => {
  afterEach(() => {
    clearTokens();
  });

  it('shows the email, role and permission count of the signed-in user', async () => {
    setTokens({ accessToken: 'a', refreshToken: 'r' }); // default MSW /profile returns a user

    renderWithProviders(<ProfileRoute />);

    expect(await screen.findByText('Email: test@example.com')).toBeInTheDocument();
    expect(screen.getByText('Role: admin')).toBeInTheDocument();
    expect(screen.getByText('Permissions: 0')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
  });

  it('has no demo product action, even for a user allowed to delete products', async () => {
    server.use(
      http.get('*/profile', () =>
        HttpResponse.json({
          id: 1,
          email: 'test@example.com',
          name: 'Tester',
          role: {
            id: 1,
            name: 'admin',
            permissions: [
              {
                id: 1,
                name: 'delete product',
                path: '/products/:productId',
                method: 'DELETE',
                module: 'product',
              },
            ],
          },
        }),
      ),
    );
    setTokens({ accessToken: 'a', refreshToken: 'r' });

    renderWithProviders(<ProfileRoute />);

    expect(await screen.findByText('Permissions: 1')).toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.queryByRole('button', { name: /delete product/i })).not.toBeInTheDocument();
  });
});
