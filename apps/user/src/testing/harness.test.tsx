import { useState } from 'react';

import { http, HttpResponse } from 'msw';
import { expect, test } from 'vitest';

import { server } from './msw/server';
import { renderWithProviders, screen } from './render';

// Chứng minh "đường ống" harness chạy đủ các mảnh: jsdom + RTL render + jest-dom
// matcher + user-event (tương tác) + MSW (chặn network ở boundary).

function Counter() {
  const [n, setN] = useState(0);
  return <button onClick={() => setN((v) => v + 1)}>count: {n}</button>;
}

test('render + jest-dom + user-event: click cập nhật UI', async () => {
  const { user } = renderWithProviders(<Counter />);
  const button = screen.getByRole('button', { name: 'count: 0' });
  expect(button).toBeInTheDocument();

  await user.click(button);

  expect(screen.getByRole('button', { name: 'count: 1' })).toBeInTheDocument();
});

test('MSW chặn network qua server.use (handler per-test)', async () => {
  server.use(http.get('https://example.test/ping', () => HttpResponse.json({ ok: true })));

  const res = await fetch('https://example.test/ping');
  const body = (await res.json()) as { ok: boolean };

  expect(res.status).toBe(200);
  expect(body).toEqual({ ok: true });
});
