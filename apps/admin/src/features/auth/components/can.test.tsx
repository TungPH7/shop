import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';

import { Can } from '@/features/auth/components/can';
import { clearTokens, setTokens } from '@/lib/auth/token-storage';
import { server } from '@/testing/msw/server';
import { renderWithProviders, screen } from '@/testing/render';

describe('Can (element-level RBAC)', () => {
  afterEach(() => {
    clearTokens();
  });

  it('hides children when the user lacks the permission', () => {
    // No token → profile query disabled → no permissions → children hidden.
    renderWithProviders(
      <Can method="DELETE" path="/products">
        <button>Delete</button>
      </Can>,
    );
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
  });

  it('shows children when the profile grants the permission', async () => {
    server.use(
      http.get('*/profile', () =>
        HttpResponse.json({
          id: 1,
          email: 'a@b.com',
          name: 'Admin',
          role: {
            id: 1,
            name: 'admin',
            permissions: [
              { id: 1, name: 'del', path: '/products', method: 'DELETE', module: 'product' },
            ],
          },
        }),
      ),
    );
    setTokens({ accessToken: 'a', refreshToken: 'r' }); // before render → profile enabled

    renderWithProviders(
      <Can method="DELETE" path="/products">
        <button>Delete</button>
      </Can>,
    );

    expect(await screen.findByRole('button', { name: 'Delete' })).toBeInTheDocument();
  });
});
