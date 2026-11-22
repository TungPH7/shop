/**
 * The main navigation of user, S4.1 of docs/specs/SHOP-7/design.md: the three pages every visitor can reach. `key` is
 * the message of the `Nav` namespace; `href` has no locale, StaticLink adds it through getPathname (SHOP-41).
 */
export const NAV_ITEMS = [
  { key: 'home', href: '/' },
  { key: 'products', href: '/products' },
  { key: 'about', href: '/about' },
] as const;

/**
 * Pages of a section outside its path. S6 is served at the address of the product, `/products/{slug}`, but the Proxy
 * rewrites it to `/product-not-found`, and that is the path the prerender of S6 reads (SHOP-24). The pages of a
 * category (`/categories/{slug}`) and their S6 (`/category-not-found`) are a part of the store of products too, so
 * Products stays current there (design.md of SHOP-81, S5.1 and S6.1).
 */
const SECTION_PAGES: Partial<Record<string, readonly string[]>> = {
  '/products': ['/product-not-found', '/categories', '/category-not-found'],
};

/**
 * Whether `pathname` (without the locale, as usePathname of next-intl gives it) is in the section of `href`: Home only
 * on itself, any other section on itself, the pages below it and its pages elsewhere, so Products stays current on a
 * product page and on S6. A trailing slash needs no stripping: '/about/' is below '/about'.
 */
export function isCurrentPath(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  const paths = [href, ...(SECTION_PAGES[href] ?? [])];
  return paths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}
