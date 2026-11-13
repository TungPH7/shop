import { http, HttpResponse } from 'msw';
import { type ReactNode } from 'react';
import { createMemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { ProductDetail } from '@/features/product/components/product-detail';
import { renderWithRouter, screen } from '@/testing/render';
import { server } from '@/testing/msw/server';

// ProductDetail reads `:productId` from the route, so it needs a real router with
// that param (renderWithRouter, folder 15) — not the bare MemoryRouter helper.
function renderDetail(initialPath: string, ui: ReactNode) {
  const router = createMemoryRouter([{ path: '/products/:productId', element: ui }], {
    initialEntries: [initialPath],
  });
  return renderWithRouter(router);
}

describe('ProductDetail', () => {
  it('renders the product and an injected action slot', async () => {
    renderDetail(
      '/products/p-001',
      <ProductDetail actions={<button type="button">Edit</button>} />,
    );

    expect(await screen.findByRole('heading', { name: 'Test Widget' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument(); // app-injected slot
  });

  it('shows a not-found message for a 404', async () => {
    server.use(
      http.get('*/products/:id', () => HttpResponse.json({ message: 'nope' }, { status: 404 })),
    );

    renderDetail('/products/missing', <ProductDetail />);

    expect(await screen.findByRole('heading', { name: 'Product not found' })).toBeInTheDocument();
  });
});
