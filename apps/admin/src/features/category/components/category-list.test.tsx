import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';

import { CategoryList } from '@/features/category/components/category-list';
import { type AdminCategoryListItem } from '@/features/category/model/category';
import { clearAll, getSnapshot } from '@/lib/notifications/notification-store';
import { server } from '@/testing/msw/server';
import { renderWithProviders, screen, waitFor, within } from '@/testing/render';
import { stubDialog } from '@/testing/stub-dialog';
import { testI18n } from '@/testing/test-i18n';

// S1 of docs/specs/SHOP-81/design.md against a fake of GET /api/admin/categories, with
// the delete dialog S3 that Delete of a row opens.
stubDialog();

afterEach(() => {
  clearAll();
});

const shirts: AdminCategoryListItem = {
  id: '019a9c41-2b3d-7e10-8f2a-000000000001',
  name: 'Áo',
  slug: 'ao',
  status: 'VISIBLE',
  productCount: 3,
  createdAt: '2026-11-22T02:10:00.000Z',
  updatedAt: '2026-11-22T02:10:00.000Z',
  version: 0,
};

const accessories: AdminCategoryListItem = {
  ...shirts,
  id: '019a9c41-2b3d-7e10-8f2a-000000000002',
  name: 'Phụ kiện',
  slug: 'phu-kien',
  status: 'HIDDEN',
  productCount: 0,
};

/** Answers the list with `items`; the list after a DELETE drops the deleted ones. */
function fakeApi(items: AdminCategoryListItem[]) {
  let current = items;
  const calls = { list: 0 };
  server.use(
    http.get('*/admin/categories', () => {
      calls.list += 1;
      return HttpResponse.json({ items: current });
    }),
    http.delete('*/admin/categories/:id', ({ params }) => {
      current = current.filter((item) => item.id !== params['id']);
      return new HttpResponse(null, { status: 204 });
    }),
  );
  return calls;
}

function rowOf(name: string): HTMLElement {
  const cell = screen.getByText(name, { selector: '.table__name' });
  const row = cell.closest('tr');
  if (row === null) throw new Error(`no row for ${name}`);
  return row;
}

describe('CategoryList', () => {
  it('has the title of the page as its one h1, and Add category (S1.2, S1.3)', async () => {
    fakeApi([]);
    renderWithProviders(<CategoryList />);

    expect(screen.getByRole('heading', { level: 1, name: 'Categories' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Add category' })).toHaveAttribute(
      'href',
      '/categories/new',
    );
    await screen.findByText('No categories yet.');
  });

  it('shows six skeleton rows in a busy region while the list loads (S1.4)', () => {
    server.use(http.get('*/admin/categories', () => new Promise<Response>(() => undefined)));
    renderWithProviders(<CategoryList />);

    const region = screen.getByRole('region', { name: 'Category list' });
    expect(region).toHaveAttribute('aria-busy', 'true');
    expect(region.querySelectorAll('tbody tr')).toHaveLength(6);
    expect(within(region).getByText('Loading the categories')).toBeInTheDocument();
  });

  it('AC1 lists every category in the order of the api, with its slug, status and product count', async () => {
    fakeApi([shirts, accessories]);
    renderWithProviders(<CategoryList />);

    await screen.findByText('Áo', { selector: '.table__name' });

    const rows = screen.getAllByRole('row').slice(1);
    expect(
      rows.map((row) =>
        within(row)
          .getAllByRole('cell')
          .map((cell) => cell.textContent),
      ),
    ).toEqual([
      ['Áo', 'ao', 'Visible', '3', 'EditDelete'],
      ['Phụ kiện', 'phu-kien', 'Hidden', '0', 'EditDelete'],
    ]);
    expect(screen.getByRole('region', { name: 'Category list' })).toHaveAttribute(
      'aria-busy',
      'false',
    );
  });

  it('AC1 names the columns with scoped headers and a hidden caption', async () => {
    fakeApi([shirts]);
    renderWithProviders(<CategoryList />);
    await screen.findByText('Áo', { selector: '.table__name' });

    expect(
      screen
        .getAllByRole('columnheader')
        .map((header) => [header.textContent, header.getAttribute('scope')]),
    ).toEqual([
      ['Name', 'col'],
      ['URL slug', 'col'],
      ['Status', 'col'],
      ['Products', 'col'],
      ['Actions', 'col'],
    ]);
    expect(screen.getByRole('table', { name: 'Category list' })).toBeInTheDocument();
  });

  it('AC1 shows the labels in Vietnamese', async () => {
    await testI18n.changeLanguage('vi');
    fakeApi([shirts, accessories]);
    renderWithProviders(<CategoryList />);

    expect(await screen.findByText('Hiện')).toBeInTheDocument();
    expect(screen.getByText('Ẩn')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Số sản phẩm' })).toBeInTheDocument();
  });

  it('AC1 says "No categories yet." with the one Add category of the page (S1.9)', async () => {
    fakeApi([]);
    renderWithProviders(<CategoryList />);

    expect(await screen.findByRole('status')).toHaveTextContent('No categories yet.');
    expect(screen.getAllByRole('link', { name: 'Add category' })).toHaveLength(1);
  });

  it('links Edit of a row to the edit form of its category, named with it (S1.7)', async () => {
    fakeApi([shirts]);
    renderWithProviders(<CategoryList />);
    await screen.findByText('Áo', { selector: '.table__name' });

    expect(screen.getByRole('link', { name: 'Edit Áo' })).toHaveAttribute(
      'href',
      `/categories/${shirts.id}/edit`,
    );
    expect(screen.getByRole('button', { name: 'Delete Áo' })).toBeInTheDocument();
  });

  it('shows the error of S1.4 with Try again, which loads the list again', async () => {
    let fail = true;
    server.use(
      http.get('*/admin/categories', () =>
        fail
          ? HttpResponse.json({ status: 500 }, { status: 500 })
          : HttpResponse.json({ items: [shirts] }),
      ),
    );
    const { user } = renderWithProviders(<CategoryList />);

    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't load the categories.");
    fail = false;
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('Áo', { selector: '.table__name' })).toBeInTheDocument();
  });

  it('AC7 Delete of a row opens S3 for its category, and Cancel gives focus back to it', async () => {
    fakeApi([shirts, accessories]);
    const { user } = renderWithProviders(<CategoryList />);
    await screen.findByText('Phụ kiện', { selector: '.table__name' });
    const deleteButton = screen.getByRole('button', { name: 'Delete Phụ kiện' });

    await user.click(deleteButton);
    expect(screen.getByRole('alertdialog', { name: 'Delete “Phụ kiện”?' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(rowOf('Phụ kiện')).toBeInTheDocument();
    expect(deleteButton).toHaveFocus();
  });

  it('AC8 deletes a category from its dialog: the list reloads without it, focus on the table', async () => {
    const calls = fakeApi([shirts, accessories]);
    const { user } = renderWithProviders(<CategoryList />);
    await screen.findByText('Áo', { selector: '.table__name' });

    await user.click(screen.getByRole('button', { name: 'Delete Áo' }));
    expect(
      screen.getByText('3 products in this category will become No category.'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(screen.queryByText('Áo', { selector: '.table__name' })).not.toBeInTheDocument();
    });
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(rowOf('Phụ kiện')).toBeInTheDocument();
    expect(calls.list).toBe(2);
    expect(screen.getByRole('region', { name: 'Category list' })).toHaveFocus();
    expect(getSnapshot().map(({ message }) => message)).toEqual(['Category deleted']);
  });

  it('NFR10 shows a name with markup as text in the table and the labels of its buttons', async () => {
    const name = '</script><script>alert(1)</script>';
    fakeApi([{ ...shirts, name }]);
    renderWithProviders(<CategoryList />);

    expect(await screen.findByText(name, { selector: '.table__name' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: `Delete ${name}` })).toBeInTheDocument();
    expect(document.querySelector('table script')).toBeNull();
  });
});
