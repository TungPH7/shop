import { revalidateTag } from 'next/cache';
import { describe, expect, it, vi } from 'vitest';

import { POST } from './route';

vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }));

function post(headers: Record<string, string>): Request {
  return new Request('http://localhost:3000/api/revalidate', { method: 'POST', headers });
}

// The route has no session: only a page of this site may call it, which the browser proves with the Origin header of a
// POST. The host is the one the browser asked for, which the proxy in front keeps.
describe('POST /api/revalidate', () => {
  it('revalidates the demo tag for a page of this site', async () => {
    const response = POST(post({ origin: 'https://shop.example.test', host: 'shop.example.test' }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ revalidated: true, tag: 'caching-demo' });
    expect(revalidateTag).toHaveBeenCalledWith('caching-demo', 'max');
  });

  it('refuses a call from another site', () => {
    const response = POST(post({ origin: 'https://evil.example.test', host: 'shop.example.test' }));

    expect(response.status).toBe(403);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it('refuses a call without an Origin header, as from a script outside a browser', () => {
    const response = POST(post({ host: 'shop.example.test' }));

    expect(response.status).toBe(403);
    expect(revalidateTag).not.toHaveBeenCalled();
  });

  it('refuses an Origin header that is not a URL', () => {
    const response = POST(post({ origin: 'null', host: 'shop.example.test' }));

    expect(response.status).toBe(403);
    expect(revalidateTag).not.toHaveBeenCalled();
  });
});
