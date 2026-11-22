import { expect, test, vi } from 'vitest';

import { CategoryNotFound } from '~/features/category/components/category-not-found';

import NotFound from './not-found';

// The navigation of next-intl does not load outside Next, and the view links with StaticLink.
vi.mock('~/i18n/navigation', () => ({ getPathname: () => '/' }));

test('shows S6, the view shared with the category page', () => {
  expect(NotFound().type).toBe(CategoryNotFound);
});
