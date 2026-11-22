import { http, HttpResponse } from 'msw';
import { createMemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';

import { routes } from '@/app/routes';
import { server } from '@/testing/msw/server';
import { renderWithRouter, screen } from '@/testing/render';

const shirt = {
  id: '019a8f2e-5b7c-7d10-9e3f-1a2b3c4d5e6f',
  name: 'Áo thun cổ tròn',
  slug: 'ao-thun-co-tron',
  description: null,
  price: 250000,
  compareAtPrice: null,
  status: 'ACTIVE',
  availability: 'IN_STOCK',
  createdAt: '2026-11-16T02:10:00.000Z',
  updatedAt: '2026-11-16T02:15:30.000Z',
  version: 0,
};

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

  it('opens the add form S2 on /products/new without signing in (US2)', async () => {
    const router = createMemoryRouter(routes, { initialEntries: ['/products/new'] });
    renderWithRouter(router);

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Add product' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /Product name/ })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/products/new');
  });

  it('goes from Add product of the list (S1.3) to the add form (S2)', async () => {
    server.use(
      http.get('*/admin/products', () =>
        HttpResponse.json({ items: [], totalItems: 0, offset: 0, limit: 20 }),
      ),
    );
    const router = createMemoryRouter(routes, { initialEntries: ['/products'] });
    const { user } = renderWithRouter(router);
    await screen.findByText('No products yet.');

    await user.click(screen.getAllByRole('link', { name: 'Add product' })[0]!);

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Add product' }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/products/new');
  });

  it('opens the edit form S2 of the product on /products/:productId/edit without signing in (US3)', async () => {
    const ids: string[] = [];
    server.use(
      http.get('*/admin/products/:id', ({ params }) => {
        ids.push(String(params['id']));
        return HttpResponse.json(shirt);
      }),
    );
    const router = createMemoryRouter(routes, {
      initialEntries: [`/products/${shirt.id}/edit`],
    });
    renderWithRouter(router);

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Edit product' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /Product name/ })).toHaveValue(shirt.name);
    expect(ids).toEqual([shirt.id]);
    expect(router.state.location.pathname).toBe(`/products/${shirt.id}/edit`);
  });

  it('goes from Edit of a row of the list (S1.7) to the edit form of its product (S2)', async () => {
    server.use(
      http.get('*/admin/products', () =>
        HttpResponse.json({ items: [shirt], totalItems: 1, offset: 0, limit: 20 }),
      ),
      http.get('*/admin/products/:id', () => HttpResponse.json(shirt)),
    );
    const router = createMemoryRouter(routes, { initialEntries: ['/products'] });
    const { user } = renderWithRouter(router);

    await user.click(await screen.findByRole('link', { name: `Edit ${shirt.name}` }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Edit product' }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(`/products/${shirt.id}/edit`);
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

  it('opens the category list S1 of SHOP-81 on /categories without signing in', async () => {
    server.use(http.get('*/admin/categories', () => HttpResponse.json({ items: [] })));
    const router = createMemoryRouter(routes, { initialEntries: ['/categories'] });
    renderWithRouter(router);

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Categories' }),
    ).toBeInTheDocument();
    expect(await screen.findByText('No categories yet.')).toBeInTheDocument();
  });

  it('goes from Add category of S1 to the add form S2 of SHOP-81', async () => {
    server.use(http.get('*/admin/categories', () => HttpResponse.json({ items: [] })));
    const router = createMemoryRouter(routes, { initialEntries: ['/categories'] });
    const { user } = renderWithRouter(router);
    await screen.findByText('No categories yet.');

    await user.click(screen.getByRole('link', { name: 'Add category' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Add category' }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/categories/new');
  });

  it('opens the edit form S2 of SHOP-81 of the category on /categories/:categoryId/edit', async () => {
    const category = {
      id: '019a9c41-2b3d-7e10-8f2a-3c4d5e6f7a8b',
      name: 'Áo',
      slug: 'ao',
      status: 'VISIBLE',
      createdAt: '2026-11-22T02:10:00.000Z',
      updatedAt: '2026-11-22T02:10:00.000Z',
      version: 0,
    };
    const ids: string[] = [];
    server.use(
      http.get('*/admin/categories/:id', ({ params }) => {
        ids.push(String(params['id']));
        return HttpResponse.json(category);
      }),
    );
    renderAt(`/categories/${category.id}/edit`);

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Edit category' }),
    ).toBeInTheDocument();
    expect(await screen.findByRole('textbox', { name: /Category name/ })).toHaveValue('Áo');
    expect(ids).toEqual([category.id]);
  });

  it('still opens the About page', async () => {
    renderAt('/about');

    expect(await screen.findByRole('heading', { level: 1, name: 'About' })).toBeInTheDocument();
  });
});
