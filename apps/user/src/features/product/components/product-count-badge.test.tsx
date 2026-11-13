import { http, HttpResponse } from 'msw';
import { expect, test } from 'vitest';

import { QueryProvider } from '~/lib/query/query-provider';
import { server } from '~/testing/msw/server';
import { renderWithProviders, screen, waitFor } from '~/testing/render';

import { ProductCountBadge } from './product-count-badge';

const labels = { total: 'Total', loading: 'Loading', error: 'Error', refresh: 'Refresh' };

// Dùng QueryProvider (facade S2) + MSW mock `/api/products/count` → test client server-state thật.
test('loading → hiện count sau khi fetch (TanStack + MSW)', async () => {
  server.use(http.get('/api/products/count', () => HttpResponse.json({ count: 42 })));

  renderWithProviders(
    <QueryProvider>
      <ProductCountBadge labels={labels} />
    </QueryProvider>,
  );

  expect(screen.getByText(/Loading/)).toBeInTheDocument();
  await waitFor(() => expect(screen.getByText(/Total: 42/)).toBeInTheDocument());
});
