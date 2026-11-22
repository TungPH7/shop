import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { CategoryEdit } from '@/features/category/components/category-edit';
import { type AdminCategory } from '@/features/category/model/category';
import { server } from '@/testing/msw/server';
import { renderWithProviders, screen, waitFor } from '@/testing/render';

// S2 of docs/specs/SHOP-81/design.md in edit mode against a fake of
// GET and PUT /api/admin/categories/{id}: the states of S2.3, then the form.

const shirts: AdminCategory = {
  id: '019a9c41-2b3d-7e10-8f2a-000000000001',
  name: 'Áo',
  slug: 'ao',
  status: 'HIDDEN',
  createdAt: '2026-11-22T02:10:00.000Z',
  updatedAt: '2026-11-22T02:10:00.000Z',
  version: 1,
};

function problem(status: number, code: string) {
  return HttpResponse.json({ status, code, title: 'Problem', detail: '…' }, { status });
}

function renderEdit() {
  return renderWithProviders(<CategoryEdit categoryId={shirts.id} />, {
    route: `/categories/${shirts.id}/edit`,
  });
}

describe('CategoryEdit', () => {
  it('shows the skeleton in a busy region while the category loads (S2.3)', () => {
    server.use(http.get('*/admin/categories/:id', () => new Promise<Response>(() => undefined)));
    renderEdit();

    expect(screen.getByRole('region', { name: 'Loading the category' })).toHaveAttribute(
      'aria-busy',
      'true',
    );
  });

  it('AC6 opens the form with the saved category, a hidden one too', async () => {
    server.use(http.get('*/admin/categories/:id', () => HttpResponse.json(shirts)));
    renderEdit();

    expect(await screen.findByRole('textbox', { name: /Category name/ })).toHaveValue('Áo');
    expect(screen.getByRole('radio', { name: 'Hidden' })).toBeChecked();
  });

  it.each([
    ['a 404', () => problem(404, 'CATEGORY_NOT_FOUND')],
    ['a 400 of an id that is no UUID', () => problem(400, 'INVALID_PARAMETER')],
  ])(
    'shows the not-found state for %s, with the link back to the list (S2.3)',
    async (_case, answer) => {
      server.use(http.get('*/admin/categories/:id', answer));
      renderEdit();

      expect(await screen.findByRole('status')).toHaveTextContent(
        "We couldn't find this category. It may have been deleted.",
      );
      expect(screen.getByRole('link', { name: 'Back to categories' })).toHaveAttribute(
        'href',
        '/categories',
      );
    },
  );

  it('shows the load-failed state for a 5xx, and Try again loads it again (S2.3)', async () => {
    let fail = true;
    server.use(
      http.get('*/admin/categories/:id', () =>
        fail
          ? HttpResponse.json({ status: 503 }, { status: 503, headers: { 'Retry-After': '0' } })
          : HttpResponse.json(shirts),
      ),
    );
    const { user } = renderEdit();

    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't load the category.");
    fail = false;
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByRole('textbox', { name: /Category name/ })).toHaveValue('Áo');
  });

  it('shows the not-found state when a save answers 404: deleted in another tab (S2.4)', async () => {
    server.use(
      http.get('*/admin/categories/:id', () => HttpResponse.json(shirts)),
      http.put('*/admin/categories/:id', () => problem(404, 'CATEGORY_NOT_FOUND')),
    );
    const { user } = renderEdit();

    await user.click(await screen.findByRole('button', { name: 'Save changes' }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      "We couldn't find this category. It may have been deleted.",
    );
  });

  it('loads the latest version on Reload of the conflict banner, and sends it next (S2.4)', async () => {
    let version = 1;
    const sent: unknown[] = [];
    server.use(
      http.get('*/admin/categories/:id', () => HttpResponse.json({ ...shirts, version })),
      http.put('*/admin/categories/:id', async ({ request }) => {
        const body = (await request.json()) as { version: number };
        sent.push(body.version);
        return body.version === version
          ? HttpResponse.json({ ...shirts, version: version + 1 })
          : problem(409, 'OPTIMISTIC_LOCK_CONFLICT');
      }),
    );
    const { user } = renderEdit();
    await screen.findByRole('textbox', { name: /Category name/ });
    version = 2;

    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await user.click(await screen.findByRole('button', { name: 'Reload' }));
    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
    await user.click(await screen.findByRole('button', { name: 'Save changes' }));

    await waitFor(() => {
      expect(sent).toEqual([1, 2]);
    });
  });
});
