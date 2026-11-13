import { expect, test } from 'vitest';

import { renderWithProviders, screen } from '~/testing/render';

import { ProductImageZoomButton } from './product-image-zoom-button';

test('hiện nút trigger; bấm → next/dynamic tải chunk modal → dialog xuất hiện', async () => {
  const { user } = renderWithProviders(
    <ProductImageZoomButton
      src="https://picsum.photos/seed/x/600/400"
      alt="Sản phẩm X"
      label="Zoom"
      closeLabel="Close"
    />,
  );

  // Ban đầu: chỉ có nút trigger, CHƯA có dialog (modal chưa được lazy-load).
  expect(screen.getByRole('button', { name: 'Zoom' })).toBeInTheDocument();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

  // Bấm → dynamic import resolve → modal render. `findByRole` chờ async import xong.
  await user.click(screen.getByRole('button', { name: 'Zoom' }));
  expect(await screen.findByRole('dialog')).toBeInTheDocument();
});
