import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';
import { Route, Routes } from 'react-router';

import { ProductForm } from '@/features/product/components/product-form';
import { type AdminProduct } from '@/features/product/model/product';
import { type CreateProductInput } from '@/features/product/model/product-form';
import { clearAll, getSnapshot } from '@/lib/notifications/notification-store';
import { server } from '@/testing/msw/server';
import { renderWithProviders, screen, waitFor } from '@/testing/render';
import { testI18n } from '@/testing/test-i18n';

// S2 of docs/specs/SHOP-7/design.md in add mode (US2), against a fake of
// POST /api/admin/products.

afterEach(() => {
  clearAll();
});

function product(input: CreateProductInput): AdminProduct {
  return {
    id: '019a8f2e-5b7c-7d10-9e3f-1a2b3c4d5e6f',
    ...input,
    slug: input.slug ?? 'dam-maxi-do',
    createdAt: '2026-11-16T02:10:00.000Z',
    updatedAt: '2026-11-16T02:10:00.000Z',
    version: 0,
  };
}

// Records each body posted, and answers with `respond`, or 201 with the product.
function fakeApi(respond?: (body: CreateProductInput) => Response | Promise<Response>) {
  const bodies: CreateProductInput[] = [];
  server.use(
    http.post('*/admin/products', async ({ request }) => {
      const body = (await request.json()) as CreateProductInput;
      bodies.push(body);
      return respond ? respond(body) : HttpResponse.json(product(body), { status: 201 });
    }),
  );
  return bodies;
}

function problem(status: number, code: string, extra: Record<string, unknown> = {}) {
  return HttpResponse.json({ status, code, title: 'Problem', detail: '…', ...extra }, { status });
}

function renderForm() {
  return renderWithProviders(
    <Routes>
      <Route path="/products/new" element={<ProductForm />} />
      <Route path="/products" element={<p>The product list</p>} />
    </Routes>,
    { route: '/products/new' },
  );
}

const field = {
  name: () => screen.getByRole('textbox', { name: /Product name/ }),
  slug: () => screen.getByRole('textbox', { name: 'URL slug' }),
  description: () => screen.getByRole('textbox', { name: 'Description (optional)' }),
  price: () => screen.getByRole('textbox', { name: /^Price/ }),
  compareAtPrice: () => screen.getByRole('textbox', { name: 'Compare-at price (₫) (optional)' }),
};

function submit() {
  return screen.getByRole('button', { name: 'Add product' });
}

describe('ProductForm in add mode', () => {
  it('shows the title, the fields and the defaults of a new product', () => {
    renderForm();

    expect(screen.getByRole('heading', { level: 1, name: 'Add product' })).toBeInTheDocument();
    expect(field.name()).toBeRequired();
    expect(field.price()).toHaveAttribute('inputmode', 'numeric');
    expect(screen.getByRole('radio', { name: 'Active' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'In stock' })).toBeChecked();
    expect(screen.getByRole('link', { name: 'Products' })).toHaveAttribute('href', '/products');
    expect(screen.getByRole('link', { name: 'Cancel' })).toHaveAttribute('href', '/products');
  });

  it('AC5 fills the slug from the name, with the hint that the api adds -2, -3…', async () => {
    const { user } = renderForm();

    await user.type(field.name(), 'Đầm maxi đỏ');

    expect(field.slug()).toHaveValue('dam-maxi-do');
    expect(field.slug()).toHaveAccessibleDescription(/Generated from the name/);
    expect(screen.getByText('11/150')).toBeInTheDocument();
  });

  it('stops following the name once the slug is typed, and sends the typed slug', async () => {
    const bodies = fakeApi();
    const { user } = renderForm();
    await user.type(field.name(), 'Đầm');
    await user.clear(field.slug());
    await user.type(field.slug(), 'dam-do');

    await user.type(field.name(), ' maxi');
    await user.type(field.price(), '450000');

    expect(field.slug()).toHaveValue('dam-do');
    await user.click(submit());
    await waitFor(() => {
      expect(bodies[0]?.slug).toBe('dam-do');
    });
  });

  it('follows the name again once the typed slug is emptied', async () => {
    const { user } = renderForm();
    await user.type(field.slug(), 'tu-go');
    await user.clear(field.slug());

    await user.type(field.name(), 'Áo');

    expect(field.slug()).toHaveValue('ao');
  });

  it('shows the price with its thousands grouped once the field is left', async () => {
    const { user } = renderForm();

    await user.type(field.price(), '450000');
    await user.tab();

    expect(field.price()).toHaveValue('450.000');
  });

  it('AC5 posts slug null and the whole price, says "Product added" and goes back to the list', async () => {
    const bodies = fakeApi();
    const { user } = renderForm();

    await user.type(field.name(), 'Đầm maxi đỏ');
    await user.type(field.price(), '450.000');
    await user.click(submit());

    expect(await screen.findByText('The product list')).toBeInTheDocument();
    expect(bodies).toEqual([
      {
        name: 'Đầm maxi đỏ',
        slug: null,
        description: null,
        price: 450000,
        compareAtPrice: null,
        status: 'ACTIVE',
        availability: 'IN_STOCK',
      },
    ]);
    expect(getSnapshot().map(({ kind, message }) => ({ kind, message }))).toEqual([
      { kind: 'success', message: 'Product added' },
    ]);
  });

  it('sends the status and availability chosen', async () => {
    const bodies = fakeApi();
    const { user } = renderForm();
    await user.type(field.name(), 'Bao tay len');
    await user.type(field.price(), '99000');

    await user.click(screen.getByRole('radio', { name: 'Hidden' }));
    await user.click(screen.getByRole('radio', { name: 'Out of stock' }));
    await user.click(submit());

    await waitFor(() => {
      expect(bodies[0]).toMatchObject({ status: 'HIDDEN', availability: 'OUT_OF_STOCK' });
    });
  });

  describe('AC6 does not save an invalid value, shows the error under its field and keeps the input', () => {
    it.each([
      ['an empty name', { name: '' }, 'name', 'Enter a product name'],
      [
        'a name of 151 characters',
        { name: 'a'.repeat(151) },
        'name',
        'Name must be 150 characters or fewer',
      ],
      ['a slug with capitals', { slug: 'Ao-thun' }, 'slug', 'Use lowercase a–z'],
      ['a slug with accents', { slug: 'áo-thun' }, 'slug', 'Use lowercase a–z'],
      ['a slug with a space', { slug: 'ao thun' }, 'slug', 'Use lowercase a–z'],
      ['a price of 0', { price: '0' }, 'price', 'Price must be greater than 0'],
      [
        'a price with a fraction',
        { price: '450000,5' },
        'price',
        'Price must be a whole number of đồng',
      ],
      [
        'a compare-at price not above the price',
        { compareAtPrice: '450000' },
        'compareAtPrice',
        'Compare-at price must be greater than the price',
      ],
      [
        'a description of 5.001 characters',
        { description: 'a'.repeat(5001) },
        'description',
        'Description must be 5,000 characters or fewer',
      ],
    ] as const)('%s', async (_case, overrides, invalid, message) => {
      const bodies = fakeApi();
      const { user } = renderForm();
      const typed = {
        name: 'Áo thun cổ tròn',
        slug: '',
        description: 'Cotton',
        price: '450000',
        compareAtPrice: '',
        ...overrides,
      };
      for (const [key, text] of Object.entries(typed)) {
        if (text === '') continue;
        const control = field[key as keyof typeof field]();
        await user.clear(control);
        // Long values are pasted: typing 5.001 characters one by one is slow.
        if (text.length > 200) {
          control.focus();
          await user.paste(text);
        } else {
          await user.type(control, text);
        }
      }
      const before = Object.fromEntries(
        Object.entries(field).map(([key, get]) => [key, (get() as HTMLInputElement).value]),
      );

      await user.click(submit());

      const control = field[invalid]();
      await waitFor(() => {
        expect(control).toHaveAttribute('aria-invalid', 'true');
      });
      expect(control).toHaveAccessibleDescription(expect.stringContaining(message));
      expect(control).toHaveFocus();
      expect(bodies).toEqual([]);
      const after = Object.fromEntries(
        Object.entries(field).map(([key, get]) => [key, (get() as HTMLInputElement).value]),
      );
      // A price shows its grouping once left (450000 as 450.000); the rest stays as typed.
      const ungrouped = (prices: Record<string, string>) => ({
        ...prices,
        price: prices['price']?.replaceAll('.', ''),
        compareAtPrice: prices['compareAtPrice']?.replaceAll('.', ''),
      });
      expect(ungrouped(after)).toEqual(ungrouped(before));
    });
  });

  it('AC8 shows "This slug is already in use" under a typed slug the api says is taken', async () => {
    fakeApi(() => problem(409, 'PRODUCT_SLUG_DUPLICATED'));
    const { user } = renderForm();
    await user.type(field.name(), 'Áo thun cổ tròn');
    await user.clear(field.slug());
    await user.type(field.slug(), 'ao-thun-co-tron');
    await user.type(field.price(), '250000');

    await user.click(submit());

    await waitFor(() => {
      expect(field.slug()).toHaveAccessibleDescription(
        expect.stringContaining('This slug is already in use'),
      );
    });
    expect(field.slug()).toHaveFocus();
    expect(field.name()).toHaveValue('Áo thun cổ tròn');
    expect(screen.queryByText('The product list')).not.toBeInTheDocument();
  });

  it('asks for a typed slug, not "already in use", when no generated slug is free', async () => {
    fakeApi(() => problem(409, 'PRODUCT_SLUG_DUPLICATED'));
    const { user } = renderForm();
    await user.type(field.name(), 'Áo thun cổ tròn');
    await user.type(field.price(), '250000');

    await user.click(submit());

    await waitFor(() => {
      expect(field.slug()).toHaveAccessibleDescription(
        expect.stringContaining('Every slug made from this name is taken'),
      );
    });
    expect(screen.queryByText('This slug is already in use')).not.toBeInTheDocument();
  });

  it('shows an error under each field a 400 of the api names', async () => {
    fakeApi(() =>
      problem(400, 'VALIDATION_FAILED', {
        errors: [{ field: 'price', rejectedValue: 450000, message: 'must be at most 999999999' }],
      }),
    );
    const { user } = renderForm();
    await user.type(field.name(), 'Áo');
    await user.type(field.price(), '450000');

    await user.click(submit());

    await waitFor(() => {
      expect(field.price()).toHaveAccessibleDescription("This value isn't valid.");
    });
    expect(field.price()).toHaveFocus();
  });

  it.each([
    ['a 5xx', () => problem(500, 'INTERNAL_ERROR')],
    ['a network error', () => HttpResponse.error()],
  ])(
    'S2.5 says "Couldn\'t save" on %s, keeps the input, and saves on a new try',
    async (_case, failure) => {
      let calls = 0;
      const bodies = fakeApi((body) => {
        calls += 1;
        return calls === 1 ? failure() : HttpResponse.json(product(body), { status: 201 });
      });
      const { user } = renderForm();
      await user.type(field.name(), 'Áo');
      await user.type(field.price(), '450000');

      await user.click(submit());

      expect(await screen.findByRole('alert')).toHaveTextContent(
        "Couldn't save. Please try again.",
      );
      expect(field.name()).toHaveValue('Áo');
      expect(submit()).toHaveFocus();

      await user.click(submit());

      expect(await screen.findByText('The product list')).toBeInTheDocument();
      expect(bodies).toHaveLength(2);
    },
  );

  it('shows "Saving…" and locks the button while it saves', async () => {
    let release: () => void = () => undefined;
    const bodies = fakeApi(
      (body) =>
        new Promise((resolve) => {
          release = () => {
            resolve(HttpResponse.json(product(body), { status: 201 }));
          };
        }),
    );
    const { user } = renderForm();
    await user.type(field.name(), 'Áo');
    await user.type(field.price(), '450000');

    await user.click(submit());
    const saving = await screen.findByRole('button', { name: 'Saving…' });
    expect(saving).toHaveAttribute('aria-busy', 'true');
    expect(saving).toHaveAttribute('aria-disabled', 'true');
    await user.click(saving);
    release();

    expect(await screen.findByText('The product list')).toBeInTheDocument();
    expect(bodies).toHaveLength(1);
  });

  it('speaks Vietnamese', async () => {
    await testI18n.changeLanguage('vi');
    renderForm();

    expect(screen.getByRole('heading', { level: 1, name: 'Thêm sản phẩm' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Đường dẫn (slug)' })).toBeInTheDocument();
  });
});
