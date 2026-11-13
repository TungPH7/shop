import { afterEach, expect, test, vi } from 'vitest';

import { AppError } from '~/lib/errors/app-error';
import { ApiError } from '~/lib/http/api-error';
import {
  configureMonitoring,
  type MonitoringTransport,
  resetMonitoring,
} from '~/lib/monitoring/monitoring';

import { onRequestError, register } from '~/instrumentation';

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

test('register boot-logs without throwing (resolves)', async () => {
  // register giờ async (folder 20: có thể `await import` pino ở runtime nodejs). Trong test
  // NEXT_RUNTIME không set → bỏ qua nhánh pino → chỉ boot-log → resolves undefined.
  await expect(register()).resolves.toBeUndefined();
});

test('onRequestError forwards a normalized error + route context to the monitoring seam', async () => {
  const transport = fakeTransport();
  configureMonitoring(transport);

  // onRequestError được khai `void | Promise<void>` (type của Next) → await để hợp no-floating-promises.
  await onRequestError(
    new ApiError({ kind: 'http', status: 404, message: 'missing' }),
    { path: '/products', method: 'GET', headers: {} },
    {
      routerKind: 'App Router',
      routePath: '/products',
      routeType: 'render',
      renderSource: 'react-server-components',
      revalidateReason: undefined,
    },
  );

  expect(transport.captureException).toHaveBeenCalledWith(
    expect.any(AppError),
    expect.objectContaining({
      source: 'instrumentation',
      path: '/products',
      routeType: 'render',
      kind: 'not_found',
    }),
  );
});
