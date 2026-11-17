'use client';

import { Suspense, type ReactNode } from 'react';

import { useTranslations } from 'next-intl';

import { LanguageSwitcher } from '~/components/language-switcher';
import { ThemeSwitcher } from '~/components/theme-switcher';
import { NAV_ITEMS, isCurrentPath } from '~/features/site/model/nav';
import { usePathname } from '~/i18n/navigation';
import { StaticLink } from '~/i18n/static-link';
import { siteConfig } from '~/lib/site-config';

interface SiteNavProps {
  /**
   * The account control: the layout passes AuthStatus in a Suspense boundary. It reads the session cookie, so it is a
   * dynamic hole of the static shell, and a feature does not import another feature.
   */
  account: ReactNode;
}

/**
 * The navigation bar of every page of user, S4.1 of docs/specs/SHOP-7/design.md: three pills. Left, the site name, a
 * link home; middle, the main navigation; right, the language and theme switches and the account. Under 768px the bar
 * has two rows, the name and the tools, then the navigation across the whole width; there is no hidden menu
 * (components.css, Page frame). The current section is the link with aria-current="page", which the CSS styles, so the
 * look and the accessibility tree cannot drift apart.
 *
 * A client component: usePathname of next-intl reads the path to mark the current section. On a route with a dynamic
 * param that generateStaticParams does not list, the path is not known during the prerender and the hook suspends;
 * under cacheComponents that fails the build outside a Suspense boundary (SHOP-41). So only the links read it, in a
 * boundary whose fallback is the same links with no section marked: the bar stays in the static shell, and nothing
 * moves when the mark streams in. The links are StaticLink, not the Link of next-intl, which reads the path as well.
 */
export function SiteNav({ account }: SiteNavProps) {
  const t = useTranslations('Nav');

  return (
    <header className="site-nav">
      <StaticLink className="pill pill--brand" href="/">
        {siteConfig.name}
      </StaticLink>

      <nav className="pill site-nav__links" aria-label={t('label')}>
        <Suspense fallback={<NavLinks pathname={null} />}>
          <CurrentNavLinks />
        </Suspense>
      </nav>

      <div className="pill site-nav__tools">
        <LanguageSwitcher />
        <ThemeSwitcher />
        {account}
      </div>
    </header>
  );
}

/** The links of the main navigation, with the section of the current path marked. */
function CurrentNavLinks() {
  return <NavLinks pathname={usePathname()} />;
}

/** The links of the main navigation; `pathname` null marks none. */
function NavLinks({ pathname }: { pathname: string | null }) {
  const t = useTranslations('Nav');

  return NAV_ITEMS.map((item) => (
    <StaticLink
      key={item.href}
      className="pill__link"
      href={item.href}
      aria-current={pathname !== null && isCurrentPath(pathname, item.href) ? 'page' : undefined}
    >
      {t(item.key)}
    </StaticLink>
  ));
}
