import { type PropsWithChildren, type ReactElement, type ReactNode } from 'react';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderOptions, type RenderResult } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NuqsTestingAdapter } from 'nuqs/adapters/testing';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter, RouterProvider } from 'react-router';

import { type AppStore, makeStore, type RootState } from '@/stores/store';
import { StoreProvider } from '@/stores/store-provider';

import { testI18n } from './test-i18n';

// Fresh, isolated QueryClient per test — retry off (no waiting on failures) and
// no GC so cache stays put across assertions. Mirrors createQueryClient (folder
// 08) minus env / global handlers.
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false },
    },
  });
}

// Non-router providers (Redux → Query → i18n → nuqs), shared by both helpers so
// the only difference is how routing is supplied.
function BaseProviders({
  children,
  store,
  queryClient,
}: {
  children: ReactNode;
  store: AppStore;
  queryClient: QueryClient;
}) {
  return (
    <StoreProvider store={store}>
      <QueryClientProvider client={queryClient}>
        <I18nextProvider i18n={testI18n}>
          <NuqsTestingAdapter>{children}</NuqsTestingAdapter>
        </I18nextProvider>
      </QueryClientProvider>
    </StoreProvider>
  );
}

export interface RenderWithProvidersOptions extends Omit<RenderOptions, 'wrapper'> {
  preloadedState?: Partial<RootState>;
  store?: AppStore;
  queryClient?: QueryClient;
  /** Initial URL for the in-memory router. */
  route?: string;
}

export interface RenderResultWithStore extends RenderResult {
  store: AppStore;
  queryClient: QueryClient;
  user: ReturnType<typeof userEvent.setup>;
}

// Renders a COMPONENT inside the full provider stack (Redux → Query → i18n →
// nuqs → MemoryRouter) — same composition as AppProvider but fresh + isolated
// per test. Returns store/queryClient/user for assertions + interaction.
export function renderWithProviders(
  ui: ReactElement,
  {
    preloadedState,
    store = makeStore(preloadedState),
    queryClient = createTestQueryClient(),
    route = '/',
    ...renderOptions
  }: RenderWithProvidersOptions = {},
): RenderResultWithStore {
  function Wrapper({ children }: PropsWithChildren) {
    return (
      <BaseProviders store={store} queryClient={queryClient}>
        <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
      </BaseProviders>
    );
  }

  return {
    store,
    queryClient,
    user: userEvent.setup(),
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
  };
}

export interface RenderWithRouterOptions {
  preloadedState?: Partial<RootState>;
  store?: AppStore;
  queryClient?: QueryClient;
}

// For ROUTE-level tests (guards / redirects): the caller builds a data router
// (createMemoryRouter) and we wrap it in the shared providers (RouterProvider IS
// the router, so no MemoryRouter here).
export function renderWithRouter(
  router: Parameters<typeof RouterProvider>[0]['router'],
  {
    preloadedState,
    store = makeStore(preloadedState),
    queryClient = createTestQueryClient(),
  }: RenderWithRouterOptions = {},
): RenderResultWithStore {
  return {
    store,
    queryClient,
    user: userEvent.setup(),
    ...render(
      <BaseProviders store={store} queryClient={queryClient}>
        <RouterProvider router={router} />
      </BaseProviders>,
    ),
  };
}

// Convenience re-exports so a test imports everything from one place.
export { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
export { userEvent };
