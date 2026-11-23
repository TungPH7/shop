import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Route, Routes } from 'react-router';

import { CategoryForm } from '@/features/category/components/category-form';
import { type AdminCategory } from '@/features/category/model/category';
import { clearAll, getSnapshot } from '@/lib/notifications/notification-store';
import { server } from '@/testing/msw/server';
import { renderWithProviders, screen, waitFor } from '@/testing/render';
import { testI18n } from '@/testing/test-i18n';

// S2 of docs/specs/SHOP-81/design.md, in add and edit mode, against fakes of
// POST /api/admin/categories and PUT /api/admin/categories/{id}.

afterEach(() => {
  clearAll();
});

const saved: AdminCategory = {
  id: '019a9c41-2b3d-7e10-8f2a-000000000001',
  name: 'Áo',
  slug: 'ao',
  status: 'VISIBLE',
  displayOrder: 2,
  createdAt: '2026-11-22T02:10:00.000Z',
  updatedAt: '2026-11-22T02:10:00.000Z',
  version: 3,
};

function problem(status: number, code: string, extra: Record<string, unknown> = {}) {
  return HttpResponse.json({ status, code, title: 'Problem', detail: '…', ...extra }, { status });
}

/** Records each body of `method`, answered by `respond`, or by a 2xx. */
function fakeSave(method: 'post' | 'put', respond?: () => Response | Promise<Response>) {
  const bodies: unknown[] = [];
  const path = method === 'post' ? '*/admin/categories' : '*/admin/categories/:id';
  server.use(
    http[method](path, async ({ request }) => {
      bodies.push(await request.json());
      return respond
        ? respond()
        : HttpResponse.json(saved, { status: method === 'post' ? 201 : 200 });
    }),
  );
  return bodies;
}

function renderAdd() {
  return renderWithProviders(
    <Routes>
      <Route path="/categories/new" element={<CategoryForm />} />
      <Route path="/categories" element={<p>The category list</p>} />
    </Routes>,
    { route: '/categories/new' },
  );
}

function renderEdit(category: AdminCategory = saved) {
  const onMissing = vi.fn();
  const onReload = vi.fn();
  const rendered = renderWithProviders(
    <Routes>
      <Route
        path="/categories/:id/edit"
        element={<CategoryForm category={category} onMissing={onMissing} onReload={onReload} />}
      />
      <Route path="/categories" element={<p>The category list</p>} />
    </Routes>,
    { route: `/categories/${category.id}/edit` },
  );
  return { ...rendered, onMissing, onReload };
}

const field = {
  name: () => screen.getByRole('textbox', { name: /Category name/ }),
  slug: () => screen.getByRole('textbox', { name: 'URL slug' }),
  hidden: () => screen.getByRole('radio', { name: 'Hidden' }),
  visible: () => screen.getByRole('radio', { name: 'Visible' }),
};

describe('CategoryForm in add mode', () => {
  it('has the title, the subtitle and the back link of S2.2 and S2.3', () => {
    renderAdd();

    expect(screen.getByRole('heading', { level: 1, name: 'Add category' })).toBeInTheDocument();
    expect(screen.getByText('Customers only see categories that are Visible.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Categories/ })).toHaveAttribute('href', '/categories');
  });

  it('starts Visible, with the hint of a generated slug (S2.6, S2.7)', () => {
    renderAdd();

    expect(field.visible()).toBeChecked();
    expect(field.slug()).toHaveAccessibleDescription(
      'Generated from the name. If taken, -2, -3… is added.',
    );
  });

  it('AC2 fills the slug from the name, and counts the name trimmed', async () => {
    const { user } = renderAdd();

    await user.type(field.name(), ' Áo khoác nữ ');

    expect(field.slug()).toHaveValue('ao-khoac-nu');
    expect(screen.getByText('11/60')).toBeInTheDocument();
  });

  it('AC2 sends slug null when the slug was not typed, goes back to the list and says "Category added"', async () => {
    const bodies = fakeSave('post');
    const { user } = renderAdd();

    await user.type(field.name(), 'Áo khoác nữ');
    await user.click(screen.getByRole('button', { name: 'Add category' }));

    expect(await screen.findByText('The category list')).toBeInTheDocument();
    expect(bodies).toEqual([
      { name: 'Áo khoác nữ', slug: null, status: 'VISIBLE', displayOrder: 0 },
    ]);
    expect(getSnapshot().map(({ kind, message }) => ({ kind, message }))).toEqual([
      { kind: 'success', message: 'Category added' },
    ]);
  });

  it('stops following the name once the slug is typed, and sends the typed slug', async () => {
    const bodies = fakeSave('post');
    const { user } = renderAdd();

    await user.type(field.name(), 'Áo');
    await user.clear(field.slug());
    await user.type(field.slug(), 'ao-nam');
    await user.type(field.name(), ' khoác');
    await user.click(field.hidden());
    await user.click(screen.getByRole('button', { name: 'Add category' }));

    await screen.findByText('The category list');
    expect(bodies).toEqual([
      { name: 'Áo khoác', slug: 'ao-nam', status: 'HIDDEN', displayOrder: 0 },
    ]);
  });

  it.each([
    ['an empty name', '', 'Enter a category name'],
    ['a name of white space only', '   ', 'Enter a category name'],
    ['a name of 61 characters', 'a'.repeat(61), 'Name must be 60 characters or fewer'],
  ])(
    'AC3 does not save %s, shows the error under the name and keeps it',
    async (_case, name, message) => {
      const bodies = fakeSave('post');
      const { user } = renderAdd();

      if (name !== '') await user.type(field.name(), name);
      await user.click(screen.getByRole('button', { name: 'Add category' }));

      expect(await screen.findByText(message)).toBeInTheDocument();
      expect(field.name()).toHaveAttribute('aria-invalid', 'true');
      expect(field.name()).toHaveFocus();
      expect(field.name()).toHaveValue(name);
      expect(bodies).toEqual([]);
    },
  );

  it.each(['Ao-khoac', 'áo-khoác', 'ao khoac', '-ao-khoac'])(
    'AC3 does not save the typed slug %s, and shows the format error under it',
    async (slug) => {
      const bodies = fakeSave('post');
      const { user } = renderAdd();

      await user.type(field.name(), 'Áo khoác');
      await user.clear(field.slug());
      await user.type(field.slug(), slug);
      await user.click(screen.getByRole('button', { name: 'Add category' }));

      expect(
        await screen.findByText(
          'Use lowercase a–z, digits and hyphens only, with no hyphen at the start or end.',
        ),
      ).toBeInTheDocument();
      expect(field.slug()).toHaveFocus();
      expect(field.slug()).toHaveValue(slug);
      expect(field.name()).toHaveValue('Áo khoác');
      expect(bodies).toEqual([]);
    },
  );

  it('AC4 shows "This category name already exists" under the name for 409, focused', async () => {
    fakeSave('post', () => problem(409, 'CATEGORY_NAME_DUPLICATED'));
    const { user } = renderAdd();

    await user.type(field.name(), 'Áo Thun');
    await user.click(screen.getByRole('button', { name: 'Add category' }));

    expect(await screen.findByText('This category name already exists')).toBeInTheDocument();
    expect(field.name()).toHaveFocus();
    expect(field.name()).toHaveValue('Áo Thun');
  });

  it('AC4 shows "This slug is already in use" under a typed slug for 409', async () => {
    fakeSave('post', () => problem(409, 'CATEGORY_SLUG_DUPLICATED'));
    const { user } = renderAdd();

    await user.type(field.name(), 'Áo cộc');
    await user.clear(field.slug());
    await user.type(field.slug(), 'ao-thun');
    await user.click(screen.getByRole('button', { name: 'Add category' }));

    expect(await screen.findByText('This slug is already in use')).toBeInTheDocument();
    expect(field.slug()).toHaveFocus();
    expect(screen.queryByText('The category list')).not.toBeInTheDocument();
  });

  it('asks for a slug when every generated slug is taken (S2.6)', async () => {
    fakeSave('post', () => problem(409, 'CATEGORY_SLUG_DUPLICATED'));
    const { user } = renderAdd();

    await user.type(field.name(), 'Áo thun');
    await user.click(screen.getByRole('button', { name: 'Add category' }));

    expect(
      await screen.findByText('Every slug made from this name is taken. Type a slug yourself.'),
    ).toBeInTheDocument();
    expect(field.slug()).toHaveFocus();
  });

  it('AC3 shows "This value isn\'t valid." under each field a 400 of the api names, the first focused', async () => {
    fakeSave('post', () =>
      problem(400, 'VALIDATION_FAILED', {
        errors: [{ field: 'slug' }, { field: 'name' }],
      }),
    );
    const { user } = renderAdd();

    await user.type(field.name(), 'Áo');
    await user.click(screen.getByRole('button', { name: 'Add category' }));

    await waitFor(() => {
      expect(screen.getAllByText("This value isn't valid.")).toHaveLength(2);
    });
    expect(field.name()).toHaveFocus();
  });

  it('shows the general error of S2.4 for a 5xx, keeps everything and saves on a second try', async () => {
    let fail = true;
    const bodies = fakeSave('post', () =>
      fail ? problem(500, 'INTERNAL_ERROR') : HttpResponse.json(saved, { status: 201 }),
    );
    const { user } = renderAdd();

    await user.type(field.name(), 'Áo');
    await user.click(screen.getByRole('button', { name: 'Add category' }));

    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't save. Please try again.");
    expect(field.name()).toHaveValue('Áo');
    fail = false;
    await user.click(screen.getByRole('button', { name: 'Add category' }));
    expect(await screen.findByText('The category list')).toBeInTheDocument();
    expect(bodies).toHaveLength(2);
  });

  it('says "Saving…" and sends once while the POST runs (S2.9)', async () => {
    let release: () => void = () => undefined;
    const bodies = fakeSave(
      'post',
      () =>
        new Promise((resolve) => {
          release = () => {
            resolve(HttpResponse.json(saved, { status: 201 }));
          };
        }),
    );
    const { user } = renderAdd();

    await user.type(field.name(), 'Áo');
    await user.click(screen.getByRole('button', { name: 'Add category' }));
    const saving = await screen.findByRole('button', { name: 'Saving…' });
    expect(saving).toHaveAttribute('aria-busy', 'true');
    await user.click(saving);

    expect(bodies).toHaveLength(1);
    release();
    expect(await screen.findByText('The category list')).toBeInTheDocument();
  });

  it('shows its labels in Vietnamese', async () => {
    await testI18n.changeLanguage('vi');
    renderAdd();

    expect(screen.getByRole('heading', { level: 1, name: 'Thêm danh mục' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /Tên danh mục/ })).toHaveAttribute(
      'placeholder',
      'vd. Áo khoác',
    );
    expect(screen.getByRole('radio', { name: 'Hiện' })).toBeChecked();
  });
});

describe('CategoryForm in edit mode', () => {
  it('starts from the saved category, its slug not following the name (S2.6)', async () => {
    const { user } = renderEdit();

    expect(screen.getByRole('heading', { level: 1, name: 'Edit category' })).toBeInTheDocument();
    expect(field.name()).toHaveValue('Áo');
    expect(field.slug()).toHaveAccessibleDescription("Renaming doesn't change the link.");
    await user.type(field.name(), ' nam');

    expect(field.slug()).toHaveValue('ao');
  });

  it('AC5 keeps the slug when the name changes, and sends the version it loaded', async () => {
    const bodies = fakeSave('put');
    const { user } = renderEdit();

    await user.type(field.name(), ' nam');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('The category list')).toBeInTheDocument();
    expect(bodies).toEqual([
      { name: 'Áo nam', slug: 'ao', status: 'VISIBLE', displayOrder: 2, version: 3 },
    ]);
    expect(getSnapshot().map(({ message }) => message)).toEqual(['Category saved']);
  });

  it('AC5 warns at once that the old link stops working when the slug changes, until it is typed back', async () => {
    const { user } = renderEdit();

    await user.type(field.slug(), '-nam');

    expect(screen.getByText('The old link /categories/ao will stop working.')).toBeInTheDocument();
    await user.clear(field.slug());
    await user.type(field.slug(), 'ao');
    expect(screen.queryByText(/will stop working/)).not.toBeInTheDocument();
  });

  it('AC5 saves the new slug', async () => {
    const bodies = fakeSave('put');
    const { user } = renderEdit();

    await user.type(field.slug(), '-nam');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await screen.findByText('The category list');
    expect(bodies).toEqual([
      { name: 'Áo', slug: 'ao-nam', status: 'VISIBLE', displayOrder: 2, version: 3 },
    ]);
  });

  it('AC6 sends the Hidden status', async () => {
    const bodies = fakeSave('put');
    const { user } = renderEdit();

    await user.click(field.hidden());
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await screen.findByText('The category list');
    expect(bodies).toEqual([
      { name: 'Áo', slug: 'ao', status: 'HIDDEN', displayOrder: 2, version: 3 },
    ]);
  });

  it.each(['', 'Ao', 'áo', 'ao nam', '-ao'])('AC3 does not save the slug %j', async (slug) => {
    const bodies = fakeSave('put');
    const { user } = renderEdit();

    await user.clear(field.slug());
    if (slug !== '') await user.type(field.slug(), slug);
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(
      await screen.findByText(
        'Use lowercase a–z, digits and hyphens only, with no hyphen at the start or end.',
      ),
    ).toBeInTheDocument();
    expect(field.slug()).toHaveValue(slug);
    expect(bodies).toEqual([]);
  });

  it('AC4 shows a taken slug under the slug for 409', async () => {
    fakeSave('put', () => problem(409, 'CATEGORY_SLUG_DUPLICATED'));
    const { user } = renderEdit();

    await user.clear(field.slug());
    await user.type(field.slug(), 'ao-thun');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('This slug is already in use')).toBeInTheDocument();
  });

  it('shows the conflict banner for 409 OPTIMISTIC_LOCK_CONFLICT, keeps the fields, and Reload reloads (S2.4)', async () => {
    fakeSave('put', () => problem(409, 'OPTIMISTIC_LOCK_CONFLICT'));
    const { user, onReload } = renderEdit();

    await user.type(field.name(), ' nam');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This category was just edited elsewhere. Reload to see the latest version.',
    );
    expect(field.name()).toHaveValue('Áo nam');
    await user.click(screen.getByRole('button', { name: 'Reload' }));
    expect(onReload).toHaveBeenCalledOnce();
  });

  it('calls onMissing for a 404: the category was deleted in another tab (S2.4)', async () => {
    fakeSave('put', () => problem(404, 'CATEGORY_NOT_FOUND'));
    const { user, onMissing } = renderEdit();

    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => {
      expect(onMissing).toHaveBeenCalledOnce();
    });
  });
});
