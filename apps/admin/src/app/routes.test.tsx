import { http, HttpResponse } from 'msw';
import { createMemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { routes } from '@/app/routes';
import { server } from '@/testing/msw/server';
import { renderWithRouter, screen } from '@/testing/render';

function renderAt(url: string) {
  return renderWithRouter(createMemoryRouter(routes, { initialEntries: [url] }));
}

describe('routes', () => {
  it('opens the product list S1 on /products without signing in (AC1)', async () => {
    server.use(
      http.get('*/admin/products', () =>
        HttpResponse.json({ items: [], totalItems: 0, offset: 0, limit: 20 }),
      ),
    );
    const router = createMemoryRouter(routes, { initialEntries: ['/products'] });
    renderWithRouter(router);

    expect(await screen.findByRole('heading', { level: 1, name: 'Products' })).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: 'Search by name' })).toBeInTheDocument();
    expect(await screen.findByText('No products yet.')).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/products');
  });

  it('has no product detail page of the template', async () => {
    renderAt('/products/p-001');

    expect(
      await screen.findByRole('heading', { name: '404 — Page not found' }),
    ).toBeInTheDocument();
  });

  it('has no product edit page of the template', async () => {
    renderAt('/admin/products/p-001/edit');

    expect(
      await screen.findByRole('heading', { name: '404 — Page not found' }),
    ).toBeInTheDocument();
  });

  it('still opens the About page', async () => {
    renderAt('/about');

    expect(await screen.findByRole('heading', { level: 1, name: 'About' })).toBeInTheDocument();
  });
});
