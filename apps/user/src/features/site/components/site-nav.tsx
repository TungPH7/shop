'use client';

import { type ReactNode } from 'react';

import { useTranslations } from 'next-intl';

import { LanguageSwitcher } from '~/components/language-switcher';
import { ThemeSwitcher } from '~/components/theme-switcher';
import { NAV_ITEMS, isCurrentPath } from '~/features/site/model/nav';
import { Link, usePathname } from '~/i18n/navigation';
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
 * A client component: usePathname of next-intl reads the path on the client to mark the current section.
 */
export function SiteNav({ account }: SiteNavProps) {
  const t = useTranslations('Nav');
  const pathname = usePathname();

  return (
    <header className="site-nav">
      <Link className="pill pill--brand" href="/">
        {siteConfig.name}
      </Link>

      <nav className="pill site-nav__links" aria-label={t('label')}>
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            className="pill__link"
            href={item.href}
            aria-current={isCurrentPath(pathname, item.href) ? 'page' : undefined}
          >
            {t(item.key)}
          </Link>
        ))}
      </nav>

      <div className="pill site-nav__tools">
        <LanguageSwitcher />
        <ThemeSwitcher />
        {account}
      </div>
    </header>
  );
}
