import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { Route, Routes } from 'react-router';

import { ProductEdit } from '@/features/product/components/product-edit';
import { ProductForm } from '@/features/product/components/product-form';
import { type AdminProduct, type CategoryOption } from '@/features/product/model/product';
import { server } from '@/testing/msw/server';
import { renderWithProviders, screen, waitFor, within } from '@/testing/render';
import { testI18n } from '@/testing/test-i18n';

// S4 of docs/specs/SHOP-81/design.md: the Category field of the product form, against
// fakes of GET /api/admin/categories and of POST, GET and PUT /api/admin/products.

const shirts: CategoryOption = {
  id: '019a9c41-2b3d-7e10-8f2a-000000000001',
  name: 'Áo',
  status: 'VISIBLE',
};
const accessories: CategoryOption = {
  id: '019a9c41-2b3d-7e10-8f2a-000000000002',
  name: 'Phụ kiện',
  status: 'HIDDEN',
};

const tee: AdminProduct = {
  id: '019a8f2e-5b7c-7d10-9e3f-1a2b3c4d5e6f',
  name: 'Áo thun cổ tròn',
  slug: 'ao-thun-co-tron',
  description: null,
  price: 200000,
  compareAtPrice: null,
  status: 'ACTIVE',
  availability: 'IN_STOCK',
  categoryId: shirts.id,
  createdAt: '2026-11-22T02:10:00.000Z',
  updatedAt: '2026-11-22T02:10:00.000Z',
  version: 2,
};

/** Answers the options with each list of `lists` in turn, the last one again after. */
function fakeOptions(...lists: (CategoryOption[] | (() => Response | Promise<Response>))[]) {
  let calls = 0;
  server.use(
    http.get('*/admin/categories', () => {
      const answer = lists[Math.min(calls, lists.length - 1)] ?? [];
      calls += 1;
      return typeof answer === 'function' ? answer() : HttpResponse.json({ items: answer });
    }),
  );
  return { calls: () => calls };
}

function fakeProductApi(respond?: () => Response) {
  const bodies: Record<string, unknown>[] = [];
  const record = async (request: Request, status: number) => {
    const body = (await request.json()) as Record<string, unknown>;
    bodies.push(body);
    return respond ? respond() : HttpResponse.json({ ...tee, ...body }, { status });
  };
  server.use(
    http.get('*/admin/products/:id', () => HttpResponse.json(tee)),
    http.post('*/admin/products', ({ request }) => record(request, 201)),
    http.put('*/admin/products/:id', ({ request }) => record(request, 200)),
  );
  return bodies;
}

function renderAdd() {
  return renderWithProviders(
    <Routes>
      <Route path="/products/new" element={<ProductForm />} />
      <Route path="/products" element={<p>The product list</p>} />
    </Routes>,
    { route: '/products/new' },
  );
}

function renderEdit() {
  return renderWithProviders(
    <Routes>
      <Route path="/products/:productId/edit" element={<ProductEdit productId={tee.id} />} />
      <Route path="/products" element={<p>The product list</p>} />
    </Routes>,
    { route: `/products/${tee.id}/edit` },
  );
}

const category = () => screen.getByRole('combobox', { name: 'Category' });

function optionTexts(select: HTMLElement): (string | null)[] {
  return within(select)
    .getAllByRole('option')
    .map((option) => option.textContent);
}

async function ready() {
  await waitFor(() => {
    expect(category()).toBeEnabled();
  });
}

describe('the Category field of the product form (S4)', () => {
  it('AC9 starts at No category, then lists every category in the order of the api, Hidden in its text', async () => {
    await testI18n.changeLanguage('vi');
    fakeOptions([shirts, accessories]);
    renderWithProviders(
      <Routes>
        <Route path="/products/new" element={<ProductForm />} />
      </Routes>,
      { route: '/products/new' },
    );
    const select = screen.getByRole('combobox', { name: 'Danh mục' });
    await waitFor(() => {
      expect(select).toBeEnabled();
    });

    expect(select).toHaveValue('');
    expect(optionTexts(select)).toEqual(['Không có danh mục', 'Áo', 'Phụ kiện (Ẩn)']);
    expect(select).toHaveAccessibleDescription(
      'Chọn được cả danh mục Ẩn, để chuẩn bị sản phẩm trước khi cho hiện danh mục.',
    );
  });

  it('sits between the slug and the description', async () => {
    fakeOptions([shirts]);
    renderAdd();
    await ready();

    const labels = [...document.querySelectorAll('form label.label')].map(
      (label) => label.textContent,
    );
    expect(labels.slice(0, 4)).toEqual([
      'Product name*',
      'URL slug',
      'Category',
      'Description (optional)',
    ]);
  });

  it('is locked with "Loading categories…" while the options load, and so is Save (S4.2)', async () => {
    fakeOptions(() => new Promise<Response>(() => undefined));
    const bodies = fakeProductApi();
    const { user } = renderAdd();

    expect(category()).toBeDisabled();
    expect(category()).toHaveAttribute('aria-busy', 'true');
    expect(optionTexts(category())).toEqual(['Loading categories…']);
    const save = screen.getByRole('button', { name: 'Add product' });
    expect(save).toHaveAttribute('aria-disabled', 'true');
    await user.type(screen.getByRole('textbox', { name: /Product name/ }), 'Áo');
    await user.type(screen.getByRole('textbox', { name: /^Price/ }), '200000');
    await user.click(save);

    expect(bodies).toEqual([]);
  });

  it('shows the error of S4.2 with Try again when the options fail, Save locked, and loads them again', async () => {
    let fail = true;
    // Retry-After 0: the api layer retries a failed GET at once, and fails again.
    const options = fakeOptions(() =>
      fail
        ? HttpResponse.json({ status: 500 }, { status: 500, headers: { 'Retry-After': '0' } })
        : HttpResponse.json({ items: [shirts] }),
    );
    const { user } = renderAdd();

    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't load the categories.");
    expect(category()).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Add product' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    const failedCalls = options.calls();
    fail = false;
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    await ready();
    expect(optionTexts(category())).toEqual(['No category', 'Áo']);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(options.calls()).toBe(failedCalls + 1);
  });

  it('loads the options again when the admin opens the field, so a category added in another tab shows', async () => {
    const options = fakeOptions([shirts], [shirts, accessories]);
    const { user } = renderAdd();
    await ready();
    expect(optionTexts(category())).toEqual(['No category', 'Áo']);

    await user.click(category());

    await waitFor(() => {
      expect(optionTexts(category())).toEqual(['No category', 'Áo', 'Phụ kiện (Hidden)']);
    });
    expect(options.calls()).toBe(2);
  });

  it('loads the options again when the field gets the focus from the keyboard', async () => {
    const options = fakeOptions([shirts], [shirts, accessories]);
    const { user } = renderAdd();
    await ready();
    screen.getByRole('textbox', { name: 'URL slug' }).focus();

    await user.tab();

    expect(category()).toHaveFocus();
    await waitFor(() => {
      expect(optionTexts(category())).toEqual(['No category', 'Áo', 'Phụ kiện (Hidden)']);
    });
    expect(options.calls()).toBe(2);
  });

  it('keeps the field open on the options it has, and Save free, while they load again', async () => {
    fakeOptions([shirts], () => new Promise<Response>(() => undefined));
    const { user } = renderAdd();
    await ready();

    await user.click(category());

    expect(category()).toBeEnabled();
    expect(category()).not.toHaveAttribute('aria-busy');
    expect(optionTexts(category())).toEqual(['No category', 'Áo']);
    expect(screen.getByRole('button', { name: 'Add product' })).not.toHaveAttribute(
      'aria-disabled',
    );
  });

  it('keeps the category picked when the options load again', async () => {
    fakeOptions([shirts, accessories]);
    const { user } = renderAdd();
    await ready();
    await user.selectOptions(category(), 'Áo');

    await user.click(category());

    await waitFor(() => {
      expect(category()).toHaveValue(shirts.id);
    });
  });

  it('AC9 posts the category picked', async () => {
    fakeOptions([shirts, accessories]);
    const bodies = fakeProductApi();
    const { user } = renderAdd();
    await ready();

    await user.type(screen.getByRole('textbox', { name: /Product name/ }), 'Áo thun cổ tròn');
    await user.type(screen.getByRole('textbox', { name: /^Price/ }), '200000');
    await user.selectOptions(category(), 'Áo');
    await user.click(screen.getByRole('button', { name: 'Add product' }));

    expect(await screen.findByText('The product list')).toBeInTheDocument();
    expect(bodies[0]).toMatchObject({ name: 'Áo thun cổ tròn', categoryId: shirts.id });
  });

  it('AC9 posts categoryId null for No category, always sent (NFR19)', async () => {
    fakeOptions([shirts]);
    const bodies = fakeProductApi();
    const { user } = renderAdd();
    await ready();

    await user.type(screen.getByRole('textbox', { name: /Product name/ }), 'Áo');
    await user.type(screen.getByRole('textbox', { name: /^Price/ }), '200000');
    await user.click(screen.getByRole('button', { name: 'Add product' }));

    await screen.findByText('The product list');
    expect(bodies[0]).toHaveProperty('categoryId', null);
  });

  it('AC9 opens the edit form at the saved category, and puts null once No category is picked', async () => {
    fakeOptions([shirts, accessories]);
    const bodies = fakeProductApi();
    const { user } = renderEdit();
    await screen.findByRole('heading', { level: 1, name: 'Edit product' });
    await ready();

    expect(category()).toHaveValue(shirts.id);
    await user.selectOptions(category(), 'No category');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await screen.findByText('The product list');
    expect(bodies).toEqual([expect.objectContaining({ categoryId: null, version: 2 })]);
  });

  it('AC10 keeps everything and shows the error under the field for a 400 on categoryId, then reloads the options at No category', async () => {
    // Phụ kiện is deleted in another tab once it is picked: the save is the first to know.
    let categories = [shirts, accessories];
    const options = fakeOptions(() => HttpResponse.json({ items: categories }));
    const bodies = fakeProductApi(() =>
      HttpResponse.json(
        {
          status: 400,
          code: 'VALIDATION_FAILED',
          errors: [
            {
              field: 'categoryId',
              rejectedValue: accessories.id,
              message: 'must be an existing category',
            },
          ],
        },
        { status: 400 },
      ),
    );
    const { user } = renderEdit();
    await screen.findByRole('heading', { level: 1, name: 'Edit product' });
    await ready();
    const name = screen.getByRole('textbox', { name: /Product name/ });
    await user.clear(name);
    await user.type(name, 'Áo thun mới');
    await user.selectOptions(category(), 'Phụ kiện (Hidden)');
    categories = [shirts];
    const callsBeforeSave = options.calls();

    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(
      await screen.findByText('This category no longer exists. Pick another one.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('The product list')).not.toBeInTheDocument();
    expect(bodies).toHaveLength(1);
    expect(name).toHaveValue('Áo thun mới');
    await waitFor(() => {
      expect(optionTexts(category())).toEqual(['No category', 'Áo']);
    });
    expect(category()).toHaveValue('');
    expect(category()).toHaveAttribute('aria-invalid', 'true');
    expect(category()).toHaveFocus();
    expect(options.calls()).toBeGreaterThan(callsBeforeSave);
  });

  it('AC10 keeps the error until the admin picks again', async () => {
    let categories = [shirts, accessories];
    fakeOptions(() => HttpResponse.json({ items: categories }));
    fakeProductApi(() =>
      HttpResponse.json(
        { status: 400, code: 'VALIDATION_FAILED', errors: [{ field: 'categoryId' }] },
        { status: 400 },
      ),
    );
    const { user } = renderEdit();
    await screen.findByRole('heading', { level: 1, name: 'Edit product' });
    await ready();
    await user.selectOptions(category(), 'Phụ kiện (Hidden)');
    categories = [shirts];
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    await screen.findByText('This category no longer exists. Pick another one.');

    await user.selectOptions(category(), 'Áo');

    expect(
      screen.queryByText('This category no longer exists. Pick another one.'),
    ).not.toBeInTheDocument();
    expect(category()).not.toHaveAttribute('aria-invalid');
  });

  it('NFR10 shows a category name with markup as the text of its option', async () => {
    const name = '</script><script>alert(1)</script>';
    fakeOptions([{ ...shirts, name }]);
    renderAdd();
    await ready();

    expect(screen.getByRole('option', { name })).toBeInTheDocument();
    expect(document.querySelector('select script')).toBeNull();
  });
});
