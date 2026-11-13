import { expect, test } from 'vitest';

import { renderWithProviders, screen } from '~/testing/render';

import { ProductFilters } from './product-filters';

const labels = {
  search: 'Search',
  searchPlaceholder: '',
  sort: 'Sort',
  order: 'Order',
  apply: 'Apply',
  sortOptions: { createdAt: 'Newest', price: 'Price', sale: 'On sale' },
  orderOptions: { asc: 'Asc', desc: 'Desc' },
};
const current = { page: 1, sortBy: 'createdAt', orderBy: 'desc' } as const;

test('render ô tìm + nút áp dụng (giá trị hiện tại làm default)', () => {
  renderWithProviders(<ProductFilters current={current} labels={labels} errorMessages={{}} />);
  expect(screen.getByRole('searchbox')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Apply' })).toBeInTheDocument();
});

test('name < 2 ký tự → chặn submit + hiện lỗi (shared schema → code → i18n)', async () => {
  const { user } = renderWithProviders(
    <ProductFilters current={current} labels={labels} errorMessages={{ too_short: 'Quá ngắn' }} />,
  );
  await user.type(screen.getByRole('searchbox'), 'a');
  await user.click(screen.getByRole('button', { name: 'Apply' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Quá ngắn');
});
