import { expect, test } from 'vitest';

import { ProductResults } from '~/features/product/components/product-results';

// The frame of the results of S4 until US5a (SHOP-25) fills it: the page keeps its <Suspense>, and nothing of the
// template's product demo (list, delete button, count badge, density, view, zoom) is left in it (TW4 of SHOP-7).
test('renders nothing until the catalog list of US5a, whatever the search params', async () => {
  const results = await ProductResults({
    searchParams: Promise.resolve({ q: 'áo', sort: 'price-asc', page: '2' }),
  });

  expect(results).toBeNull();
});
