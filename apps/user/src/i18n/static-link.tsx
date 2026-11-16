'use client';

import { type ComponentProps } from 'react';

import { useLocale } from 'next-intl';
import NextLink from 'next/link';

import { getPathname } from '~/i18n/navigation';

type StaticLinkProps = Omit<ComponentProps<typeof NextLink>, 'href'> & {
  /** The path without the locale, as for the Link of next-intl: '/products'. */
  href: string;
};

/**
 * A link to a page of the current locale that does not read the path: next/link with the href of getPathname.
 *
 * The Link of `~/i18n/navigation` calls usePathname of Next on every render, only to keep the locale cookie in step when
 * a link switches the locale. On a route with a dynamic param that generateStaticParams does not list, that hook
 * suspends the prerender, and under cacheComponents a suspension outside a Suspense boundary fails the build (SHOP-41).
 * The frame of every page, the navigation bar of the root layout, is outside any boundary, so its links are StaticLink.
 * Use the Link of next-intl everywhere else, and to switch the locale.
 */
export function StaticLink({ href, ...props }: StaticLinkProps) {
  const locale = useLocale();

  return <NextLink href={getPathname({ href, locale })} {...props} />;
}
