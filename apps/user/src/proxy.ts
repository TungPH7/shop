import createMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';

import en from '../messages/en.json';
import vi from '../messages/vi.json';

import { env } from '~/config/env/server';
import { isLocale, type Locale } from '~/config/i18n';
import { isStoreSlug } from '~/features/product/model/product';
import { routing } from '~/i18n/routing';

/**
 * Proxy — **Next 16** đổi tên `middleware.ts` → `proxy.ts` (next-intl hỗ trợ chính thức:
 * "proxy.ts was called middleware.ts up until Next.js 16", nội dung file y hệt).
 *
 * Folder 09 THAY redirect i18n viết tay của folder 08 bằng **middleware của next-intl**
 * (`createMiddleware`) — lo: thương lượng locale theo `Accept-Language`, redirect URL
 * thiếu locale (`/` → `/en`), nhớ lựa chọn qua cookie, sinh alternate-links cho SEO.
 *
 * ⚠️ KHÔNG phải security boundary (CVE-2025-29927): chỉ định tuyến i18n; authz THẬT
 * verify ở DAL (folder 11/15). Node runtime; không DB/logic nặng.
 */
const intl = createMiddleware(routing);

/** Time limit of the check of a slug (NFR26 of SHOP-7), as every request of the DAL. */
const CHECK_TIMEOUT_MS = 5000;

/** `/{locale}/products/{slug}`, the product detail page S5; one segment after products, no more. */
const PRODUCT_PATH = /^\/([^/]+)\/products\/([^/]+)\/?$/;

/**
 * The real 404 of the product detail page (AC26; plan of SHOP-7, Architecture Decisions 9). With Cache Components the
 * page sends its shell with 200 before it reads the product, so a `notFound()` there can no longer change the status.
 * So on a page load the Proxy asks the api first, with `HEAD /api/products/{slug}`:
 *
 * - 200: the request goes on to next-intl, as every other page;
 * - 404, the same for a slug that never existed, a hidden product and a deleted one (NFR9): a rewrite to
 *   `/{locale}/product-not-found`, a page that calls `notFound()` when prerendered, so it keeps 404 and shows S6;
 * - any other answer, no answer or past 5 s: 503 with a short page in the language of the path, never a 404 a search
 *   engine would drop (NFR26).
 *
 * A client navigation or a prefetch has the header `RSC`: its status means nothing to a browser, so it goes straight to
 * the page, whose `notFound()` shows the same S6. That also keeps the 24 prefetches of S4 from becoming 24 requests to
 * the api.
 */
export default async function proxy(request: NextRequest): Promise<NextResponse> {
  const product = productOf(request);
  if (!product) return intl(request);

  const { locale, slug } = product;
  const status = isStoreSlug(slug) ? await checkProduct(slug) : 404;
  if (status === 200) return intl(request);
  if (status === 404) {
    return NextResponse.rewrite(new URL(`/${locale}/product-not-found`, request.url));
  }
  return unavailable(locale);
}

/** The locale and the slug of a page load of the product detail page, or null for any other request. */
function productOf(request: NextRequest): { locale: Locale; slug: string } | null {
  if (request.headers.has('rsc')) return null;
  const [, locale = '', segment = ''] = PRODUCT_PATH.exec(request.nextUrl.pathname) ?? [];
  if (!isLocale(locale)) return null;
  return { locale, slug: decodeSegment(segment) };
}

/** The segment as the page reads it in `params`; a malformed escape such as `%E0` is no slug. */
function decodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return '';
  }
}

/** The status the api answers for the product of `slug`, or 0 when it gives no answer within the time limit. */
async function checkProduct(slug: string): Promise<number> {
  try {
    const response = await fetch(new URL(`/api/products/${slug}`, env.API_URL), {
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
  // Bỏ qua nội bộ Next + mọi path có dấu chấm (asset: .css/.js/.png/...) → proxy chỉ
  // chạy trên route trang. (Matcher khuyến nghị của next-intl.)
  matcher: '/((?!api|_next|_vercel|.*\\..*).*)',
};
