import { NuqsTestingAdapter } from 'nuqs/adapters/testing';
import { expect, test } from 'vitest';

import { renderWithProviders, screen, waitFor } from '~/testing/render';

import { ViewToggle } from './view-toggle';

const labels = { label: 'View', list: 'List', grid: 'Grid' };

// `NuqsTestingAdapter` cấp context searchParams in-memory cho test (không cần router thật).
test('mặc định list; click Grid → đổi URL state (aria-pressed)', async () => {
  const { user } = renderWithProviders(
    <NuqsTestingAdapter>
      <ViewToggle labels={labels} />
    </NuqsTestingAdapter>,
  );

  expect(screen.getByRole('button', { name: 'List' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('button', { name: 'Grid' })).toHaveAttribute('aria-pressed', 'false');

  await user.click(screen.getByRole('button', { name: 'Grid' }));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Grid' })).toHaveAttribute('aria-pressed', 'true'),
  );
});
