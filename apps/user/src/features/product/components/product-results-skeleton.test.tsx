import { describe, expect, test } from 'vitest';

import { renderWithProviders, screen, within } from '~/testing/render';

import { ProductResultsSkeleton } from './product-results-skeleton';

describe('<ProductResultsSkeleton />', () => {
  test('shows 8 skeleton cards in a busy list, with no words (S4.5, loading)', () => {
    renderWithProviders(<ProductResultsSkeleton />, { locale: 'vi' });

    const grid = screen.getByRole('list', { name: 'Danh sách sản phẩm' });
    expect(grid).toHaveAttribute('aria-busy', 'true');
    expect(within(grid).getAllByRole('listitem')).toHaveLength(8);
    expect(grid.textContent).toBe('');
  });

  test('keeps the place of the search and the sort while they load, with no field to type into yet', () => {
    const { container } = renderWithProviders(<ProductResultsSkeleton />, { locale: 'vi' });

    const row = container.querySelector('.product-filters');
    expect(row).toHaveAttribute('aria-hidden', 'true');
    expect(row?.querySelectorAll('.skeleton')).toHaveLength(2);
    expect(screen.queryByRole('searchbox')).toBeNull();
  });
});

describe('<ProductResultsSkeleton /> of a category', () => {
  test('keeps the place of the sort alone, since a category page has no search', () => {
    const { container } = renderWithProviders(<ProductResultsSkeleton search={false} />, {
      locale: 'vi',
    });

    const row = container.querySelector('.product-filters');
    expect(row).toHaveClass('product-filters--sort-only');
    expect(row?.querySelectorAll('.skeleton')).toHaveLength(1);
  });
});
