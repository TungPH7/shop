import { http, HttpResponse } from 'msw';

// Default happy-path API handlers. Wildcard origins (`*/path`) match regardless
// of the configured base URL. Shapes match the Zod models (folders 07/10) so the
// api layer's boundary validation passes. Tests override per-case via
// `server.use(...)`.
export const handlers = [
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
];
