// @vitest-environment node
// The Proxy reads env.API_URL, a server variable: node, as client.test.ts. MSW answers the HEAD at the network boundary.
import { http, HttpResponse } from 'msw';
import {
  getRewrittenUrl,
  isRewrite,
  unstable_doesMiddlewareMatch,
} from 'next/experimental/testing/server';
import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { server } from '~/testing/msw/server';

import proxy, { config } from './proxy';

// The middleware of next-intl is a seam: the test checks the Proxy hands a request to it, not what next-intl then does.
const { intl } = vi.hoisted(() => ({ intl: vi.fn() }));
vi.mock('next-intl/middleware', () => ({ default: () => intl }));

const SITE = 'https://shop.example.test';
const API = 'https://api.example.test';

const pageLoad = (path: string, headers: Record<string, string> = {}) =>
  new NextRequest(`${SITE}${path}`, { headers });

/** Answers the HEAD of `slug` with `status`, and counts the calls. */
function headAnswers(slug: string, status: number) {
  const calls = { count: 0 };
  server.use(
    http.head(`${API}/api/products/${slug}`, () => {
      calls.count += 1;
      return new HttpResponse(null, { status });
    }),
  );
  return calls;
}

let forwarded: NextResponse;

beforeEach(() => {
  forwarded = NextResponse.next();
  intl.mockReturnValue(forwarded);
});

describe('a page load of the product detail page', () => {
  test('hands the request to next-intl when the api has the product (200)', async () => {
    const calls = headAnswers('ao-thun-co-tron', 200);
    const request = pageLoad('/vi/products/ao-thun-co-tron');

    const response = await proxy(request);

    expect(calls.count).toBe(1);
    expect(intl).toHaveBeenCalledWith(request);
    expect(response).toBe(forwarded);
  });

  test('checks a page load of a browser (Sec-Fetch-Dest: document)', async () => {
    const calls = headAnswers('khong-co', 404);

    const response = await proxy(
      pageLoad('/vi/products/khong-co', { 'Sec-Fetch-Dest': 'document' }),
    );

    expect(calls.count).toBe(1);
    expect(getRewrittenUrl(response)).toBe(`${SITE}/vi/product-not-found`);
  });

  test.each(['vi', 'en'])(
    'rewrites to /%s/product-not-found when the api answers 404',
    async (locale) => {
      headAnswers('khong-co', 404);

      const response = await proxy(pageLoad(`/${locale}/products/khong-co`));

      expect(isRewrite(response)).toBe(true);
      expect(getRewrittenUrl(response)).toBe(`${SITE}/${locale}/product-not-found`);
      // The locale header next-intl sets on every request it forwards: the not-found tree reads its locale there.
      expect(response.headers.get('x-middleware-request-x-next-intl-locale')).toBe(locale);
      expect(intl).not.toHaveBeenCalled();
    },
  );

  test('rewrites a slug the api cannot hold to S6 without asking the api', async () => {
    const response = await proxy(pageLoad('/vi/products/%C3%A1o-thun'));

    expect(getRewrittenUrl(response)).toBe(`${SITE}/vi/product-not-found`);
  });

  test('rewrites a malformed escape in the slug to S6 without asking the api', async () => {
    const response = await proxy(pageLoad('/en/products/%E0%A4%A'));

    expect(getRewrittenUrl(response)).toBe(`${SITE}/en/product-not-found`);
  });

  test('asks the api with HEAD, within a time limit of 5 s', async () => {
    const timeout = vi.spyOn(AbortSignal, 'timeout');
    let method = '';
    server.use(
      http.all(`${API}/api/products/ao-thun-co-tron`, ({ request }) => {
        method = request.method;
        return new HttpResponse(null, { status: 200 });
      }),
    );

    await proxy(pageLoad('/vi/products/ao-thun-co-tron'));

    expect(method).toBe('HEAD');
    expect(timeout).toHaveBeenCalledWith(5000);
  });

  test.each([
    ['vi', 'Tạm thời không tải được sản phẩm'],
    ['en', "We couldn't load this product right now"],
  ])('answers 503 with a short page in %s when the api answers 500', async (locale, title) => {
    headAnswers('ao-thun-co-tron', 500);

    const response = await proxy(pageLoad(`/${locale}/products/ao-thun-co-tron`));

    expect(response.status).toBe(503);
    expect(response.headers.get('Retry-After')).toBe('30');
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(response.headers.get('Content-Type')).toBe('text/html; charset=utf-8');
    const html = await response.text();
    expect(html).toContain(`<html lang="${locale}">`);
    expect(html).toContain(`<h1>${title.replace("'", '&#39;')}</h1>`);
    expect(intl).not.toHaveBeenCalled();
  });

  test('answers 503 when the api does not answer within 5 s', async () => {
    vi.spyOn(AbortSignal, 'timeout').mockReturnValue(
      AbortSignal.abort(new DOMException('The operation timed out.', 'TimeoutError')),
    );
    headAnswers('ao-thun-co-tron', 200);

    const response = await proxy(pageLoad('/en/products/ao-thun-co-tron'));

    expect(response.status).toBe(503);
    expect(response.headers.get('Retry-After')).toBe('30');
  });

  test('answers 503 when the api cannot be reached', async () => {
    server.use(http.head(`${API}/api/products/ao-thun-co-tron`, () => HttpResponse.error()));

    const response = await proxy(pageLoad('/en/products/ao-thun-co-tron'));

    expect(response.status).toBe(503);
  });
});

describe('requests the Proxy does not check', () => {
  // Next strips the Flight headers (RSC, Next-Router-Prefetch) from the request the Proxy sees, so a client navigation
  // or a prefetch is told apart by the Fetch Metadata of the browser: the router fetches, a page load is a document.
  test.each(['empty', 'script'])(
    'a fetch of the browser (Sec-Fetch-Dest: %s), as a client navigation, goes to next-intl without asking the api',
    async (dest) => {
      const calls = headAnswers('khong-co', 404);
      const request = pageLoad('/vi/products/khong-co', { 'Sec-Fetch-Dest': dest });

      const response = await proxy(request);

      expect(calls.count).toBe(0);
      expect(response).toBe(forwarded);
    },
  );

  test.each(['/vi/products', '/en', '/', '/vi/products/a/b', '/fr/products/ao-thun', '/vi/about'])(
    '%s goes to next-intl without asking the api',
    async (path) => {
      const request = pageLoad(path);

      const response = await proxy(request);

      expect(intl).toHaveBeenCalledWith(request);
      expect(response).toBe(forwarded);
    },
  );
});

describe('the paths the Proxy runs on', () => {
  const runsOn = (url: string) => unstable_doesMiddlewareMatch({ config, url });

  test.each(['/vi/products/ao-thun.', '/en/products/ao-thun.html', '/vi/products/v1.2'])(
    'runs on the product page %s, though it has a dot, so it answers 404 for a slug that is no product (AC26)',
    (path) => {
      expect(runsOn(path)).toBe(true);
    },
  );

  test.each(['/vi/products', '/vi/products/ao-thun', '/en', '/vi/about'])(
    'runs on the page %s',
    (path) => {
      expect(runsOn(path)).toBe(true);
    },
  );

  test.each([
    '/favicon.ico',
    '/robots.txt',
    '/_next/static/chunks/main.js',
    '/api/health',
    '/vi/logo.png',
  ])('leaves out %s, an asset or a route of its own', (path) => {
    expect(runsOn(path)).toBe(false);
  });
});

describe('a product path with a dot', () => {
  test('rewrites to S6 without asking the api, since a slug has no dot', async () => {
    const response = await proxy(pageLoad('/vi/products/ao-thun.'));

    expect(getRewrittenUrl(response)).toBe(`${SITE}/vi/product-not-found`);
    expect(intl).not.toHaveBeenCalled();
  });
});

describe('a page load of the category page (SHOP-81)', () => {
  /** Answers the HEAD of the category `slug` with `status`, and counts the calls. */
  function categoryHeadAnswers(slug: string, status: number) {
    const calls = { count: 0 };
    server.use(
      http.head(`${API}/api/categories/${slug}`, () => {
        calls.count += 1;
        return new HttpResponse(null, { status });
      }),
    );
    return calls;
  }

  test('hands the request to next-intl when the api has the category (200)', async () => {
    const calls = categoryHeadAnswers('ao', 200);
    const request = pageLoad('/vi/categories/ao?sort=price-asc&page=2');

    const response = await proxy(request);

    expect(calls.count).toBe(1);
    expect(intl).toHaveBeenCalledWith(request);
    expect(response).toBe(forwarded);
  });

  test('asks the api about the slug as typed, which compares it without case (AC18)', async () => {
    const calls = categoryHeadAnswers('AO', 200);

    await proxy(pageLoad('/vi/categories/AO'));

    expect(calls.count).toBe(1);
  });

  test.each(['vi', 'en'])(
    'rewrites to /%s/category-not-found when the api answers 404, the same for a slug that never existed, a hidden and a deleted category (AC16)',
    async (locale) => {
      categoryHeadAnswers('khong-co', 404);

      const response = await proxy(pageLoad(`/${locale}/categories/khong-co`));

      expect(isRewrite(response)).toBe(true);
      expect(getRewrittenUrl(response)).toBe(`${SITE}/${locale}/category-not-found`);
      expect(response.headers.get('x-middleware-request-x-next-intl-locale')).toBe(locale);
      expect(intl).not.toHaveBeenCalled();
    },
  );

  // A `..` segment, even escaped as `%2E%2E`, is resolved away by the URL itself before the Proxy sees the path; an
  // escaped `/` is not, and comes to the Proxy as part of the slug.
  test.each(['..%2Fadmin%2Fcategories', '%2F', '%E0', '%C3%A1o'])(
    'rewrites the slug %s to S6 without asking the api (NFR9)',
    async (segment) => {
      // MSW fails the test on any request without a handler (onUnhandledRequest: 'error').
      const response = await proxy(pageLoad(`/vi/categories/${segment}`));

      expect(getRewrittenUrl(response)).toBe(`${SITE}/vi/category-not-found`);
      expect(intl).not.toHaveBeenCalled();
    },
  );

  test('asks the api with HEAD only, within a time limit of 5 s (NFR7, NFR20)', async () => {
    const timeout = vi.spyOn(AbortSignal, 'timeout');
    const asked: { method: string }[] = [];
    server.use(
      http.all(`${API}/api/categories/ao`, ({ request }) => {
        asked.push({ method: request.method });
        return new HttpResponse(null, { status: 200 });
      }),
    );

    await proxy(pageLoad('/vi/categories/ao'));

    expect(asked.map(({ method }) => method)).toEqual(['HEAD']);
    expect(timeout).toHaveBeenCalledWith(5000);
  });

  test.each([
    ['vi', 'Tạm thời không tải được sản phẩm'],
    ['en', "We couldn't load this product right now"],
  ])(
    'answers 503 with a short page in %s when the api answers 500 (NFR20)',
    async (locale, title) => {
      categoryHeadAnswers('ao', 500);

      const response = await proxy(pageLoad(`/${locale}/categories/ao`));

      expect(response.status).toBe(503);
      expect(response.headers.get('Retry-After')).toBe('30');
      expect(response.headers.get('Cache-Control')).toBe('no-store');
      const html = await response.text();
      expect(html).toContain(`<html lang="${locale}">`);
      expect(html).toContain(`<h1>${title.replace("'", '&#39;')}</h1>`);
      expect(intl).not.toHaveBeenCalled();
    },
  );

  test('answers 503 when the api does not answer within 5 s, never a 404 (NFR20)', async () => {
    vi.spyOn(AbortSignal, 'timeout').mockReturnValue(
      AbortSignal.abort(new DOMException('The operation timed out.', 'TimeoutError')),
    );
    categoryHeadAnswers('ao', 200);

    const response = await proxy(pageLoad('/en/categories/ao'));

    expect(response.status).toBe(503);
  });

  test.each(['empty', 'script'])(
    'a fetch of the browser (Sec-Fetch-Dest: %s), as a prefetch of a link of S7, goes to next-intl without asking the api',
    async (dest) => {
      const calls = categoryHeadAnswers('ao', 200);

      const response = await proxy(pageLoad('/vi/categories/ao', { 'Sec-Fetch-Dest': dest }));

      expect(calls.count).toBe(0);
      expect(response).toBe(forwarded);
    },
  );

  test.each(['/vi/categories', '/vi/categories/ao/products', '/fr/categories/ao'])(
    '%s goes to next-intl without asking the api',
    async (path) => {
      const request = pageLoad(path);

      const response = await proxy(request);

      expect(intl).toHaveBeenCalledWith(request);
      expect(response).toBe(forwarded);
    },
  );

  test.each(['/vi/categories/ao', '/en/categories/ao.', '/vi/categories/ao.html'])(
    'runs on the category page %s, even with a dot',
    (path) => {
      expect(unstable_doesMiddlewareMatch({ config, url: path })).toBe(true);
    },
  );

  test('rewrites a category path with a dot to S6 without asking the api, since a slug has no dot', async () => {
    const response = await proxy(pageLoad('/vi/categories/ao.'));

    expect(getRewrittenUrl(response)).toBe(`${SITE}/vi/category-not-found`);
  });
});
