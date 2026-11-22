import { Suspense } from 'react';

import { NuqsAdapter } from 'nuqs/adapters/react-router/v7';
import { useTranslation } from 'react-i18next';
import { Link, NavLink, Outlet, useNavigation } from 'react-router';

import { LanguageSwitcher } from '@/components/i18n/language-switcher';
import { ThemeSwitcher } from '@/components/theme/theme-switcher';
import { paths } from '@/config/paths';
import { useAuth } from '@/features/auth/hooks/use-auth';

// App shell, S1.1 of docs/specs/SHOP-7/design.md: three pills. Left, the app name;
// middle, the main navigation, with Categories between Products and About (S1.1 of
// docs/specs/SHOP-81/design.md; NavLink sets aria-current="page" on the current link,
// on its add and edit pages too, and components.css styles that attribute); right,
// the language and theme switches and the account link. The app name is a link, not the h1: each page
// owns its single h1.
// NuqsAdapter is mounted here (inside RouterProvider) so URL-state hooks work.
// Strings come from the `common` namespace (bundled eagerly → no flash, folder 14).
export function RootLayout() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const isNavigating = navigation.state === 'loading';
  const { isAuthenticated, user } = useAuth();

  return (
    <NuqsAdapter>
      <div className="shell">
        <header className="shell__bar">
          <Link className="pill pill--brand" to={paths.home.getHref()}>
            {t('app.title')}
          </Link>

          <nav className="pill" aria-label={t('nav.label')}>
            <NavLink className="pill__link" to={paths.home.getHref()} end>
              {t('nav.home')}
            </NavLink>
            <NavLink className="pill__link" to={paths.products.getHref()}>
              {t('nav.products')}
            </NavLink>
            <NavLink className="pill__link" to={paths.categories.getHref()}>
              {t('nav.categories')}
            </NavLink>
            <NavLink className="pill__link" to={paths.about.getHref()}>
              {t('nav.about')}
            </NavLink>
          </nav>

          <div className="pill">
            <LanguageSwitcher />
            <ThemeSwitcher />
            {isAuthenticated && user ? (
              <NavLink className="pill__link" to={paths.profile.getHref()}>
                {user.email}
              </NavLink>
            ) : (
              <NavLink className="pill__link" to={paths.login.getHref()}>
                {t('nav.login')}
              </NavLink>
            )}
          </div>
        </header>

        {/* Global navigation indicator — visible while a lazy route chunk loads. */}
        {isNavigating ? (
          <p className="shell__status" role="status">
            {t('state.loading')}
          </p>
        ) : null}

        <main className="shell__main">
          {/* Suspense covers lazy route chunks AND lazy i18n namespaces (e.g. the
              `product` namespace) so loading a namespace shows the fallback in the
              content area only — the shell (nav, switchers) stays put. */}
          <Suspense fallback={<p role="status">{t('state.loading')}</p>}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </NuqsAdapter>
  );
}
