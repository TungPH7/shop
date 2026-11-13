import { Suspense } from 'react';

import { NuqsAdapter } from 'nuqs/adapters/react-router/v7';
import { useTranslation } from 'react-i18next';
import { NavLink, Outlet, useNavigation } from 'react-router';

import { LanguageSwitcher } from '@/components/i18n/language-switcher';
import { paths } from '@/config/paths';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { useTheme } from '@/stores/theme/use-theme';
import { useSidebar } from '@/stores/ui/use-sidebar';

// App shell: persistent navigation plus the routed page via <Outlet />.
// UI-agnostic (Phase 1.1) — plain markup only; styling and a UI library arrive
// in Phase 1.2. NavLink applies aria-current="page" on the active link for free.
// NuqsAdapter is mounted here (inside RouterProvider) so URL-state hooks work.
// Strings come from the `common` namespace (bundled eagerly → no flash, folder 14).
export function RootLayout() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const isNavigating = navigation.state === 'loading';
  // Client/UI state via domain-hook facades (no react-redux import here).
  const { theme, toggle: toggleTheme } = useTheme();
  const { isOpen: sidebarOpen, toggle: toggleSidebar } = useSidebar();
  const { isAuthenticated, user } = useAuth();

  return (
    <NuqsAdapter>
      <div className="app-shell">
        <header>
          <h1>{t('app.title')}</h1>
          <nav aria-label="Primary">
            <NavLink to={paths.home.getHref()} end>
              {t('nav.home')}
            </NavLink>{' '}
            <NavLink to={paths.products.getHref()}>{t('nav.products')}</NavLink>{' '}
            <NavLink to={paths.about.getHref()}>{t('nav.about')}</NavLink>{' '}
            {isAuthenticated && user ? (
              <NavLink to={paths.profile.getHref()}>{user.email}</NavLink>
            ) : (
              <NavLink to={paths.login.getHref()}>{t('nav.login')}</NavLink>
            )}
          </nav>
          {/* Runtime language switch (folder 14). */}
          <LanguageSwitcher />{' '}
          {/* Client-state demo (folder 09). Visual theming (CSS vars) is Phase
              1.2 — here we only prove state flows through the store. */}
          <button type="button" onClick={toggleTheme}>
            Theme: {theme} (toggle)
          </button>{' '}
          <button
            type="button"
            onClick={toggleSidebar}
            aria-expanded={sidebarOpen}
            aria-controls="app-sidebar"
          >
            {sidebarOpen ? t('sidebar.close') : t('sidebar.open')}
          </button>
        </header>

        {/* Global navigation indicator — visible while a lazy route chunk loads. */}
        {isNavigating ? <p role="status">{t('state.loading')}</p> : null}

        {sidebarOpen ? (
          <aside id="app-sidebar" aria-label="Sidebar">
            <p>{t('sidebar.content')}</p>
          </aside>
        ) : null}

        <main>
          {/* Suspense covers lazy route chunks AND lazy i18n namespaces (e.g. the
              `product` namespace) so loading a namespace shows the fallback in the
              content area only — the shell (nav, switcher) stays put. */}
          <Suspense fallback={<p role="status">{t('state.loading')}</p>}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </NuqsAdapter>
  );
}
