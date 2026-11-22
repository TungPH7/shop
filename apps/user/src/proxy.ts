import createMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';

import en from '../messages/en.json';
import vi from '../messages/vi.json';

import { env } from '~/config/env/server';
import { isLocale, type Locale } from '~/config/i18n';
import { routing } from '~/i18n/routing';
import { isStoreSlug } from '~/lib/validation/store-slug';

/**
 * Proxy: Next 16 renamed `middleware.ts` to `proxy.ts` (next-intl supports it: "proxy.ts was called middleware.ts up
 * until Next.js 16", same content). Two jobs:
 *
 * 1. Locale routing with the **middleware of next-intl** (`createMiddleware`, folder 09): it negotiates the locale from
 *    `Accept-Language`, redirects a URL without a locale (`/` → `/en`), remembers the choice in a cookie and adds the
 *    alternate links for SEO.
 * 2. The real 404 of the product detail page (AC26, `proxy` below): on each page load of
 *    `/{locale}/products/{slug}`, it sends `HEAD /api/products/{slug}` to the api (at most 5 s) before the render. The
 *    same for the category page of SHOP-81 (AC16): `/{locale}/categories/{slug}`, with `HEAD /api/categories/{slug}`.
 *
 * ⚠️ Not a security boundary (CVE-2025-29927): the real authorization is checked in the DAL (folder 11/15).
 * Node runtime; no database; only one HEAD with a time limit, and only for a page load of a product or category page.
 */
const intl = createMiddleware(routing);

/** Time limit of the check of a slug (NFR26 of SHOP-7), as every request of the DAL. */
const CHECK_TIMEOUT_MS = 5000;

/** The request header next-intl sets on every request it forwards (`HEADER_LOCALE_NAME`, not exported). */
const LOCALE_HEADER = 'X-NEXT-INTL-LOCALE';

/**
 * The pages whose slug the api checks before the render, each with the path of the api that checks it and the route that
 * shows its S6 with 404: the product detail page S5 of SHOP-7 (`/{locale}/products/{slug}`) and the category page S5
 * of SHOP-81 (`/{locale}/categories/{slug}`, plan of SHOP-81, Architecture Decisions 10). One segment after the
 * section, no more.
 */
const CHECKED_PAGES = [
  {
    path: /^\/([^/]+)\/products\/([^/]+)\/?$/,
    api: '/api/products',
    notFound: 'product-not-found',
  },
  {
    path: /^\/([^/]+)\/categories\/([^/]+)\/?$/,
    api: '/api/categories',
    notFound: 'category-not-found',
  },
] as const;

type CheckedPage = (typeof CHECKED_PAGES)[number];

/**
 * The real 404 of the product detail page (AC26; plan of SHOP-7, Architecture Decisions 9), and of the category page
 * (AC16 of SHOP-81, with `HEAD /api/categories/{slug}` and `/{locale}/category-not-found`). With Cache Components the
 * page sends its shell with 200 before it reads the product, so a `notFound()` there can no longer change the status.
 * So on a page load the Proxy asks the api first, with `HEAD /api/products/{slug}`:
 *
 * - 200: the request goes on to next-intl, as every other page;
 * - 404, the same for a slug that never existed, a hidden product and a deleted one (NFR9): a rewrite to
 *   `/{locale}/product-not-found`, a page that calls `notFound()` when prerendered, so it keeps 404 and shows S6;
 * - any other answer, no answer or past 5 s: 503 with a short page in the language of the path, never a 404 a search
 *   engine would drop (NFR26).
 *
 * A client navigation or a prefetch goes straight to the page, whose `notFound()` shows the same S6: its status means
 * nothing to a browser, and the 24 prefetches of S4 do not become 24 requests to the api. Next strips the header `RSC`
 * from the request the Proxy sees (docs of Proxy, "RSC requests and rewrites"), so such a request is told apart by the
 * Fetch Metadata of the browser: the router fetches (`Sec-Fetch-Dest: empty`), a page load is a `document`. A request
 * with no Fetch Metadata, as from a crawler or curl, is checked like a page load.
 */
export default async function proxy(request: NextRequest): Promise<NextResponse> {
  const checked = checkedPageOf(request);
  if (!checked) return intl(request);

  const { page, locale, slug } = checked;
  const status = isStoreSlug(slug) ? await checkSlug(page, slug) : 404;
  if (status === 200) return intl(request);
  if (status === 404) {
    // As next-intl forwards every request: the not-found tree reads the locale from this header, not from the layout.
    const headers = new Headers(request.headers);
    headers.set(LOCALE_HEADER, locale);
    return NextResponse.rewrite(new URL(`/${locale}/${page.notFound}`, request.url), {
      request: { headers },
    });
  }
  return unavailable(locale);
}

/**
 * The checked page, the locale and the slug of a page load of a product or a category page, or null for any other
 * request.
 */
function checkedPageOf(
  request: NextRequest,
): { page: CheckedPage; locale: Locale; slug: string } | null {
  const dest = request.headers.get('sec-fetch-dest');
  if (dest !== null && dest !== 'document') return null;
  for (const page of CHECKED_PAGES) {
    const [, locale = '', segment = ''] = page.path.exec(request.nextUrl.pathname) ?? [];
    if (isLocale(locale)) return { page, locale, slug: decodeSegment(segment) };
  }
  return null;
}

/** The segment as the page reads it in `params`; a malformed escape such as `%E0` is no slug. */
function decodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return '';
  }
}

/**
 * The status the api answers for the product or the category of `slug`, or 0 when it gives no answer within the time
 * limit. Never cached (NFR6 of SHOP-81).
 */
async function checkSlug(page: CheckedPage, slug: string): Promise<number> {
  try {
    const response = await fetch(new URL(`${page.api}/${slug}`, env.API_URL), {
      method: 'HEAD',
      signal: AbortSignal.timeout(CHECK_TIMEOUT_MS),
      cache: 'no-store',
    });
    return response.status;
  } catch {
    return 0;
  }
}

const UNAVAILABLE: Record<Locale, { title: string; description: string }> = {
  en: en.ProductUnavailable,
  vi: vi.ProductUnavailable,
};

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char] ?? char);

/** 503 with a short page of its own: the api is down, so the app cannot render one. Never cached (NFR26). */
function unavailable(locale: Locale): NextResponse {
  const title = escapeHtml(UNAVAILABLE[locale].title);
  const description = escapeHtml(UNAVAILABLE[locale].description);
  const html = `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex"><title>${title}</title><style>body{margin:0;padding:4rem 1rem;font-family:system-ui,sans-serif;color-scheme:light dark}main{max-width:36rem;margin:0 auto}</style></head><body><main><h1>${title}</h1><p>${description}</p></main></body></html>`;
  return new NextResponse(html, {
    status: 503,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'Retry-After': '30',
    },
  });
}

export const config = {
  matcher: [
    // Every page, as next-intl recommends: not the internals of Next, and no path with a dot, an asset (.css, .png…).
    '/((?!api|_next|_vercel|.*\\..*).*)',
    // The product detail page even with a dot, as `/vi/products/ao-thun.` pasted with the full stop of a sentence:
    // without it, such a path skipped the Proxy and showed S6 with 200 instead of 404 (AC26, review of PR #51).
    '/(en|vi)/products/:slug',
    // The category page too, for the same reason (AC16 of SHOP-81).
    '/(en|vi)/categories/:slug',
  ],
};
