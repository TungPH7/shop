import { createMemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { routes } from '@/app/routes';
import { renderWithRouter, screen } from '@/testing/render';

function renderAt(url: string) {
  return renderWithRouter(createMemoryRouter(routes, { initialEntries: [url] }));
}

describe('routes', () => {
  it('shows only the S1.2 title on /products until US1 builds the list', async () => {
    renderAt('/products');

    expect(await screen.findByRole('heading', { level: 1, name: 'Products' })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
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
