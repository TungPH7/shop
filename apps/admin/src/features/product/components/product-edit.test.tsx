import { focusManager, onlineManager, type QueryClient } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Route, Routes } from 'react-router';

import { type UpdateProductInput } from '@/features/product/api/update-product';
import { ProductEdit } from '@/features/product/components/product-edit';
import { type AdminProduct } from '@/features/product/model/product';
import { clearAll, getSnapshot } from '@/lib/notifications/notification-store';
import { server } from '@/testing/msw/server';
import { act, renderWithProviders, screen, waitFor } from '@/testing/render';
import { testI18n } from '@/testing/test-i18n';

// S2 of docs/specs/SHOP-7/design.md in edit mode (US3), against fakes of
// GET and PUT /api/admin/products/{id}.

afterEach(async () => {
  clearAll();
  onlineManager.setOnline(true);
  focusManager.setFocused(undefined);
  await testI18n.changeLanguage('en');
});

const shirt: AdminProduct = {
  id: '019a8f2e-5b7c-7d10-9e3f-1a2b3c4d5e6f',
  name: 'Áo thun cổ tròn',
  slug: 'ao-thun-co-tron',
  description: 'Áo thun cotton 100%.',
  price: 250000,
  compareAtPrice: null,
  status: 'ACTIVE',
  availability: 'IN_STOCK',
  createdAt: '2026-11-16T02:10:00.000Z',
  updatedAt: '2026-11-16T02:15:30.000Z',
  version: 4,
};

function problem(status: number, code: string, extra: Record<string, unknown> = {}) {
  return HttpResponse.json({ status, code, title: 'Problem', detail: '…', ...extra }, { status });
}

/** Answers each GET with the next of `answers`, the last one again once they run out. */
function fakeGet(...answers: (() => Response | Promise<Response>)[]) {
  let calls = 0;
  server.use(
    http.get('*/admin/products/:id', () => {
      const answer = answers[Math.min(calls, answers.length - 1)];
      calls += 1;
      return answer ? answer() : HttpResponse.json(shirt);
    }),
  );
  return { calls: () => calls };
}

/** Records each body put, and answers with `respond`, or 200 with the saved product. */
function fakePut(respond?: (body: UpdateProductInput) => Response | Promise<Response>) {
  const bodies: UpdateProductInput[] = [];
  server.use(
    http.put('*/admin/products/:id', async ({ request }) => {
      const body = (await request.json()) as UpdateProductInput;
      bodies.push(body);
      return respond
        ? respond(body)
        : HttpResponse.json({ ...shirt, ...body, version: body.version + 1 });
    }),
  );
  return bodies;
}

function renderEdit(id = shirt.id) {
  return renderWithProviders(
    <Routes>
      <Route path="/products/:productId/edit" element={<ProductEdit productId={id} />} />
      <Route path="/products" element={<p>The product list</p>} />
    </Routes>,
    { route: `/products/${id}/edit` },
  );
}

const field = {
  name: () => screen.getByRole('textbox', { name: /Product name/ }),
  slug: () => screen.getByRole('textbox', { name: 'URL slug' }),
  description: () => screen.getByRole('textbox', { name: 'Description (optional)' }),
  price: () => screen.getByRole('textbox', { name: /^Price/ }),
  compareAtPrice: () => screen.getByRole('textbox', { name: 'Compare-at price (₫) (optional)' }),
};

const save = () => screen.getByRole('button', { name: 'Save changes' });

async function loaded() {
  return screen.findByRole('heading', { level: 1, name: 'Edit product' });
}

/**
 * Fires `event`, then checks that nothing loads again. On focus or on reconnect the
 * QueryClient first awaits resumePausedMutations, then hands the event to its query
 * cache (`onFocus` or `onOnline`), which starts any refetch at once: once that call
 * is seen, a refetch would already be fetching, so no fixed wait and no count of
 * microtasks is needed (TE-012).
 */
async function expectNoReloadOn(
  event: () => void,
  queryClient: QueryClient,
  get: { calls: () => number },
  handler: 'onFocus' | 'onOnline',
) {
  const handled = vi.spyOn(queryClient.getQueryCache(), handler);
  act(event);
  await waitFor(() => {
    expect(handled).toHaveBeenCalledOnce();
  });

  expect(queryClient.isFetching()).toBe(0);
  expect(get.calls()).toBe(1);
  expect(screen.queryByLabelText('Loading the product')).not.toBeInTheDocument();
}

describe('ProductEdit', () => {
  it('S2.3 shows a skeleton while the product loads, then the form with the saved product', async () => {
    fakeGet();
    renderEdit();

    expect(screen.getByLabelText('Loading the product')).toHaveAttribute('aria-busy', 'true');

    await loaded();
    expect(screen.queryByLabelText('Loading the product')).not.toBeInTheDocument();
    expect(field.name()).toHaveValue('Áo thun cổ tròn');
    expect(field.slug()).toHaveValue('ao-thun-co-tron');
    expect(field.description()).toHaveValue('Áo thun cotton 100%.');
    expect(field.price()).toHaveValue('250.000');
    expect(field.compareAtPrice()).toHaveValue('');
    expect(screen.getByRole('radio', { name: 'Active' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'In stock' })).toBeChecked();
    expect(save()).toBeInTheDocument();
  });

  it('shows the saved status and availability of a hidden, sold-out product', async () => {
    fakeGet(() => HttpResponse.json({ ...shirt, status: 'HIDDEN', availability: 'OUT_OF_STOCK' }));
    renderEdit();
    await loaded();

    expect(screen.getByRole('radio', { name: 'Hidden' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Out of stock' })).toBeChecked();
  });

  it.each([
    ['a 404, a product never made or deleted', () => problem(404, 'PRODUCT_NOT_FOUND')],
    ['a 400, an id that is no UUID', () => problem(400, 'INVALID_PARAMETER')],
  ])(
    'S2.3 says the product was not found on %s, with a link to the list',
    async (_case, answer) => {
      fakeGet(answer);
      renderEdit();

      expect(
        await screen.findByText("We couldn't find this product. It may have been deleted."),
      ).toBeInTheDocument();
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Back to products' })).toHaveAttribute(
        'href',
        '/products',
      );
    },
  );

  it('says the product could not be loaded on a network error, and Try again loads it', async () => {
    // The api layer tries a read three times before it gives up.
    const offline = () => HttpResponse.error();
    const get = fakeGet(offline, offline, offline, () => HttpResponse.json(shirt));
    const { user } = renderEdit();

    expect(await screen.findByRole('alert', {}, { timeout: 5000 })).toHaveTextContent(
      "Couldn't load the product.",
    );
    expect(get.calls()).toBe(3);

    await user.click(screen.getByRole('button', { name: 'Try again' }));

    await loaded();
    expect(get.calls()).toBe(4);
    expect(field.name()).toHaveValue('Áo thun cổ tròn');
  });

  it('keeps the slug when the name changes (S2.7)', async () => {
    fakeGet();
    const { user } = renderEdit();
    await loaded();

    await user.clear(field.name());
    await user.type(field.name(), 'Áo thun cổ tròn basic');

    expect(field.slug()).toHaveValue('ao-thun-co-tron');
    expect(screen.queryByText(/Generated from the name/)).not.toBeInTheDocument();
  });

  it('AC9 puts the edited fields with the loaded version, says "Product saved" and goes back to the list', async () => {
    fakeGet();
    const bodies = fakePut();
    const { user } = renderEdit();
    await loaded();

    await user.clear(field.name());
    await user.type(field.name(), 'Áo thun cổ tròn basic');
    await user.clear(field.price());
    await user.type(field.price(), '200000');
    await user.type(field.compareAtPrice(), '250000');
    await user.click(save());

    expect(await screen.findByText('The product list')).toBeInTheDocument();
    expect(bodies).toEqual([
      {
        name: 'Áo thun cổ tròn basic',
        slug: 'ao-thun-co-tron',
        description: 'Áo thun cotton 100%.',
        price: 200000,
        compareAtPrice: 250000,
        status: 'ACTIVE',
        availability: 'IN_STOCK',
        version: 4,
      },
    ]);
    expect(getSnapshot().map(({ kind, message }) => ({ kind, message }))).toEqual([
      { kind: 'success', message: 'Product saved' },
    ]);
  });

  it('AC10 AC11 puts the status and availability chosen', async () => {
    fakeGet();
    const bodies = fakePut();
    const { user } = renderEdit();
    await loaded();

    await user.click(screen.getByRole('radio', { name: 'Hidden' }));
    await user.click(screen.getByRole('radio', { name: 'Out of stock' }));
    await user.click(save());

    await waitFor(() => {
      expect(bodies[0]).toMatchObject({ status: 'HIDDEN', availability: 'OUT_OF_STOCK' });
    });
  });

  it('AC12 warns at once that the old link will stop working when the slug changes, until the old slug is typed again', async () => {
    fakeGet();
    const { user } = renderEdit();
    await loaded();
    const warning = 'The old link /products/ao-thun-co-tron will stop working.';

    await user.clear(field.slug());
    await user.type(field.slug(), 'ao-thun-basic');

    expect(field.slug()).toHaveAccessibleDescription(expect.stringContaining(warning));
    expect(screen.getByText(warning).closest('[role="status"]')).not.toBeNull();

    await user.clear(field.slug());
    await user.type(field.slug(), 'AO-THUN-CO-TRON');

    expect(screen.queryByText(warning)).not.toBeInTheDocument();
  });

  it('AC12 puts the new slug', async () => {
    fakeGet();
    const bodies = fakePut();
    const { user } = renderEdit();
    await loaded();

    await user.clear(field.slug());
    await user.type(field.slug(), 'ao-thun-basic');
    await user.click(save());

    await screen.findByText('The product list');
    expect(bodies[0]?.slug).toBe('ao-thun-basic');
  });

  it('saves an old product whose saved slug has a wrong format (NFR16)', async () => {
    fakeGet(() => HttpResponse.json({ ...shirt, slug: 'Ao_Thun Cu' }));
    const bodies = fakePut();
    const { user } = renderEdit();
    await loaded();

    await user.click(save());

    await screen.findByText('The product list');
    expect(bodies[0]?.slug).toBe('Ao_Thun Cu');
  });

  it('does not save an emptied slug, and says the format under it', async () => {
    fakeGet();
    const bodies = fakePut();
    const { user } = renderEdit();
    await loaded();

    await user.clear(field.slug());
    await user.click(save());

    await waitFor(() => {
      expect(field.slug()).toHaveAttribute('aria-invalid', 'true');
    });
    expect(field.slug()).toHaveAccessibleDescription(expect.stringContaining('Use lowercase a–z'));
    expect(bodies).toEqual([]);
  });

  it('AC13 shows the conflict banner on 409 OPTIMISTIC_LOCK_CONFLICT, keeps the input and reloads only on Reload', async () => {
    const get = fakeGet(
      () => HttpResponse.json(shirt),
      () => HttpResponse.json({ ...shirt, name: 'Áo thun của tab kia', version: 5 }),
    );
    const bodies = fakePut(() => problem(409, 'OPTIMISTIC_LOCK_CONFLICT'));
    const { user } = renderEdit();
    await loaded();
    await user.clear(field.name());
    await user.type(field.name(), 'Áo thun của tab này');
    await user.clear(field.price());
    await user.type(field.price(), '199000');

    await user.click(save());

    const banner = await screen.findByRole('alert');
    expect(banner).toHaveTextContent(
      'This product was just edited elsewhere. Reload to see the latest version.',
    );
    expect(save()).toHaveFocus();
    expect(field.name()).toHaveValue('Áo thun của tab này');
    expect(field.price()).toHaveValue('199.000');
    expect(screen.queryByText('The product list')).not.toBeInTheDocument();
    expect(get.calls()).toBe(1);
    expect(bodies).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: 'Reload' }));

    await waitFor(() => {
      expect(field.name()).toHaveValue('Áo thun của tab kia');
    });
    expect(get.calls()).toBe(2);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    fakePut();
    await user.click(save());
    await screen.findByText('The product list');
  });

  // The form edits the version it opened with (AC13): only Reload loads another one.
  // Production refetches on focus by default, and every client on reconnect, which would
  // swap the form for the skeleton and drop what was typed.
  it('AC13 keeps what was typed when the window gets the focus back, loading nothing', async () => {
    const get = fakeGet();
    const { user, queryClient } = renderEdit();
    await loaded();
    await user.clear(field.name());
    await user.type(field.name(), 'Áo thun đang sửa');

    await expectNoReloadOn(
      () => {
        focusManager.setFocused(false);
        focusManager.setFocused(true);
      },
      queryClient,
      get,
      'onFocus',
    );
    expect(field.name()).toHaveValue('Áo thun đang sửa');
  });

  it('AC13 keeps what was typed when the network comes back, loading nothing', async () => {
    const get = fakeGet();
    const { user, queryClient } = renderEdit();
    await loaded();
    await user.clear(field.name());
    await user.type(field.name(), 'Áo thun đang sửa');

    await expectNoReloadOn(
      () => {
        onlineManager.setOnline(false);
        onlineManager.setOnline(true);
      },
      queryClient,
      get,
      'onOnline',
    );
    expect(field.name()).toHaveValue('Áo thun đang sửa');
  });

  it('AC13 brings the conflict banner into view, the focus staying on Save (S2.5)', async () => {
    // jsdom lays nothing out: record which element asks to be scrolled to, and put the
    // no-op of the test setup back afterwards, for the tests that follow.
    const scrolled: Element[] = [];
    const scrollIntoView = vi
      .spyOn(Element.prototype, 'scrollIntoView')
      .mockImplementation(function (this: Element) {
        scrolled.push(this);
      });
    try {
      fakeGet();
      fakePut(() => problem(409, 'OPTIMISTIC_LOCK_CONFLICT'));
      const { user } = renderEdit();
      await loaded();

      await user.click(save());

      const banner = await screen.findByRole('alert');
      expect(scrolled).toEqual([banner]);
      expect(save()).toHaveFocus();
    } finally {
      scrollIntoView.mockRestore();
    }
  });

  it('AC13 sends the version of the reload after Reload', async () => {
    fakeGet(
      () => HttpResponse.json(shirt),
      () => HttpResponse.json({ ...shirt, version: 5 }),
    );
    let calls = 0;
    const bodies = fakePut((body) => {
      calls += 1;
      return calls === 1
        ? problem(409, 'OPTIMISTIC_LOCK_CONFLICT')
        : HttpResponse.json({ ...shirt, ...body, version: body.version + 1 });
    });
    const { user } = renderEdit();
    await loaded();
    await user.click(save());
    await user.click(await screen.findByRole('button', { name: 'Reload' }));
    await waitFor(() => {
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    await user.click(save());

    await screen.findByText('The product list');
    expect(bodies.map((body) => body.version)).toEqual([4, 5]);
  });

  it('S2.7 shows "This slug is already in use" under the slug on 409 PRODUCT_SLUG_DUPLICATED', async () => {
    fakeGet();
    fakePut(() => problem(409, 'PRODUCT_SLUG_DUPLICATED'));
    const { user } = renderEdit();
    await loaded();
    await user.clear(field.slug());
    await user.type(field.slug(), 'quan-jean-nam');

    await user.click(save());

    await waitFor(() => {
      expect(field.slug()).toHaveAccessibleDescription(
        expect.stringContaining('This slug is already in use'),
      );
    });
    expect(field.slug()).toHaveFocus();
    expect(field.slug()).toHaveValue('quan-jean-nam');
  });

  it('shows an error under each field a 400 of the api names', async () => {
    fakeGet();
    fakePut(() =>
      problem(400, 'VALIDATION_FAILED', { errors: [{ field: 'slug', message: 'wrong' }] }),
    );
    const { user } = renderEdit();
    await loaded();
    await user.clear(field.slug());
    await user.type(field.slug(), 'ao-thun-moi');

    await user.click(save());

    await waitFor(() => {
      expect(field.slug()).toHaveAccessibleDescription(
        expect.stringContaining("This value isn't valid."),
      );
    });
  });

  it('S2.3 shows the not-found state when the product was deleted before the save', async () => {
    fakeGet();
    fakePut(() => problem(404, 'PRODUCT_NOT_FOUND'));
    const { user } = renderEdit();
    await loaded();

    await user.click(save());

    expect(
      await screen.findByText("We couldn't find this product. It may have been deleted."),
    ).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it.each([
    ['a 5xx', () => problem(503, 'SERVICE_UNAVAILABLE')],
    ['a network error', () => HttpResponse.error()],
  ])(
    'S2.5 says "Couldn\'t save" on %s, sends the PUT once and keeps the input (NFR19)',
    async (_case, failure) => {
      fakeGet();
      const bodies = fakePut(failure);
      const { user } = renderEdit();
      await loaded();
      await user.clear(field.name());
      await user.type(field.name(), 'Áo mới');

      await user.click(save());

      expect(await screen.findByRole('alert')).toHaveTextContent(
        "Couldn't save. Please try again.",
      );
      expect(screen.queryByRole('button', { name: 'Reload' })).not.toBeInTheDocument();
      expect(field.name()).toHaveValue('Áo mới');
      expect(bodies).toHaveLength(1);
    },
  );

  it('S2.5 says "Couldn\'t save" at once when the browser is offline, and puts nothing once it is back (NFR19)', async () => {
    fakeGet();
    const bodies = fakePut(() => HttpResponse.error());
    const { user, queryClient } = renderEdit();
    await loaded();
    await user.clear(field.name());
    await user.type(field.name(), 'Áo mới');
    onlineManager.setOnline(false);

    await user.click(save());

    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't save. Please try again.");
    expect(field.name()).toHaveValue('Áo mới');
    expect(save()).not.toHaveAttribute('aria-disabled');
    expect(bodies).toHaveLength(1);

    onlineManager.setOnline(true);
    await queryClient.resumePausedMutations();

    expect(bodies).toHaveLength(1);
  });

  it('speaks Vietnamese', async () => {
    await testI18n.changeLanguage('vi');
    fakeGet();
    fakePut(() => problem(409, 'OPTIMISTIC_LOCK_CONFLICT'));
    const { user } = renderEdit();

    await screen.findByRole('heading', { level: 1, name: 'Sửa sản phẩm' });
    await user.clear(screen.getByRole('textbox', { name: 'Đường dẫn (slug)' }));
    await user.type(screen.getByRole('textbox', { name: 'Đường dẫn (slug)' }), 'ao-thun-basic');
    expect(
      screen.getByText('Đường dẫn cũ /products/ao-thun-co-tron sẽ không mở được nữa.'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Sản phẩm vừa được sửa ở nơi khác. Tải lại để xem bản mới nhất.',
    );
    expect(screen.getByRole('button', { name: 'Tải lại' })).toBeInTheDocument();
  });
});
