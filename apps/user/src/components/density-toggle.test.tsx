import { expect, test } from 'vitest';

import { renderWithProviders, screen } from '~/testing/render';

import { DensityToggle } from './density-toggle';

const labels = { label: 'Density', comfortable: 'Comfortable', compact: 'Compact' };

// renderWithProviders giờ bọc cả StoreProvider (seam) → component dùng useDensity test được.
test('mặc định comfortable; click → compact (qua facade + Redux)', async () => {
  const { user } = renderWithProviders(<DensityToggle labels={labels} />);
  const button = screen.getByRole('button');
  expect(button).toHaveTextContent('Density: Comfortable');
  expect(button).toHaveAttribute('aria-pressed', 'false');

  await user.click(button);
  expect(button).toHaveTextContent('Density: Compact');
  expect(button).toHaveAttribute('aria-pressed', 'true');
});
