import { expect, test, vi } from 'vitest';

import { ProductNotFound } from '~/features/product/components/product-not-found';

import NotFound from './not-found';

// The navigation of next-intl does not load outside Next, and the view links with StaticLink.
vi.mock('~/i18n/navigation', () => ({ getPathname: () => '/' }));

test('shows S6 when the page calls notFound() on a client navigation', () => {
  expect(NotFound().type).toBe(ProductNotFound);
});
