import { http, HttpResponse } from 'msw';

// Default happy-path API handlers. Wildcard origins (`*/path`) match regardless
// of the configured base URL. Shapes match the Zod models (folders 07/10) so the
// api layer's boundary validation passes. Tests override per-case via
// `server.use(...)`.
export const handlers = [
  http.get('*/products', () =>
    HttpResponse.json([
      { id: 'p-001', name: 'Test Widget', priceCents: 1999, inStock: true },
      { id: 'p-002', name: 'Test Gadget', priceCents: 4500, inStock: false },
    ]),
  ),
  http.get('*/products/:id', ({ params }) =>
    HttpResponse.json({
      id: String(params['id']),
      name: 'Test Widget',
      priceCents: 1999,
      inStock: true,
    }),
  ),
  http.get('*/profile', () =>
    HttpResponse.json({
      id: 1,
      email: 'test@example.com',
      name: 'Tester',
      role: { id: 1, name: 'admin', permissions: [] },
    }),
  ),
  http.post('*/auth/login', () =>
    HttpResponse.json({ accessToken: 'test-access', refreshToken: 'test-refresh' }),
  ),
  http.post('*/products', () =>
    HttpResponse.json({ id: 'p-new', name: 'Created Widget', priceCents: 500, inStock: true }),
  ),
  http.put('*/products/:id', async ({ params, request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    return HttpResponse.json({ id: String(params['id']), ...body });
  }),
  http.delete('*/products/:id', () => new HttpResponse(null, { status: 204 })),
];
