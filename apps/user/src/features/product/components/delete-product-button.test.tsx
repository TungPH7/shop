import { expect, test, vi } from 'vitest';

import { renderWithProviders, screen } from '~/testing/render';

import { DeleteProductButton } from './delete-product-button';

vi.mock('~/features/product/actions/product-actions', () => ({
  refreshProductsAction: vi.fn(),
  deleteProductAction: vi.fn(),
}));

const messages = { validation: 'invalid', auth: 'need login', unknown: 'oops' };

test('render nút xoá + input ẩn productId; idle → chưa hiện lỗi', () => {
  const { container } = renderWithProviders(
    <DeleteProductButton productId={29} label="Delete" messages={messages} />,
  );
  expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  expect(container.querySelector('input[name="productId"]')).toHaveValue('29');
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
