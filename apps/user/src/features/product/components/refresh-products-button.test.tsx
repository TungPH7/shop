import { expect, test, vi } from 'vitest';

import { renderWithProviders, screen } from '~/testing/render';

import { RefreshProductsButton } from './refresh-products-button';

// Mock module Server Action → KHÔNG kéo `next/cache` vào test client; ta chỉ smoke-test phần WIRING
// render (label + trạng thái idle). Logic action đã test ở `product-actions.test.ts`.
vi.mock('~/features/product/actions/product-actions', () => ({
  refreshProductsAction: vi.fn(),
  deleteProductAction: vi.fn(),
}));

test('render nút làm mới; idle → chưa hiện mốc thời gian', () => {
  renderWithProviders(<RefreshProductsButton label="Refresh" doneLabel="Refreshed at" />);
  expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument();
  expect(screen.queryByText(/Refreshed at/)).not.toBeInTheDocument();
});
