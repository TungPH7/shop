import { afterEach, expect, test, vi } from 'vitest';

import { AppError } from '~/lib/errors/app-error';
import { ApiError } from '~/lib/http/api-error';
import { captureError } from '~/lib/monitoring/capture-error';
import {
  configureMonitoring,
  type MonitoringTransport,
  resetMonitoring,
} from '~/lib/monitoring/monitoring';

afterEach(() => {
  resetMonitoring();
});

function fakeTransport() {
  return {
    captureException: vi.fn(),
    captureMessage: vi.fn(),
    setUser: vi.fn(),
    addBreadcrumb: vi.fn(),
  } satisfies MonitoringTransport;
}

test('normalizes a plain Error to AppError(unexpected) and tags the kind on context', () => {
  const transport = fakeTransport();
  configureMonitoring(transport);

  captureError(new Error('boom'), { source: 'react-error-boundary' });

  expect(transport.captureException).toHaveBeenCalledWith(
    expect.any(AppError),
    expect.objectContaining({ source: 'react-error-boundary', kind: 'unexpected' }),
  );
});

test('maps an ApiError(404) to kind not_found via normalizeError (folder 17)', () => {
  const transport = fakeTransport();
  configureMonitoring(transport);

  captureError(new ApiError({ kind: 'http', status: 404, message: 'missing' }), {
    source: 'instrumentation',
  });

  expect(transport.captureException).toHaveBeenCalledWith(
    expect.any(AppError),
    expect.objectContaining({ source: 'instrumentation', kind: 'not_found' }),
  );
});
