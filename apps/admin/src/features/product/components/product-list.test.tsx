import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';

import { ProductList } from '@/features/product/components/product-list';
import { type AdminProductSummary } from '@/features/product/model/product';
import { server } from '@/testing/msw/server';
import { renderWithProviders, screen, waitFor, within } from '@/testing/render';
import { testI18n } from '@/testing/test-i18n';

// S1 of docs/specs/SHOP-7/design.md against a fake of GET /api/admin/products: it
// filters like the API (keyword, upper-case status) and pages by offset and limit.

const NBSP = String.fromCodePoint(0xa0);

function product(overrides: Partial<AdminProductSummary> & { name: string }): AdminProductSummary {
  return {
    id: '019a8f2e-5b7c-7d10-9e3f-1a2b3c4d5e6f',
    slug: 'ao-thun-co-tron',
    price: 200000,
    status: 'ACTIVE',
    availability: 'IN_STOCK',
    createdAt: '2026-11-16T02:10:00.000Z',
    updatedAt: '2026-11-16T02:10:00.000Z',
    ...overrides,
  };
}

const shirt = product({
  id: '019a8f2e-5b7c-7d10-9e3f-000000000001',
  name: 'Áo thun cổ tròn',
  slug: 'ao-thun-co-tron',
  price: 1250000,
});
const jeans = product({
  id: '019a8f2e-5b7c-7d10-9e3f-000000000002',
  name: 'Quần jean nam',
  slug: 'quan-jean-nam',
  price: 450000,
  status: 'HIDDEN',
  availability: 'OUT_OF_STOCK',
});

function many(count: number): AdminProductSummary[] {
  return Array.from({ length: count }, (_, index) =>
    product({
      id: `019a8f2e-5b7c-7d10-9e3f-${String(index + 1).padStart(12, '0')}`,
      name: `Sản phẩm ${index + 1}`,
      slug: `san-pham-${index + 1}`,
    }),
  );
}

// Like app.search_fold of the API: no accents, đ as d, lower case.
function fold(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').replace(/[đĐ]/g, 'd').toLowerCase();
}

// The words of `q` each start a word of the name, ignoring case and accents.
function matches(name: string, q: string): boolean {
  const words = fold(name).split(/\s+/);
  return fold(q)
    .split(/\s+/)
    .filter(Boolean)
    .every((term) => words.some((word) => word.startsWith(term)));
}

function fakeApi(products: AdminProductSummary[]) {
  const requests: URLSearchParams[] = [];
  server.use(
    http.get('*/admin/products', ({ request }) => {
      const params = new URL(request.url).searchParams;
      requests.push(params);
      const q = params.get('q') ?? '';
      const status = params.get('status') ?? 'ALL';
      const offset = Number(params.get('offset'));
      const limit = Number(params.get('limit'));
      const found = products.filter(
        (item) => (status === 'ALL' || item.status === status) && matches(item.name, q),
      );
      return HttpResponse.json({
        items: found.slice(offset, offset + limit),
        totalItems: found.length,
        offset,
        limit,
      });
    }),
  );
  return requests;
}

// Holds every next request in front of the fake until `release`, so a test can look
// at the list while it loads. The handler returns nothing: MSW then hands the
// request on to the fake.
function holdRequests() {
  let release: (() => void) | undefined;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  server.use(
    http.get('*/admin/products', async () => {
      await held;
    }),
  );
  return { release: () => release?.() };
}

// The text of a cell, exactly: the price has a no-break space, which the text
// matchers of Testing Library do not find.
function cellText(row: HTMLElement, column: number) {
  return within(row).getAllByRole('cell')[column]?.textContent;
}

function rows() {
  // The first row group is the header.
  const body = screen.getAllByRole('rowgroup').at(1);
  if (body === undefined) throw new Error('The table has no body');
  return within(body).queryAllByRole('row');
}

describe('ProductList', () => {
  it('shows the page title S1.2 as the single h1', () => {
    fakeApi([]);
    renderWithProviders(<ProductList />, { route: '/products' });

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1, name: 'Products' })).toBeInTheDocument();
  });

  it('links Add product to the add page S2 (S1.3)', () => {
    fakeApi([]);
    renderWithProviders(<ProductList />, { route: '/products' });

    expect(screen.getByRole('link', { name: 'Add product' })).toHaveAttribute(
      'href',
      '/products/new',
    );
  });

  it('shows six skeleton rows in a busy table while the list loads', () => {
    fakeApi([shirt]);
    renderWithProviders(<ProductList />, { route: '/products' });

    expect(screen.getByRole('region', { name: 'Product list' })).toHaveAttribute(
      'aria-busy',
      'true',
    );
    expect(rows()).toHaveLength(6);
  });

  it('names the skeleton for a screen reader, once', () => {
    fakeApi([shirt]);
    renderWithProviders(<ProductList />, { route: '/products' });

    expect(screen.getByText('Loading the products')).toHaveClass('visually-hidden');
  });

  it('AC1 lists active and hidden products with tile, name, slug, price, status and availability', async () => {
    fakeApi([shirt, jeans]);
    renderWithProviders(<ProductList />, { route: '/products' });

    const shirtRow = await screen.findByRole('row', { name: /Áo thun cổ tròn/ });
    expect(within(shirtRow).getByText('ao-thun-co-tron')).toBeInTheDocument();
    expect(cellText(shirtRow, 1)).toBe(`1.250.000${NBSP}₫`);
    expect(within(shirtRow).getByText('Active')).toBeInTheDocument();
    expect(within(shirtRow).getByText('In stock')).toBeInTheDocument();
    expect(shirtRow.querySelector('.tile')).toHaveTextContent('Á');

    const jeansRow = screen.getByRole('row', { name: /Quần jean nam/ });
    expect(within(jeansRow).getByText('Hidden')).toBeInTheDocument();
    expect(within(jeansRow).getByText('Out of stock')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Product list' })).toHaveAttribute(
      'aria-busy',
      'false',
    );
  });

  it('keeps the order of the API, newest first', async () => {
    fakeApi([shirt, jeans]);
    renderWithProviders(<ProductList />, { route: '/products' });

    await screen.findByText('Áo thun cổ tròn');
    expect(rows().map((row) => within(row).getAllByRole('cell')[0]?.textContent)).toEqual([
      'ÁÁo thun cổ trònao-thun-co-tron',
      'QQuần jean namquan-jean-nam',
    ]);
  });

  it('links Edit of a row to the edit page of its product, named after it (S1.7)', async () => {
    fakeApi([shirt]);
    renderWithProviders(<ProductList />, { route: '/products' });

    expect(await screen.findByRole('link', { name: 'Edit Áo thun cổ tròn' })).toHaveAttribute(
      'href',
      `/products/${shirt.id}/edit`,
    );
  });

  it('labels the table with a hidden caption and column headers', async () => {
    fakeApi([shirt]);
    renderWithProviders(<ProductList />, { route: '/products' });

    const table = await screen.findByRole('table', { name: 'Product list' });
    expect(
      within(table)
        .getAllByRole('columnheader')
        .map((header) => header.textContent),
    ).toEqual(['Product', 'Price', 'Status', 'Availability', 'Actions']);
  });

  it('counts the products that match, not those of the page (S1.4)', async () => {
    fakeApi(many(25));
    renderWithProviders(<ProductList />, { route: '/products' });

    expect(await screen.findByText('25 products')).toHaveAttribute('role', 'status');
  });

  it('counts one product in the singular', async () => {
    fakeApi([shirt]);
    renderWithProviders(<ProductList />, { route: '/products' });

    expect(await screen.findByText('1 product')).toHaveAttribute('role', 'status');
  });

  it('AC2 keeps only the products whose name matches the keyword, 300 ms after typing', async () => {
    const requests = fakeApi([shirt, jeans]);
    const { user } = renderWithProviders(<ProductList />, { route: '/products' });
    await screen.findByText('Quần jean nam');

    await user.type(screen.getByRole('searchbox', { name: 'Search by name' }), 'AO THUN');

    await waitFor(() => {
      expect(screen.queryByText('Quần jean nam')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Áo thun cổ tròn')).toBeInTheDocument();
    // One request for the page, one for the whole keyword: none for each letter.
    expect(requests.map((params) => params.get('q'))).toEqual([null, 'AO THUN']);
  });

  it('AC2 shows "No matching products" and Clear filters when nothing matches', async () => {
    fakeApi([shirt, jeans]);
    const { user } = renderWithProviders(<ProductList />, { route: '/products?q=xyz' });

    expect(await screen.findByText('No matching products')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));

    expect(await screen.findByText('Quần jean nam')).toBeInTheDocument();
    const search = screen.getByRole('searchbox', { name: 'Search by name' });
    expect(search).toHaveValue('');
    expect(search).toHaveFocus();
  });

  it('shows "No matching products" and Clear filters when no product has the status (S1.10)', async () => {
    fakeApi([shirt]);
    const { user } = renderWithProviders(<ProductList />, { route: '/products?status=hidden' });

    expect(await screen.findByText('No matching products')).toBeInTheDocument();
    expect(screen.queryByText('No products yet.')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));

    expect(await screen.findByText('Áo thun cổ tròn')).toBeInTheDocument();
  });

  it('shows the skeleton, not "No products yet.", while Clear filters loads after a keyword with no match', async () => {
    fakeApi([shirt, jeans]);
    const { user } = renderWithProviders(<ProductList />, { route: '/products?q=xyz' });
    await screen.findByText('No matching products');
    const { release } = holdRequests();

    await user.click(screen.getByRole('button', { name: 'Clear filters' }));

    expect(screen.getByRole('region', { name: 'Product list' })).toHaveAttribute(
      'aria-busy',
      'true',
    );
    expect(screen.queryByText('No products yet.')).not.toBeInTheDocument();
    expect(screen.queryByText('No matching products')).not.toBeInTheDocument();
    expect(rows()).toHaveLength(6);

    release();
    expect(await screen.findByText('Quần jean nam')).toBeInTheDocument();
  });

  it('shows the skeleton, not "No products yet.", while All loads after a status with no product', async () => {
    fakeApi([shirt]);
    const { user } = renderWithProviders(<ProductList />, { route: '/products?status=hidden' });
    await screen.findByText('No matching products');
    const { release } = holdRequests();
    const filter = screen.getByRole('group', { name: 'Filter by status' });

    await user.click(within(filter).getByRole('button', { name: 'All' }));

    expect(screen.queryByText('No products yet.')).not.toBeInTheDocument();
    expect(rows()).toHaveLength(6);

    release();
    expect(await screen.findByText('Áo thun cổ tròn')).toBeInTheDocument();
  });

  it('keeps the rows of the last page on screen while the next filter loads (NFR6)', async () => {
    fakeApi([shirt, jeans]);
    const { user } = renderWithProviders(<ProductList />, { route: '/products' });
    await screen.findByText('Áo thun cổ tròn');
    const { release } = holdRequests();
    const filter = screen.getByRole('group', { name: 'Filter by status' });

    await user.click(within(filter).getByRole('button', { name: 'Hidden' }));

    expect(screen.getByText('Áo thun cổ tròn')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Product list' })).toHaveAttribute(
      'aria-busy',
      'true',
    );

    release();
    await waitFor(() => {
      expect(screen.queryByText('Áo thun cổ tròn')).not.toBeInTheDocument();
    });
  });

  it('starts the search box from the keyword of the URL', async () => {
    fakeApi([shirt]);
    renderWithProviders(<ProductList />, { route: '/products?q=ao' });

    expect(screen.getByRole('searchbox', { name: 'Search by name' })).toHaveValue('ao');
    expect(await screen.findByText('Áo thun cổ tròn')).toBeInTheDocument();
  });

  it('shows "No products yet." with Add product when there is no product at all (S1.9)', async () => {
    fakeApi([]);
    renderWithProviders(<ProductList />, { route: '/products' });

    expect(await screen.findByText('No products yet.')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Add product' })).toHaveLength(2);
    expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument();
  });

  it('AC3 shows only hidden products under Hidden, and both under All', async () => {
    const requests = fakeApi([shirt, jeans]);
    const { user } = renderWithProviders(<ProductList />, { route: '/products' });
    await screen.findByText('Áo thun cổ tròn');
    const filter = screen.getByRole('group', { name: 'Filter by status' });

    await user.click(within(filter).getByRole('button', { name: 'Hidden' }));

    await waitFor(() => {
      expect(screen.queryByText('Áo thun cổ tròn')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Quần jean nam')).toBeInTheDocument();
    expect(within(filter).getByRole('button', { name: 'Hidden' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await user.click(within(filter).getByRole('button', { name: 'All' }));

    expect(await screen.findByText('Áo thun cổ tròn')).toBeInTheDocument();
    expect(screen.getByText('Quần jean nam')).toBeInTheDocument();
    expect(requests.map((params) => params.get('status'))).toEqual(['ALL', 'HIDDEN', 'ALL']);
  });

  it('AC4 shows 20 products on page 1 and links the next page with the same filters', async () => {
    fakeApi(many(25));
    renderWithProviders(<ProductList />, { route: '/products?status=active' });

    expect(await screen.findByText('Showing 1–20 of 25')).toBeInTheDocument();
    expect(rows()).toHaveLength(20);
    expect(screen.getByRole('link', { name: 'Page 2' })).toHaveAttribute(
      'href',
      '/products?status=active&page=2',
    );
  });

  it('AC4 shows the last 5 products on page 2 of the URL', async () => {
    const requests = fakeApi(many(25));
    renderWithProviders(<ProductList />, { route: '/products?page=2' });

    expect(await screen.findByText('Showing 21–25 of 25')).toBeInTheDocument();
    expect(rows()).toHaveLength(5);
    expect(screen.getByText('Sản phẩm 21')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Page 2' })).toHaveAttribute('aria-current', 'page');
    expect(requests[0]?.get('offset')).toBe('20');
  });

  it('shows page 1 for a page past the last one (S1.11)', async () => {
    fakeApi(many(25));
    renderWithProviders(<ProductList />, { route: '/products?page=7' });

    expect(await screen.findByText('Showing 1–20 of 25')).toBeInTheDocument();
    expect(screen.getByText('Sản phẩm 1')).toBeInTheDocument();
  });

  it('hides the pagination when every product fits on one page', async () => {
    fakeApi(many(20));
    renderWithProviders(<ProductList />, { route: '/products' });

    await screen.findByText('Sản phẩm 20');
    expect(screen.queryByRole('navigation', { name: 'Pagination' })).not.toBeInTheDocument();
  });

  it('shows an error with Try again when the list cannot load, and loads it again', async () => {
    fakeApi([shirt]);
    // In front of the fake, for the first request only.
    server.use(
      http.get('*/admin/products', () => HttpResponse.json({ status: 400 }, { status: 400 }), {
        once: true,
      }),
    );
    const { user } = renderWithProviders(<ProductList />, { route: '/products' });

    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't load the products.");
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('Áo thun cổ tròn')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('speaks Vietnamese, with the same price format', async () => {
    await testI18n.changeLanguage('vi');
    fakeApi([shirt, jeans]);
    renderWithProviders(<ProductList />, { route: '/products' });

    expect(screen.getByRole('heading', { level: 1, name: 'Sản phẩm' })).toBeInTheDocument();
    const shirtRow = await screen.findByRole('row', { name: /Áo thun cổ tròn/ });
    expect(cellText(shirtRow, 1)).toBe(`1.250.000${NBSP}₫`);
    expect(within(shirtRow).getByText('Đang bán')).toBeInTheDocument();
    expect(within(shirtRow).getByText('Còn hàng')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('2 sản phẩm');
    expect(screen.getByRole('link', { name: 'Sửa Áo thun cổ tròn' })).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: 'Tìm theo tên' })).toHaveAttribute(
      'placeholder',
      'Tìm theo tên sản phẩm…',
    );
  });
});
