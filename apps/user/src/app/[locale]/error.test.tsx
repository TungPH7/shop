import { expect, test, vi } from 'vitest';

import { renderWithProviders, screen } from '~/testing/render';

import LocaleError from './error';

// The error boundary of [locale]: the error state of the product list S4.5 from US5a (SHOP-25), "Đã xảy ra lỗi" with a
// "Thử lại" button, when the api fails, cannot be reached or takes more than 5 s (NFR26).
vi.mock('~/lib/monitoring/capture-error', () => ({ captureError: vi.fn() }));

test('shows "Đã xảy ra lỗi" as an alert with a Thử lại button', () => {
  renderWithProviders(<LocaleError error={new Error('api down')} unstable_retry={vi.fn()} />, {
    locale: 'vi',
  });

  expect(screen.getByRole('alert')).toHaveTextContent('Đã xảy ra lỗi');
  expect(screen.getByRole('button', { name: 'Thử lại' })).toBeVisible();
});

test('Thử lại renders the page again', async () => {
  const retry = vi.fn();
  const { user } = renderWithProviders(
    <LocaleError error={new Error('api down')} unstable_retry={retry} />,
    { locale: 'vi' },
  );

  await user.click(screen.getByRole('button', { name: 'Thử lại' }));

  expect(retry).toHaveBeenCalledOnce();
});

test('reports the error with its digest', async () => {
  const { captureError } = await import('~/lib/monitoring/capture-error');
  const error = Object.assign(new Error('api down'), { digest: 'd-1' });

  renderWithProviders(<LocaleError error={error} unstable_retry={vi.fn()} />);

  expect(captureError).toHaveBeenCalledWith(error, {
    source: 'react-error-boundary',
    digest: 'd-1',
  });
});
