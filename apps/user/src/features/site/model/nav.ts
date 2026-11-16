/**
 * The main navigation of user, S4.1 of docs/specs/SHOP-7/design.md: the three pages every visitor can reach. `key` is
 * the message of the `Nav` namespace; `href` has no locale, the Link of next-intl adds it.
 */
export const NAV_ITEMS = [
  { key: 'home', href: '/' },
  { key: 'products', href: '/products' },
  { key: 'about', href: '/about' },
] as const;

export type NavItem = (typeof NAV_ITEMS)[number];

/**
 * Whether `pathname` (without the locale, as usePathname of next-intl gives it) is in the section of `href`: Home only
 * on itself, any other section on itself and the pages below it, so Products stays current on a product page.
 */
export function isCurrentPath(pathname: string, href: string): boolean {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  if (href === '/') return path === '/';
  return path === href || path.startsWith(`${href}/`);
}
